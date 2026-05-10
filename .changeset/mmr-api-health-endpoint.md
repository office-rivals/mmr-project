---
'mmr-api': patch
---

Add a `GET /health` endpoint to `mmr-api` that returns `200 OK`. The access-log middleware already excluded `/health` from logging in anticipation of this route, but no handler was registered, so probes pointed at it would 404 instead. With this in place, the Container App liveness/readiness probes can target `/health` cleanly.
