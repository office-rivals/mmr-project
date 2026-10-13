---
title: Environment variables
description: Every setting the frontend, API and MMR API read, per service.
---

Each service reads its own configuration. The tables below list the variables the current code reads.

## Frontend

The frontend in `frontend-beta/` reads everything at runtime, so one image works in every environment. For local development, copy [`frontend-beta/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/.env.example) to `.env`; both the dev server and `npm start` load it.

| Variable | Required | Notes |
| --- | --- | --- |
| `API_BASE_PATH` | Yes | Base URL of the API, for example `http://api:8080`. Only the frontend's server uses it; browsers never call the API directly. |
| `CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key. The server passes it to the browser during server-side rendering. `VITE_CLERK_PUBLISHABLE_KEY` still works for older local setups. |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key. Server only; keep it secret. |
| `CLERK_SIGN_IN_URL` | Yes | Set to `/login`. The app signs in at `/login`, not Clerk's default `/sign-in`. |
| `CLERK_SIGN_UP_URL` | Yes | Set to `/sign-up`. |
| `APP_ORIGIN` | Behind a TLS proxy | Public origin, for example `https://app.example.com`, with no path. Used for Clerk and form origin checks. Leave it unset in local development. An invalid value stops startup. |
| `TRUST_PROXY` | No | Which forwarded headers to trust: `false` (default), `true`, `loopback` or a comma-separated list of proxy IP addresses. Keep `false` when `APP_ORIGIN` is set. An invalid value stops startup. |
| `CLERK_AUTHORIZED_PARTIES` | Recommended in production | Comma-separated origins allowed to mint session tokens, for example `https://app.example.com`. Each entry must be an HTTP(S) origin without a path. |
| `PORT` | No | Port of the production server. Default `3000`. The dev server always uses `5173`. |
| `HOST` | No | Address the production server binds to. Default `0.0.0.0`. |

The frontend doesn't export OpenTelemetry data.

## API

The API uses ASP.NET Core configuration. In environment variables, replace `:` in a setting name with `__`, so `Authorization:Issuer` becomes `Authorization__Issuer`.

| Variable | Required | Notes |
| --- | --- | --- |
| `ConnectionStrings__ApiDbContext` | Yes | PostgreSQL connection string, for example `Host=postgres;Database=mmr_project;Username=postgres;Password=...`. |
| `Authorization__Issuer` | Yes | Your Clerk issuer URL. The API validates JWTs against it and downloads the signing keys from it. |
| `MMRCalculationAPI__BaseUrl` | Yes | Base URL of the MMR API, for example `http://mmr-api:8080`. The default in `appsettings.json`, `http://localhost:8080`, only works when both run on the same host. |
| `MMRCalculationAPI__ApiKey` | Yes | Sent to the MMR API in the `X-API-KEY` header. Must equal the MMR API's `ADMIN_SECRET`. |
| `Migration__Enabled` | Recommended | When `true`, the API applies EF Core migrations on startup. Off unless you set it; only `appsettings.Development.json` turns it on. |
| `ASPNETCORE_ENVIRONMENT` | No | Standard ASP.NET Core environment name. Containers default to `Production`, which doesn't load `appsettings.Development.json`. |
| `ASPNETCORE_HTTP_PORTS` | No | Listening port. The .NET container image defaults to `8080`. |

`appsettings.Development.json` and the Aspire AppHost also set `Admin__Secret`, but the current API code doesn't read it.

## MMR API

See [`mmr-api/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/.env.example). The service also loads a `.env` file from its working directory if one exists.

| Variable | Required | Notes |
| --- | --- | --- |
| `ADMIN_SECRET` | Yes | Shared secret that callers send in `X-API-KEY`. Must equal the API's `MMRCalculationAPI__ApiKey`. The service exits on startup if it's unset. |
| `MMR_API_PORT` | No | Listening port. Default `8080`. |

## OpenTelemetry

The API and the MMR API can export traces, metrics and logs over OTLP. Both turn telemetry on only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The other variables are read by the OpenTelemetry SDKs.

| Variable | Used by | Notes |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | API and MMR API | OTLP endpoint; leave unset to disable telemetry. The API defaults to gRPC. The MMR API always sends HTTP/protobuf, so give it your backend's HTTP endpoint. |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | API | Set to `http/protobuf` to make the API send over HTTP. The MMR API ignores it. |
| `OTEL_EXPORTER_OTLP_HEADERS` | API and MMR API | Headers sent with every export, such as authentication, formatted as `key=value,key2=value2`. |
| `OTEL_RESOURCE_ATTRIBUTES` | API and MMR API | Extra attributes on every signal, for example `deployment.environment=production`. |

For backend-specific setup, see [Observability](/operations/observability/).

## Local development defaults

When you run the stack with the Aspire AppHost, it injects the API's connection string, issuer, MMR API URL and shared secret, the MMR API's `ADMIN_SECRET` and port, and the OTLP endpoint for its dashboard. See [`local-dev/README.md`](https://github.com/office-rivals/mmr-project/blob/main/local-dev/README.md). It doesn't configure the frontend in `frontend-beta/`; that reads its own `.env`, as in the [Quick start](/quick-start/).

[`api/MMRProject.Api/appsettings.Development.json`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/appsettings.Development.json) holds the defaults for running the API on its own: PostgreSQL on `localhost`, the MMR API on `http://localhost:8080`, and migrations on. It has no issuer, so set one as a user-secret in `api/MMRProject.Api`:

```bash
dotnet user-secrets set "Authorization:Issuer" "https://your-app.clerk.accounts.dev"
```

## Good practices

- Keep production secrets out of Git.
- Use separate values per environment.
- Take the Clerk issuer, publishable key and secret key from the same Clerk application.
- Treat `MMRCalculationAPI__ApiKey` and `ADMIN_SECRET` as one shared secret, and rotate them together.

For the Clerk setup, continue to [Authentication](/configuration/authentication/).
