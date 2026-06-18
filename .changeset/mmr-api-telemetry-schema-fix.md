---
"mmr-api": patch
---

Fix the MMR API crashing on startup when OpenTelemetry export is enabled
(`OTEL_EXPORTER_OTLP_ENDPOINT` set). Telemetry init failed with a
`conflicting Schema URL` error because the service resource pinned a semconv
schema version that differs from the one the OpenTelemetry SDK bundles. The
resource is now built schemaless, so `resource.Merge` no longer conflicts and
telemetry initialises regardless of the SDK's semconv version.
