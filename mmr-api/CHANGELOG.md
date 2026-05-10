# Changelog

## 1.1.1

- Switch the `mmr-api` Docker base image from `debian:bookworm` to `gcr.io/distroless/static-debian12:nonroot`. The previous Debian base shipped without `ca-certificates`, so every outbound HTTPS call from the Go binary failed TLS verification — which silently broke OTLP log/metric/trace export to Grafana Cloud (since the SDK's error reporting is itself routed through the broken slog→OTel pipeline). Distroless static includes a CA bundle, runs as non-root, and shrinks the image to ~42 MB. The build now uses `CGO_ENABLED=0` since `mmr-api`'s dependencies are all pure Go.

## 1.1.0

- Instrument both backend services with OpenTelemetry, exporting logs, metrics, and traces to Grafana Cloud via OTLP. Includes structured per-request logs (HttpLogging on .NET, slog middleware on Go) and a structured `mmr calculation` log line capturing every MMR calc's inputs and outputs for diagnosis.

## 1.0.1

- Bump frontend, api, and mmr-api dependencies to the latest minor/patch
  within their current major. Includes Clerk JS SDK updates that pull in
  patches for GHSA-vqx2-fgx2-5wq9 (middleware route protection bypass)
  and GHSA-w24r-5266-9c3c (authorization bypass).

## 1.0.0

- Align mmr-api with the v3 release. The release script enforces a shared
  major across frontend, api, and mmr-api; without this bump the release
  PR job fails because frontend and api are moving to 1.0.0 while mmr-api
  would otherwise stay on 0.x. No behaviour changes in mmr-api itself.

## 0.1.0

- Set up Changesets-based releases and manual deployment from GitHub Releases.
