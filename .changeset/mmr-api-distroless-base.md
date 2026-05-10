---
"mmr-api": patch
---

Switch the `mmr-api` Docker base image from `debian:bookworm` to `gcr.io/distroless/static-debian12:nonroot`. The previous Debian base shipped without `ca-certificates`, so every outbound HTTPS call from the Go binary failed TLS verification — which silently broke OTLP log/metric/trace export to Grafana Cloud (since the SDK's error reporting is itself routed through the broken slog→OTel pipeline). Distroless static includes a CA bundle, runs as non-root, and shrinks the image to ~42 MB. The build now uses `CGO_ENABLED=0` since `mmr-api`'s dependencies are all pure Go.
