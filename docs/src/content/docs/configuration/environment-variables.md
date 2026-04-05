---
title: Environment Variables
description: Organize configuration for the frontend, API, and supporting services.
---

Split configuration by runtime boundary. The tables below reflect the variables the current codebase actually reads.

## Frontend Variables

The frontend example file is [`frontend/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/frontend/.env.example).

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `API_BASE_PATH` | Yes | frontend runtime | Base URL for the API from the frontend server. Used in server-side API clients and `handleFetch`. |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | frontend build and runtime | Public Clerk key for the browser app. The Docker build passes this as a build arg. |
| `CLERK_SECRET_KEY` | Yes | frontend runtime | Private Clerk key used by `svelte-clerk/server`. Keep this secret. |
| `PORT` | No | frontend runtime | Optional Node server port when using the built app. |
| `DEPLOY_TO_AZURE` | Build-only | frontend build | Used by `svelte.config.js` to switch to the Node adapter during container builds. The checked-in Dockerfile already sets this when building. |

## API Variables

The API reads configuration through ASP.NET configuration providers. In containers, use environment variables with `__` in place of `:`.

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `ConnectionStrings__ApiDbContext` | Yes | API runtime | PostgreSQL connection string for the main application database. |
| `Authorization__Issuer` | Yes | API runtime | JWT issuer URL. This must match your Clerk issuer exactly. |
| `MMRCalculationAPI__BaseUrl` | Yes | API runtime | Base URL for the Go MMR service. |
| `MMRCalculationAPI__ApiKey` | Yes | API runtime | Shared secret sent as `X-API-KEY` to the MMR service. |
| `Migration__Enabled` | Recommended | API runtime | When `true`, the API applies EF Core migrations on startup. |
| `ASPNETCORE_URLS` | Recommended in containers | API runtime | Explicit listener URL, for example `http://+:8080`. |
| `ASPNETCORE_ENVIRONMENT` | No | API runtime | Standard ASP.NET environment selection. |

## MMR API Variables

The Go MMR service currently has one checked-in example variable in [`mmr-api/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/.env.example).

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `ADMIN_SECRET` | Yes | mmr-api runtime | Shared secret expected by the MMR API. This must match `MMRCalculationAPI__ApiKey` in the ASP.NET API. |

## Development Defaults In The Repo

Useful checked-in defaults:

- [`api/MMRProject.Api/appsettings.json`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/appsettings.json)
- [`api/MMRProject.Api/appsettings.Development.json`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/appsettings.Development.json)
- [`frontend/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/frontend/.env.example)

The development API config assumes:

- PostgreSQL on `localhost`
- MMR API on `http://localhost:8080`
- migrations enabled on startup

## Variables You Can Ignore For V3 Self-Hosting

There are older or adjacent files in the repo that are not part of the normal V3 self-host path, for example the root [`.env.example`](https://github.com/office-rivals/mmr-project/blob/main/.env.example) with Supabase-related values. The current frontend and API self-host flow documented here is Clerk-based.

## Good Practices

- keep production secrets out of Git
- use separate values per environment
- prefer explicit service URLs instead of relying on defaults
- keep the Clerk issuer, publishable key, and secret key aligned to the same Clerk application
- treat `MMRCalculationAPI__ApiKey` and `ADMIN_SECRET` as one shared credential pair

For auth-specific setup guidance, continue to [Authentication](/configuration/authentication/).
