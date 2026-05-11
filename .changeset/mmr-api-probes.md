---
"mmr-api": patch
---

Wire up Container App liveness and readiness probes for `mmr-api` pointing at `GET /health` on port 8080. The deploy workflow now patches the Container App template after each `mmr-api` deploy so the probes are reapplied on every release: liveness restarts the container after 3 consecutive 30-second failures; readiness gates traffic on `/health` returning 200 within 10-second windows. Without probes, Container Apps treats every revision as healthy from the moment the process starts and never restarts a stuck instance, so a wedged `mmr-api` would silently keep serving (or failing) until manually intervened.
