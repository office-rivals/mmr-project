---
"api": patch
"mmr-api": patch
---

Add liveness and readiness endpoints to the API via ASP.NET Core health checks:
`GET /health` returns `200` whenever the process is up (no dependency checks) and
`GET /ready` returns `200` only when the database is also reachable. Both are
anonymous and excluded from request tracing. The MMR API continues to expose
`GET /health`, now also excluded from tracing so frequent health polls don't
flood the trace backend.
