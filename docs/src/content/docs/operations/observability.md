---
title: Observability
description: Export logs, metrics and traces from the API and the MMR API to any OTLP-compatible backend.
---

The two backend services, the API and the MMR API, emit OpenTelemetry logs, metrics and traces. Each service exports over OTLP directly to the endpoint you configure, with no collector sidecar.

The beta frontend emits no telemetry. It does not use OpenTelemetry or any analytics SDK.

## Turning telemetry on

Both services read `OTEL_EXPORTER_OTLP_ENDPOINT` at startup and only set up OpenTelemetry when it has a value:

- **Unset or empty**: no telemetry is exported. The API writes its logs to the console in the default ASP.NET Core format. The MMR API writes JSON logs to stdout.
- **Set**: the service exports traces, metrics and logs to that endpoint.

When telemetry is on, the MMR API sends its logs to OTLP only. They no longer appear on stdout. The API keeps writing to the console as well.

The Aspire AppHost (`local-dev/MMRProject.AppHost`) sets the endpoint for both services, so a local stack started with it sends telemetry to the Aspire dashboard. A service you start on its own exports nothing unless you set the variable.

## Service names

| Service | `service.name` | `service.version` | Source |
| --- | --- | --- | --- |
| API (ASP.NET Core) | `mmr-project-api` | The assembly version, from `<Version>` in `MMRProject.Api.csproj` | [`OpenTelemetryExtensions.cs`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/Extensions/OpenTelemetryExtensions.cs) |
| MMR API (Go) | `mmr-api` | The `VERSION` build argument of the Docker image, or `dev` when it isn't set | [`telemetry.go`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/telemetry/telemetry.go) |

The API also sets `service.instance.id` to the machine name. To tell environments apart, add attributes with `OTEL_RESOURCE_ATTRIBUTES`, for example `deployment.environment=staging`.

## Protocols

The two services don't use the same OTLP transport:

- **API**: the OpenTelemetry .NET exporter defaults to **gRPC**. Set `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` to switch it to HTTP.
- **MMR API**: always uses **HTTP/protobuf**. It uses the Go `otlp*http` exporters, which ignore `OTEL_EXPORTER_OTLP_PROTOCOL`.

So either point the API at your backend's gRPC endpoint and the MMR API at its HTTP endpoint, or set `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf` on the API and give both services the same HTTP endpoint. The AppHost does the second.

For HTTP, set the base URL. The exporters append `/v1/traces`, `/v1/metrics` and `/v1/logs` themselves.

## Environment variables

The services read the standard OpenTelemetry SDK variables:

| Variable | Used by | Notes |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Both | Turns telemetry on. Set it for each service to match the protocol that service uses. |
| `OTEL_EXPORTER_OTLP_HEADERS` | Both | Headers sent with every export, such as auth headers. Format: `key1=value1,key2=value2`. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | API only | Optional. `http/protobuf` switches the API from gRPC to HTTP. |
| `OTEL_RESOURCE_ATTRIBUTES` | Both | Attributes added to every signal, such as environment or region. |

For the rest of each service's configuration, see [Environment variables](/configuration/environment-variables/).

## What gets captured

The API:

- **Traces**: incoming ASP.NET Core requests, outgoing `HttpClient` calls (including those to the MMR API) and Entity Framework Core database commands. Requests to `/health`, `/ready` and `/swagger` are left out.
- **Metrics**: ASP.NET Core, `HttpClient` and .NET runtime metrics.
- **Logs**: everything written through `ILogger`, with formatted messages and scopes. This includes the ASP.NET Core HTTP request log: method, path, query, status code and duration for each request.

The MMR API:

- **Traces and metrics**: incoming HTTP requests, through the `otelgin` middleware. Requests to `/health` are left out.
- **Logs**: all `slog` records, through the `otelslog` bridge. This includes one `http.request` record per request from the access-log middleware, which skips `/health` and `/swagger`.

Both services propagate W3C trace context. When both export to the same backend, a request that makes the API call the MMR API shows up as a single trace.

## Turning telemetry off

Leave `OTEL_EXPORTER_OTLP_ENDPOINT` unset or empty on a service to turn telemetry off for it. This is the default when the service runs outside the AppHost.
