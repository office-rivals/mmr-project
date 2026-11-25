---
"api": minor
---

Add foosball table hardware (`/api/v3/hardware`, see `api/docs/hardware-api.md`): goal counters, scoreboards and NFC badges feed live table matches that players follow on `/tables/{tableId}/live` and claim or auto-rate, and admins manage tables, devices and usage stats. Idle HTTP connections now stay open for 10 minutes (`Kestrel:Limits:KeepAliveTimeout`).
