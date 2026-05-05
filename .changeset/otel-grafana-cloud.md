---
"api": minor
"mmr-api": minor
---

Instrument both backend services with OpenTelemetry, exporting logs, metrics, and traces to Grafana Cloud via OTLP. Includes structured per-request logs (HttpLogging on .NET, slog middleware on Go) and a structured `mmr calculation` log line capturing every MMR calc's inputs and outputs for diagnosis.
