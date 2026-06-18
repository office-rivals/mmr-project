# Local development — .NET Aspire AppHost

`MMRProject.AppHost` is the single entry point for running the whole stack
locally. One command builds and starts every service, wires them together, and
opens a dashboard with logs, traces, metrics and endpoint links.

```bash
dotnet run --project local-dev/MMRProject.AppHost
```

## What it runs

| Resource   | What                          | Notes                                                        |
| ---------- | ----------------------------- | ------------------------------------------------------------ |
| `postgres` | PostgreSQL                    | Persisted in a Docker volume; database `mmr_project`         |
| `mmr-api`  | Go MMR calculation service    | Port injected via `MMR_API_PORT`                             |
| `api`      | ASP.NET Core API              | EF Core migrations apply automatically on startup            |
| `frontend` | SvelteKit dev server (`vite`) | `npm install` runs automatically the first time              |

The dashboard (the URL is printed in the console on startup) is the source of
truth for each service's address — open the `frontend` and `api` links from
there. The API's Swagger UI is at the api endpoint under `/swagger`.

## Prerequisites

- .NET 10 SDK
- Node.js 24+ (the AppHost runs the frontend with your local `npm`)
- Go 1.25+ (the AppHost runs `mmr-api` with your local `go`)
- Docker (PostgreSQL runs in a container)

No separate Aspire workload or CLI install is needed — the AppHost restores its
hosting packages from NuGet.

## How configuration is wired

Everything is provided by the AppHost so the services can't drift out of sync:

- **One shared secret.** The `admin-secret` parameter is injected into both the
  api (`Admin__Secret` and `MMRCalculationAPI__ApiKey`) and the mmr-api
  (`ADMIN_SECRET`). Because they come from a single source, the api↔mmr-api
  authentication can never mismatch.
- **Database.** The Postgres connection string is injected as
  `ConnectionStrings__ApiDbContext`, overriding `appsettings.Development.json`.
- **Service discovery.** `MMRCalculationAPI__BaseUrl` resolves to the mmr-api
  endpoint, and the frontend's `API_BASE_PATH` resolves to the api endpoint.
- **Telemetry.** Aspire injects `OTEL_EXPORTER_OTLP_ENDPOINT` into both backends
  so their existing OpenTelemetry exporters publish traces, metrics and logs
  into the dashboard. The Go service is pinned to the OTLP **HTTP/protobuf**
  endpoint because its exporters speak HTTP, not gRPC.

## Parameters and secrets

Non-secret parameters have safe dev defaults, so the stack boots with a single
command. Override any of them with AppHost user-secrets (or
`Parameters__<name>` environment variables):

| Parameter               | Default                                  | Purpose                                  |
| ----------------------- | ---------------------------------------- | ---------------------------------------- |
| `admin-secret`          | `super-secret-admin`                     | Shared api ↔ mmr-api secret              |
| `postgres-password`     | `this_is_a_hard_password1337`            | Password for the persisted Postgres (on `localhost:5432`) |
| `clerk-publishable-key` | `pk_test_…` (valid-format placeholder)   | Clerk frontend key                       |
| `clerk-secret-key`      | `sk_test_placeholder`                    | Clerk backend key                        |
| `clerk-issuer`          | `https://example.clerk.accounts.dev`     | Clerk issuer URL (api JWT validation)    |

### Clerk sign-in

The placeholders let the stack start, but signing in needs real Clerk values
from an application you create at [clerk.com](https://clerk.com):

```bash
cd local-dev/MMRProject.AppHost
dotnet user-secrets set "Parameters:clerk-publishable-key" "pk_test_..."
dotnet user-secrets set "Parameters:clerk-secret-key" "sk_test_..."
dotnet user-secrets set "Parameters:clerk-issuer" "https://your-app.clerk.accounts.dev"
```

The issuer URL is in the Clerk Dashboard under **API Keys**.

## Resetting the database

Stop the AppHost and remove the Postgres data volume to start from a clean
database (migrations re-apply on the next run):

```bash
docker volume ls | grep mmrproject   # find the volume name
docker volume rm <volume-name>
```

Postgres is published on the host's standard port **5432**. Two gotchas:

- If another Postgres already listens on `5432` (e.g. a Homebrew install), the
  `postgres` resource fails to start — stop that server first.
- Postgres only applies the password when it first initialises an empty volume.
  If you have a leftover volume created with a different password, the API will
  fail to connect (`password authentication failed`); remove the volume as above.

## Creating the first organization

The UI has no first-run organization screen. After signing in, create one via
the API (the authenticated creator becomes its `Owner`). Grab a Clerk token in
the browser devtools console on the frontend:

```js
await window.Clerk.session.getToken();
```

Then call the api (use the api address from the dashboard):

```bash
curl -X POST "<api-endpoint>/api/v3/organizations" \
  -H "Authorization: Bearer <clerk_token_from_browser>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Local Organization", "slug": "local-org" }'
```

Avoid reserved slugs such as `admin`, `api`, `login`, `join`, `profile`,
`settings`, and `submit`.
