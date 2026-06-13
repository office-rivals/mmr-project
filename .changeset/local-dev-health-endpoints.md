---
"api": patch
"mmr-api": patch
---

Add a `GET /health` liveness endpoint to the API via ASP.NET Core health checks
(returns `200`), excluded from request tracing. Both backend services now expose
`GET /health` for liveness/readiness probes. The MMR API's existing `/health`
probe is now also excluded from tracing so frequent health polls don't flood the
trace backend.
