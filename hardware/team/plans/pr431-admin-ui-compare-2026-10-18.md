# PR #431 vs our admin Hardware page (2026-10-18, admin-ui)

Read-only: `gh pr diff 431` (base `stack/hardware`, head `stack/hardware-admin-ui`, +3800/-16, 36 files; the
diff includes the stack's API layers). No GitHub comments, nothing checked out.

## What each one is

| | PR #431 | Ours (frontend-beta) |
|---|---|---|
| App | `frontend/` (SvelteKit) | `frontend-beta/` (React, TanStack) |
| Where | a **Hardware** card on the league admin page `/admin/[org]/leagues/[league]` | its own page `/admin/$orgSlug/hardware` (org-wide), plus a banner on the org overview |
| What "Hardware" is | a Randomizer Box, bound to **one league** for good (`CONTEXT.md`) | goal counters and scoreboards, claimed to a **table** (org-wide; a table has an optional default league) |
| Enrolment | admin types a Hardware ID → API mints a per-box **Hardware Secret** (`hw_` + 64 hex), shown once with Copy | device enrols itself with the org's **enrolment token**; admin claims it from "Unclaimed devices" |
| Credentials | Rotate secret (confirm), Revoke (confirm, permanent; row greys, "Revoked") | Replace / Revoke the org enrolment token (Owner); Reset a device (unclaims it) |
| Status shown | Online / Offline badge, LAN IP, last seen, "Never checked in" | battery V, last seen, firmware, attention chips (wrong firmware, silent > 36 h, battery low/empty), beam health and readings, "Light by hour of day" link |
| Config | none | team names, Table sound, default league, NFC link code, beam mode + Advanced |
| Endpoints | `GET/POST …/leagues/{l}/hardware`, `POST …/hardware/{id}/rotate`, `…/revoke`, `POST /api/v3/hardware/heartbeat` (Hardware Secret auth) | `…/admin/devices*`, `…/tables*`, `…/admin/enrolment-token`, device API (ours: `HardwareAdminController`, `DeviceApiController`) |
| e2e | `frontend/e2e/hardware-admin.spec.ts` (register → rotate → revoke) | `frontend-beta/e2e/foosball-tables.e2e.spec.ts` (7 tests, read-only on the seed) |

## Same / overlapping / conflicting

- **Same:** an admin-only place to see devices with last-seen state; one-time secret shown once; destructive actions behind a confirm step (theirs `confirm()`, ours two-step buttons).
- **Overlapping:** "is it alive?" (their heartbeat + Online badge ≈ our last seen + "Silent for over 36 h"); revoking access (their per-box Revoke ≈ our token Revoke + device Reset).
- **Conflicting:**
  - **The word "Hardware".** Their `CONTEXT.md` defines Hardware = Randomizer Box and says *avoid "Device"*; our page is titled Hardware and lists "devices". One glossary needs to win.
  - **Scope.** League-bound boxes vs org-wide devices claimed to tables. A box can't move league; our devices move between tables freely.
  - **Auth model.** A per-box Hardware Secret (rotate/revoke each) vs an org enrolment token plus per-device credentials.
- **Only theirs:** Register by typed ID, Rotate secret, permanent Revoke with a Revoked state, LAN IP, the heartbeat endpoint.
- **Only ours:** tables (create/edit/delete, team names, sound, NFC link), claim/assign with "Whose goalkeeper guards this goal?", beam health/settings, attention chips/banner, unclaimed matches, orphan goals, badges, enrolment token.

## Files both touch

- **UI: none.** Theirs is all `frontend/…`, ours all `frontend-beta/…`. Changesets have different names (`hardware-admin-ui.md`, `hardware-registration.md` vs ours `foosball-tables.md`, `foosball-table-hardware.md`).
- **API (backend's call), same path in both:**
  - new in both, so they'll collide: `DTOs/V3/HardwareDtos.cs` and `IntegrationTests/Hardware/HardwareTests.cs`;
  - modified in both: `Auth/BuilderExtensions.cs`, `Authorization/V3/V3AuthorizationPolicies.cs`, `Data/ApiDbContext.cs`, `Data/ApiDbContext.V3Configuration.cs`, `Data/Migrations/ApiDbContextModelSnapshot.cs`, `Program.cs`.
