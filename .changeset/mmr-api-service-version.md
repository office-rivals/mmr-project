---
"mmr-api": patch
---

Bake the released version into the `mmr-api` binary so OpenTelemetry resource attributes report the actual `service.version` (e.g. `1.1.2`) instead of the hardcoded `dev`. The Dockerfile now accepts a `VERSION` build arg that is injected via `-ldflags "-X main.version=…"`, and the deploy workflow forwards `inputs.version`. Without this, every emitted log/metric/trace from the deployed `mmr-api` was tagged `service_version=dev`, which made it impossible to attribute production telemetry to a specific release.