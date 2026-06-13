# Changelog

## 1.2.1

- chore(deps): bump go.opentelemetry.io/otel/sdk from 1.43.0 to 1.44.0 in /mmr-api
- chore(deps): bump the opentelemetry group in /mmr-api with 7 updates

## 1.2.0

- Add support for 1v1 leagues, and replace `League.QueueSize` with `League.TeamSize` (the per-team player count) — `QueueSize` was the inverted way to think about the same concept. The queue requires `2 * teamSize` players. Migrating: existing `queue_size` values are halved into the new `team_size` column.
  
  - **api**: rename `League.QueueSize` → `TeamSize` (column `queue_size` → `team_size`, values halved); validate `TeamSize >= 1`; enforce exactly two teams of equal size on match submission; expose `teamSize` on `MeLeagueResponse`. Wire format renames: `CreateLeagueRequest.queueSize` → `teamSize`, `LeagueResponse.queueSize` → `teamSize`, `MeLeagueResponse.queueSize` → `teamSize`.
  - **mmr-api**: drop the hard-coded "exactly 4 unique players" rule and build team-player slices dynamically; both teams must still have ≥1 player and equal sizes.
  - **frontend**: regenerated client (`teamSize` field); the create-league form has a 1v1 / 2v2 selector; the matchmaking page derives the required queue length from `teamSize * 2`; admin/league overviews display the format label ("1v1"/"2v2") instead of "Queue size N".

## 1.1.2

- Add a `GET /health` endpoint to `mmr-api` that returns `200 OK`. The access-log middleware already excluded `/health` from logging in anticipation of this route, but no handler was registered, so probes pointed at it would 404 instead. With this in place, the Container App liveness/readiness probes can target `/health` cleanly.
- Bake the released version into the `mmr-api` binary so OpenTelemetry resource attributes report the actual `service.version` (e.g. `1.1.2`) instead of the hardcoded `dev`. The Dockerfile now accepts a `VERSION` build arg that is injected via `-ldflags "-X main.version=…"`, and the deploy workflow forwards `inputs.version`. Without this, every emitted log/metric/trace from the deployed `mmr-api` was tagged `service_version=dev`, which made it impossible to attribute production telemetry to a specific release.

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
