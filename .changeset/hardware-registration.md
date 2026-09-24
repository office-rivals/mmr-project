---
"api": minor
"frontend": minor
---

Let moderators register a Randomizer Box to a league under `organizations/{orgId}/leagues/{leagueId}/hardware` (with `rotate` and `revoke`) to issue its Hardware Secret; the box then reports in via `POST /api/v3/hardware/heartbeat`. League admins see each box's online status and LAN IP.
