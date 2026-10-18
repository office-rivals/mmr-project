# PR #426–#431 stack vs our foosball hardware: overlap and options (2026-10-18)

Owner: backend. Inputs: `gh pr view/diff` 426, 427, 428, 431 (read-only), a dry-run merge in a
scratch worktree, [firmware's contract compare](../../firmware/pr426-428-device-contract-2026-10-18.md)
and [admin-ui's UI compare](pr431-admin-ui-compare-2026-10-18.md).

**Their stack** (another contributor, all OPEN, not rebased on current `main`):
`#426` Hardware registration + Hardware Secret + heartbeat → `#427` RFID pairing → `#428`
`POST /api/v3/hardware/matchmaking`; `#431` Hardware admin card (old `frontend/`) on `#426`.
`#424` (Bruno YAML) is independent. `#423`/`#425` are in `main`.
Their device is the **Randomizer Box** (RFID reader, colour buttons, shows white/red sides).
Ours are **goal counters** (beam + undo button) and the parked scoreboard, claimed to a **table**.

**Update (user, 2026-10-18):** our tables, and so their devices, are now **league-bound** too
(`FoosballTable.LeagueId`, required; claim/link/auto-rate only in that league; moving a table needs
no live or unclaimed game), like their boxes. The **different pairing flows are intended**: we offer
more ways to link a badge (scan at the table then confirm on the phone, and their phone code then box
flow can sit beside it), so that row is a choice, not a conflict. The "Binding" row below predates this.

## 1. Concept by concept

| Concept | Theirs | Ours | Verdict |
|---|---|---|---|
| Device identity | `Hardware` row, `hardware_id` free text ≤ 64, unique across all orgs | `Device`, `hardware_id` = `fb-<wifi mac>`, unique | **overlapping**: two registries for "a box on the network" |
| Registration | Moderator registers a box to **one league**; server mints `hw_…` secret, shown once, admin copies it into the box | Board generates its own secret; first request with the **org enrolment token** self-registers it as unclaimed; admin **claims** it to a table + role + end | **conflicting** models (manual per-box secret vs zero-touch enrolment) |
| Binding | League, permanent (move = new registration) | Table (which has a default league); re-claimable, `reset` | **conflicting** |
| Secret lifecycle | rotate, revoke (row kept; can't re-register a revoked id, their #431 notes) | rotate/revoke the org token; device `reset` clears its secret; existing devices keep working on token rotation | overlapping |
| Auth scheme | `Authorization: Bearer hw_<secret>`, picked by `ForwardDefaultSelector`; policy `RequireHardwareSecret` | `Authorization: Device <64 hex>` + `X-Device-Id` (+ `X-Enrolment-Token`), explicit scheme on policy `RequireDevice` | **coexist** (different prefixes, verified: both pass in one build) |
| Heartbeat vs status | `POST /hardware/heartbeat {localIpAddress}`, 204; online = seen < 15 min | `POST /hardware/devices/{id}/status` (battery, beam health, metrics, reason sleep/heartbeat/cutoff/beam); offline > 36 h | **overlapping**; their 15-min rule would flag every sleeping counter (firmware #4) |
| RFID tags vs cards | `RfidTag` per **user** (global across orgs), **raw UID stored** and returned to the user | `PlayerCard` per **org membership**, only `HMAC(key, org ‖ UID)` stored | **conflicting**: same badges, opposite privacy rules |
| Pairing flow | Phone shows a 4-colour Pairing Code (24 h); player scans tag + enters code on the box (`POST /hardware/pairing`) | Unknown card scanned at a table → a card link code/short link; player (or any member for someone) links it on the phone (`POST /me/cards`) | **overlapping** (inverse directions of the same idea) |
| Team assignment | `POST /hardware/matchmaking {rfidUids[], temperature}` → `[0,1,1,0]`, stateless (no match, no queue); 0 = **white**, 1 = **red** | Scan-in at a table makes teams Fair/Random/Manual (`TeamBalancer`), creates a linked active match, goals score it, auto-rate | **overlapping**; theirs creates no match, so our counters' goals can't attach to it (firmware #3) |
| Side colours | side 0 = white, 1 = red | end A = team A = "Red" by default, B = "White" (per-table names) | **conflicting** default mapping |
| Admin UI | Card on the old SvelteKit league admin page: register, secret once, rotate, revoke, online/LAN IP | `frontend-beta` org Hardware page: tables, enrolment token, claim devices, beam health, attention list | only-theirs (old frontend) / only-ours (beta); no shared UI file |
| Entities / tables | `hardware`, `rfid_tags`, `pairing_codes` | `devices`, `foosball_tables`, `table_matches`, `table_goals`, `table_roster_entries`, `device_wakes`, `player_cards`, `card_link_requests`, org enrolment token columns | no table-name clash |
| Migrations | `20260924115531_AddHardware`, `20260924121121_AddRfidPairing` | `20261018171446_AddFoosballHardware` (uncommitted) | snapshot conflict; ours regenerates on top cleanly (verified) |
| Routes on `/api/v3/hardware` | `heartbeat`, `pairing`, `matchmaking` | `devices/{id}/config`, `devices/{id}/status`, `goal-events`, `undo-events`, `devices/{id}/scoreboard[/actions]` | **same prefix, no path clash** |
| Admin routes | `organizations/{org}/leagues/{league}/hardware[/{id}/rotate\|revoke]` | `organizations/{org}/admin/devices…`, `…/admin/device-enrolment-token`, `…/admin/tables…`, `…/admin/cards…` | no clash; two admin surfaces for devices |
| Player routes | `api/v3/pairing/code`, `pairing/tags[/{id}]` (user-global) | `organizations/{org}/me/cards[/{id}]`, `tables…`, `short-links/{code}` | only-each |
| Policies | + `RequireHardwareSecret` (+ `RequirePatWrite` on admin) | + `RequireDevice`; admin uses existing org policies | coexist (one-line conflict) |
| Docs | Root `CONTEXT.md` glossary ("Hardware" = Randomizer Box, *avoid "Device"*; "RFID Tag", *avoid "Card"*; "Active Match", *avoid "Live match"*), `docs/adr/0001`, `0002`, TLS note, `docs/rfid-team-assignment-endpoint.md` | `api/docs/hardware-api.md`, `firmware/openapi.yaml`, `docs/src/content/docs/features/foosball-tables.md` | **conflicting vocabulary**: their glossary forbids the words our code and docs use |
| TLS | Box firmware `setInsecure` (no cert check; their ADR flags it) | Firmware verifies `API_ROOT_CA` | only-ours |

## 2. Hard merge conflicts (dry run: their #428 tip merged onto current `main`, then our API work applied)

Their stack alone already conflicts with `main` (`ApiDbContext.cs`, `Program.cs`: `main`'s
`MembershipClaimRequests`); keep-both fixes it.

| File | Kind | Fix |
|---|---|---|
| `Auth/BuilderExtensions.cs` | both add a scheme after PAT | keep both `.AddScheme` (watch the `;`) |
| `Authorization/V3/V3AuthorizationPolicies.cs` | both add a const | keep both |
| `Program.cs` | policy + service registrations (2 hunks) | keep both |
| `Data/ApiDbContext.cs` | DbSets | keep both |
| `Data/ApiDbContext.V3Configuration.cs` | different regions | auto-merged |
| `Services/V3/V3MatchMakingService.cs` | both extend `IV3MatchMakingService` | keep both (signatures differ, no overlap) |
| `Data/Migrations/ApiDbContextModelSnapshot.cs` | 10 hunks | take theirs, delete ours, `dotnet ef migrations add AddFoosballHardware` (regenerated: only our 8 tables) |
| `DTOs/V3/HardwareDtos.cs` | **add/add** (both new) | rename ours, e.g. `TableHardwareDtos.cs` (no type-name clash) |
| `IntegrationTests/Hardware/HardwareTests.cs` | **add/add**, same namespace + class name | rename ours `TableHardwareTests` |
| Controller names | theirs `HardwareController`, ours `DeviceApiController`/`HardwareAdminController` | no clash |
| `frontend/` vs `frontend-beta/` | none shared | none |

Result after those fixes: **build clean, 316/316 integration tests** (their 23 + our 293). So
coexistence costs about an hour whichever side merges first. Scratch worktree removed afterwards.

## 3. Options

| | What | Effort | Deleted | Risk |
|---|---|---|---|---|
| **(a) We rebase onto theirs and reuse Hardware/secret/pairing** | Counters become `Hardware` rows registered per league; our firmware gets a server-minted `hw_` secret typed/flashed per board; cards become `RfidTag` | Backend 3–4 days, firmware re-provisioning flow, admin-ui rework | Ours: org enrolment token + `DeviceAuthenticationHandler`, self-generated secrets, `PlayerCard`/`CardLinkRequest`/HMAC, claim-to-table | Loses zero-touch setup and HMAC privacy; league binding doesn't fit tables with a default league; their glossary still says "no device" |
| **(b) They adopt ours** | Box = a `Device` with a new role (e.g. `randomizer`), self-enrols with the org token, is claimed to a table (or a league); tags = `PlayerCard` (HMAC); pairing colour code becomes a second `CardLinkRequest` flow; team assignment uses `TeamBalancer` and can create our linked match | Ours ~1–1.5 days (role, pairing flow, stateless assignment endpoint under `RequireDevice`); theirs: firmware auth headers + enrol (~1 day), drop #431 | Theirs: `Hardware`, `hw_` scheme, heartbeat, `RfidTag`, `PairingCode`, `HardwareController`, #431 card, most of CONTEXT.md/ADR 0002 | Their recent security work (ADR 0002 rationale) is discarded in name, though our scheme meets the same goals (identity from the credential, never from the body) |
| **(c) Unify into one model** | One device registry (`devices`) with a role per kind and two ways to get credentials (org enrolment for counters, admin-minted secret for boxes if they want it); one badge store (`player_cards`, HMAC per org) with both link flows (scan→phone, phone code→box); one glossary | Backend ~2–3 days (both sides), small firmware change on theirs | Their `hardware`/`rfid_tags` tables (no production data: ADR 0002 says no hardware is deployed), our nothing major | Most design talk; needs both sides to agree on names |
| (status quo) Merge both as is | Coexist (§2) | ~1 h | nothing | Two registries, two badge stores with opposite privacy, two meanings of "Hardware", two admin UIs: users pair the same badge twice |

### Recommendation

**(c), built on our model: in practice (b) plus their good parts.** Keep one device registry and
one HMAC badge store; add the Randomizer Box as a device role; keep their colour Pairing Code as a
second way to link a card; keep their stateless `temperature` assignment as a team mode next to
Fair/Random/Manual, and let it optionally create our linked match so goal counters can score it.
Reasons: zero-touch enrolment and claim-to-table already work with real firmware; HMAC-only UIDs are
the stricter privacy rule; nothing of theirs is deployed. If agreement takes long, the status-quo
merge is safe in the short term (verified green), but don't ship both badge stores to users.

## Questions for the other contributor

1. Is any Randomizer Box running against a shared environment with issued `hw_` secrets? (ADR 0002 says none in production.)
2. Can the box firmware generate and keep its own secret (NVS) and send `X-Device-Id` / `Authorization: Device …` / `X-Enrolment-Token` instead of a pasted `hw_` secret?
3. Must a tag work across organizations (their `RfidTag` is per user)? Is storing only an HMAC of the UID per org (never the raw UID) acceptable? The box only needs the UID in the request.
4. Is a box always at one table? If so, can it be claimed to a table (table → default league) rather than bound to a league, so its teams become a live table match our goal counters score?
5. Side colours: their `0` = white / `1` = red vs our team A = Red by default (per-table names). Which mapping should the box follow?
6. Is the 15-min "online" window needed for the box? Our sleeping counters report once a day; we'd keep per-role windows.
7. UI target: #431 is on the old `frontend/`; ours is `frontend-beta`. Which one should device admin live in?
8. Glossary: can `CONTEXT.md` use "Device" (with roles) and "Card/badge" instead of forbidding them, and keep "Hardware" for the whole feature?
9. Merge order: who merges first? We can rebase on theirs (§2 is about an hour) if that's simpler for them.
10. TLS: would they adopt our CA-pinned approach (`API_ROOT_CA`) instead of `setInsecure`?
