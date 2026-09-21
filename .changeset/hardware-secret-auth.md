---
"api": patch
---

Replace personal access tokens for device endpoints with an admin-issued Hardware Secret bound to one league. Device identity now comes solely from the authenticated secret — add `POST/rotate/revoke` under `organizations/{orgId}/leagues/{leagueId}/hardware`, and move heartbeat, pairing submission, and RFID team assignment to `hardware/heartbeat`, `hardware/pairing`, and `hardware/matchmaking`.
