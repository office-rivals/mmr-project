---
title: Observability
description: Export logs, metrics, and traces from the API and MMR API to any OTLP-compatible backend.
---

Both backend services emit OpenTelemetry signals (logs, metrics, traces) and export them directly via OTLP. There is no collector sidecar — each service speaks OTLP to whatever endpoint you point it at.

## When Telemetry Is Active

Both services gate OTel initialization on `OTEL_EXPORTER_OTLP_ENDPOINT`:

- if the variable is unset or empty, telemetry is disabled and logs go to stdout as JSON
- if it is set, the service initializes exporters and starts shipping signals to the configured endpoint

This means local development is silent by default. To enable telemetry locally, export the env vars in your shell.

## Service Names

Resource attributes the services emit:

| Service | `service.name` | Source |
| --- | --- | --- |
| ASP.NET API | `mmr-project-api` | [`api/MMRProject.Api/Extensions/OpenTelemetryExtensions.cs`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/Extensions/OpenTelemetryExtensions.cs) |
| Go MMR API | `mmr-api` | [`mmr-api/telemetry/telemetry.go`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/telemetry/telemetry.go) |

The `service.version` is taken from the build version. Add `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=<env>` to distinguish environments at query time.

## Protocol Differences

The two services do not use the same OTLP transport.

- **.NET API** — uses the default OTel SDK exporter, which is **gRPC** unless overridden. Endpoint must be the bare host (`https://otlp.example.com:443`), no `/otlp` path.
- **Go MMR API** — uses the `otlp*http` exporters explicitly, so it is **HTTP/protobuf** regardless of env. Endpoint must include the gateway's HTTP path, typically `/otlp`.

If your backend offers both gRPC and HTTP endpoints, you usually need two different `OTEL_EXPORTER_OTLP_ENDPOINT` values — one per service.

## Required Env Vars

The services read the standard OTel SDK environment variables:

| Variable | Used by | Notes |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Both services | Acts as the on/off switch. Set per-service to match the protocol above. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Both services | Auth headers for the OTLP backend. Format is `key=value,key2=value2`. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | .NET only | Optional. Set to `http/protobuf` if you need to force the .NET service onto HTTP transport. |
| `OTEL_RESOURCE_ATTRIBUTES` | Both services | Free-form key/value attributes added to every signal. Use this to tag environment, region, replica, etc. |

Apply these alongside the variables in [Environment Variables](/configuration/environment-variables/).

## What Gets Captured

The .NET API instruments:

- ASP.NET Core request/response (the `/health` and `/swagger/*` paths are filtered out of traces)
- outbound HTTP client calls
- Entity Framework Core SQL
- runtime metrics (GC, threadpool, exceptions)

The Go MMR API instruments:

- inbound Gin HTTP traffic via a custom slog access log
- outbound HTTP from instrumented clients
- structured slog log records via the `otelslog` global handler — `slog.InfoContext(ctx, ...)` calls flow through OTLP when telemetry is on, JSON to stdout otherwise

## Grafana Cloud — Worked Example

Grafana Cloud's OTLP gateway is a common target. The endpoints follow the protocol split above:

- gRPC (for the .NET API): `https://otlp-gateway-<region>.grafana.net:443`
- HTTP (for the Go MMR API): `https://otlp-gateway-<region>.grafana.net/otlp`

Auth is HTTP Basic with `base64("<instance-id>:<cloud-access-policy-token>")`:

```bash
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64-encoded-credentials>"
```

Two gotchas worth knowing:

- **The basic-auth username is the OpenTelemetry instance ID** shown on Grafana Cloud's "Connect a data source → OpenTelemetry" page. It is not the Grafana stack ID. Using the wrong one returns `401 no credentials provided`.
- **The OTLP write token must be a Cloud Access Policy token** (`glc_…`) with `logs:write metrics:write traces:write` scopes. Service-account tokens (`glsa_…`) authenticate read queries and will not work for ingest.

You can use any OTLP-compatible backend (Honeycomb, Tempo + Loki + Mimir, Datadog via the OTel collector, etc.) by adjusting the endpoint and auth header format accordingly.

## Self-Hosting Gotchas

A few sharp edges worth flagging:

- **macOS local dev with the .NET API**: the gRPC OTLP exporter fails on macOS with `unable to establish HTTP/2 connection` because of an ALPN issue in the system `HttpClient`. Locally on macOS, force HTTP transport for the .NET service: set `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` and use the `/otlp`-suffixed endpoint. Linux containers are unaffected.
- **CA bundle in the MMR API container**: the `mmr-api` Dockerfile's final stage is based on `debian:bookworm`, which does not ship `ca-certificates`. Without it, outbound HTTPS to your OTLP endpoint silently fails x509 verification and zero signals reach the backend. If you build the image yourself and your OTLP endpoint is on the public internet, install `ca-certificates` in the final stage or switch to a base image that ships them (for example `gcr.io/distroless/static-debian12`).
- **Diagnose missing signals**: the .NET SDK supports a self-diagnostics file. Drop `OTEL_DIAGNOSTICS.json` containing `{"LogDirectory":".","FileSize":32768,"LogLevel":"Verbose"}` next to the executable, restart, and the SDK writes detailed init/export logs to disk. Useful when OTLP appears to be configured but nothing arrives.

## Disabling Telemetry

Leave `OTEL_EXPORTER_OTLP_ENDPOINT` unset (or empty) to disable telemetry on a per-service basis. This is the default state and is appropriate for local development or air-gapped deployments that prefer plain stdout logs.
