# PR #426–#428 ("Randomizer Box") vs our device contract (2026-10-18)

For backend's `team/plans/pr428-stack-overlap-2026-10-18.md` (lead/user ACTION). **Read-only:** `gh pr diff 426/427/428`
(the stack is open, not merged). Ours: `firmware/openapi.yaml` plus backend's `api/docs/hardware-api.md` *Device auth*.

## Side by side

| | Randomizer Box (PRs) | Goal counter (ours) |
|---|---|---|
| **What the box does** | Mains-powered. It scans 2 or 4 RFID tags, asks for team sides, and shows white/red. It pairs a tag to a player with a 4-colour code. It creates no match and counts no goals | Battery, deep sleep. It counts goals at one goal (beam), POSTs each goal and undo, and sends status and heartbeat. It has no RFID (the parked scoreboard had card scan-in) |
| **Base path** | `/api/v3` + `hardware/heartbeat`, `hardware/pairing`, `hardware/matchmaking`; admin under `organizations/{orgId}/leagues/{leagueId}/hardware` | `API_BASE_URL` = `/api/v3/hardware`; then `/devices/{id}/config`, `/devices/{id}/status`, `/goal-events`, `/undo-events` |
| **Path clash** | none: `heartbeat` / `pairing` / `matchmaking` vs `devices/…` / `goal-events` / `undo-events`. Both live under `/api/v3/hardware`, so a future name must be checked against both | |
| **Device identity** | `Hardware.HardwareId`, a free string (1–64) that the admin types at registration; DB row Guid `Id` | `device_id` = `fb-` + Wi-Fi MAC (12 hex), in `X-Device-Id` and in the path/body (mismatch → 403/422) |
| **Credential** | `Authorization: Bearer hw_<secret>`, **minted by the server** at admin registration and shown once; it has to be put into each box by hand. SHA-256 stored; rotate / revoke endpoints | `Authorization: Device <64 hex>`, **made on the device** (hardware RNG) and kept in NVS; SHA-256 stored, constant-time compare. **Zero-touch:** an unknown device with the org's `X-Enrolment-Token` self-registers as unclaimed; an admin claims it. An admin reset handles an NVS wipe |
| **Tenant binding** | Bound to **one league** at registration (permanent; a move needs a new registration). The tenant comes from the secret only, never the body | Bound to the **org** by the enrolment token, then claimed and assigned to a **table + goal** (config). The tenant comes from the device record |
| **Auth coexistence** | The handler ignores anything that isn't `Bearer hw_…` (NoResult) | Our scheme keyword is `Device`, so the two handlers can run side by side; no header collision |
| **Heartbeat** | `POST hardware/heartbeat {localIpAddress}` every 5 min → 204; online = seen within 15 min | `POST /devices/{id}/status` (`DeviceStatus`: reason sleep / heartbeat / cutoff / beam, battery, low_batt, queue, beam health, metrics) at each sleep and at least every 24 h. A 15-min "online" rule would flag every sleeping counter as offline: they are offline most of the day by design. The 36 h no-status alert is ours |
| **Payload style** | camelCase JSON; errors are ProblemDetails (400/401/403/404) | snake_case JSON (openapi); refusals are 422 ProblemDetails with `code`; 409 = duplicate `event_id`; 404 config = unassigned |
| **Idempotency** | Matchmaking is stateless (a retry may differ when temperature > 0). Pairing submit is not deduped (a correct code is used once) | Every event has an `event_id` (`{device}-{epoch}-{seq}`); the server dedupes (409), the NVS queue retries |
| **RFID UIDs** | **Raw UID** in request bodies and in the DB (`RfidTag.RfidUid`, plaintext, case-sensitive) | Never logged on the device. Backend stores only `HMAC-SHA256(CardUidKey, orgId ‖ UID)`, and no raw UIDs (*Cards*) |
| **TLS** | The box firmware uses `setInsecure()`: **no server-certificate check**. A bearer secret can be sniffed (their own TLS note) | `API_ROOT_CA` from the secrets file; the server certificate is verified |
| **Firmware** | Not in this repo (ESP32, Wi-Fi portal config, single API slot) | `hardware/firmware` |

## What overlaps, what conflicts

1. **Two device-auth models for one platform.** A server-minted league secret (theirs) vs a device-made secret with org enrolment
   (ours). Both work side by side technically. But admins would have two registration flows and two "hardware" lists, `Hardware`
   (theirs) and our devices. Suggest one device registry with one claim/assign UI. Our zero-touch enrolment avoids typing a
   secret into every unit (the box could use it too). Their league binding fits a box that matchmakes for one league.
2. **RFID storage conflict:** raw `RfidTag.RfidUid` (theirs) vs HMAC-only card hashes (ours, backend's *Cards*). Two tables for the
   same physical badges, with opposite privacy rules. Pick one before either ships. Ours is the stricter one (no raw UIDs at rest).
3. **No link from the box's teams to our goals.** The box's `[0,1,1,0]` creates no match. Our goal counters score a table's live match.
   So a table with both would show the box's teams on its lights, while the goals land in a match that knows nothing of them. If
   they belong together, the matchmaking answer should start (or feed) the table's match, or the box should be told the table.
4. **Heartbeat semantics differ** (5 min online vs a 24 h heartbeat on a sleeping device). One "online" rule can't serve both:
   ours needs "last status < 36 h".
5. **Their TLS gap** (`setInsecure`) is theirs to close; it doesn't affect our firmware.

No change is needed in `firmware/openapi.yaml` for the stack as it stands: no path or header collides.
