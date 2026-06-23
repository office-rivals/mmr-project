# AGENTS.md

## Public repo

This repository is public. Do not check in references to specific deployments or
production data — org/league slugs, tenant/subscription IDs, resource group,
server or database names, admin usernames, real user emails, or anything that
names a live environment. Use placeholders in docs and require
deployment-specific values via env vars or CLI args in scripts.

## Project Overview

Three-service matchmaking and rating system:

- **Frontend**: SvelteKit + Svelte 5 + TypeScript + TailwindCSS
- **API**: ASP.NET Core — business logic and data persistence
- **MMR API**: Go — MMR calculations and team balancing

## Development Commands

### Recommended: the Aspire AppHost

One command starts and wires the whole stack — PostgreSQL, the MMR API (Go), the
API (ASP.NET Core) and the frontend (SvelteKit):

```bash
dotnet run --project local-dev/MMRProject.AppHost
```

This launches the .NET Aspire dashboard (logs, traces, metrics and endpoint
links) and injects every service's config, so no per-service `.env` wiring is
required. One-time setup (prerequisites and Clerk keys for sign-in) is
documented in [`local-dev/README.md`](local-dev/README.md).

### Running a single service

Useful for fast iteration on one service. Outside the AppHost you must supply
that service's configuration yourself (see [Configuration](#configuration)).

```bash
# Frontend — cd frontend
npm install
npm run dev              # dev server on http://localhost:5173
npm run build            # production build
npm run check            # type checking (svelte-check)
npm run lint             # ESLint + Prettier
npm run format           # Prettier
npm run generate-api     # regenerate the TS API client from the API's swagger.json
```

```bash
# API — cd api/MMRProject.Api
dotnet restore
dotnet run               # API on http://localhost:8081 (Swagger UI at /swagger)
dotnet build
dotnet ef migrations add <MigrationName> -o Data/Migrations -c ApiDbContext
```

```bash
# MMR API — cd mmr-api
go run main.go           # MMR API on http://localhost:8080
go test ./...            # all tests (single package: go test ./test/mmr)
```

Regenerate the frontend API client (`npm run generate-api`) after any API change.

### Database

The AppHost provisions PostgreSQL (persisted in a Docker volume) and the API
applies EF Core migrations on startup when `Migration:Enabled` is true, so the
local database needs no manual setup — inspect or open a shell on it from the
Postgres resource in the Aspire dashboard.

```bash
# Import production data into a target database
./scripts/import-prod-data.sh <resource-group> <server-name> <db-name> <tenant-id> <subscription-id> <username>
```

## Architecture

### Authentication

- Clerk for auth; the API validates JWT bearer tokens (`Program.cs`, `builder.AddAuth()`).
- Frontend: `hooks.server.ts` runs Clerk auth, auth guards and API-client injection into `event.locals`; protected routes live under `routes/(authed)/`.
- API: the authenticated user is resolved from JWT claims via `IUserContextResolver`.
- **RBAC** — three roles (User, Moderator, Owner): `routes/admin/+layout.server.ts` gates admin routes to Moderator/Owner; the role-management page is Owner-only.

### Frontend

- Svelte 5 runes and snippets; TailwindCSS with HSL color variables; dark mode via a `dark` class on the root element (used by the admin UI).
- Headless components from `bits-ui` plus custom styled components in `lib/components/ui/`; icons from `lucide-svelte`.
- Typed API clients generated from the API's OpenAPI spec (`openapi-generator-cli`); created in `lib/server/api/apiClient.ts` with automatic JWT injection.
- Routes: `(authed)/` (shared layout — navbar, queue indicator), `admin/` (separate group, dark mode), `login/`.

### API

- Service-layer pattern: controllers delegate to services (e.g. `IMatchMakingService`, `ISeasonService`).
- EF Core `ApiDbContext` over PostgreSQL; global soft-delete query filters on `DeletedAt`.
- `MatchMakingBackgroundService` runs matchmaking asynchronously.
- Calls the MMR API via `IMMRCalculationApiClient` (API-key auth).

### MMR API

- Gin HTTP framework; MMR via the `go-openskill` library plus custom logic in `mmrCustom/`.
- Config loaded from `.env` (`config.LoadEnv()`); API-key auth via `ADMIN_SECRET`.

### Data Model

Core entities in `api/MMRProject.Api/Data/Entities/`: **Player** (profile + MMR
mu/sigma/mmr, linked to Clerk via `IdentityUserId`), **Season**, **Match** (two
teams + season), **Team** (two players, score, winner flag), **PlayerHistory**
(MMR snapshots per match), **MmrCalculation** (per-player MMR deltas),
**QueuedPlayer**, **ActiveMatch**, **PendingMatch**, **PersonalAccessToken**.

## Configuration

The AppHost injects everything below except Clerk keys (set those via AppHost
user-secrets — see [`local-dev/README.md`](local-dev/README.md)). These values
only matter when running a service standalone.

**Frontend (`.env`)**

```
PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk_publishable_key>
CLERK_SECRET_KEY=<clerk_secret_key>
API_BASE_PATH=http://localhost:8081
```

**API (`appsettings.Development.json`)**

```json
{
  "ConnectionStrings": {
    "ApiDbContext": "Host=localhost;Database=mmr_project;Username=postgres;Password=<password>"
  },
  "Admin": { "Secret": "<admin_secret>" },
  "Migration": { "Enabled": true },
  "MMRCalculationAPI": { "BaseUrl": "http://localhost:8080", "ApiKey": "<mmr_api_key>" }
}
```

**API user-secret (required)** — the Clerk issuer URL (Clerk Dashboard → API
Keys, e.g. `https://your-app.clerk.accounts.dev`):

```bash
cd api/MMRProject.Api
dotnet user-secrets set "Authorization:Issuer" "<clerk_issuer_url>"
```

**MMR API (`.env`)**

```
ADMIN_SECRET=<admin_secret>
```

## Testing

- **API**: Bruno collection in `api-collection/`.
- **MMR API**: Go tests in `mmr-api/test/` (packages: api, custom, mmr, openskill).
- **Frontend**: Vitest (configured, lightly used).

## Deployment

Releases use changeset files in `.changeset/`. A feature PR includes a changeset
specifying per-component bump types; merging to main opens an automated release
PR, and merging that PR creates per-component GitHub Releases. Deployment to
Azure Container Apps is manual via the `Deploy Release` workflow (pick a
component and version from an existing GitHub Release tag).

**Do not manually bump component versions.** The release PR workflow
(`scripts/release/apply-changesets.mjs`) owns the `version` field in each
component's `package.json`, the `<Version>` in `MMRProject.Api.csproj`, and the
per-component `CHANGELOG.md` files — manual edits are overwritten on the next
release PR. Add a `.changeset/*.md` describing the change and let the release PR
compute the bump. (Editing `dependencies` / `devDependencies` is unrelated and
remains manual.)

**Infra/test-only PRs** (seed fixtures, e2e specs, CI, internal scripts, docs
that don't affect a deployed component) skip the changeset and apply the
`no-release` label instead — the release PR only fires when a changeset file
exists.
