# MMR Project

This repository contains a matchmaking and rating system split into three main components:

1. **Frontend**: SvelteKit web application
2. **API**: ASP.NET Core service handling business logic and data
3. **MMR API**: Go service specializing in MMR calculations and team balancing

## Project Structure

```
/
├── frontend/           # SvelteKit web application
├── api/                # ASP.NET Core API service
├── mmr-api/            # Go MMR calculation service
├── local-dev/          # .NET Aspire AppHost (one-command local stack)
├── local-development/  # e2e/CI database compose
└── api-collection/     # API test collection
```

## Getting Started

### Prerequisites

- .NET 10 SDK — runs the API and the Aspire AppHost
- Node.js 24+ — frontend and release tooling
- Go 1.25+ — MMR API
- Docker — the AppHost runs PostgreSQL in a container

No separate Aspire workload or CLI is required: the AppHost restores everything
it needs from NuGet, so `dotnet run` is enough.

### Local Development

The whole stack runs from a single **.NET Aspire AppHost** — PostgreSQL, the MMR
API (Go), the API (ASP.NET Core) and the frontend (SvelteKit) — orchestrated
together with shared configuration, service discovery, and a telemetry
dashboard. This is the one supported local-development workflow.

```bash
dotnet run --project local-dev/MMRProject.AppHost
```

That single command builds and starts every service and opens the Aspire
dashboard with a clickable link to each one (frontend, API `/swagger`, and the
Postgres resource). The AppHost injects the shared admin secret, the Postgres
connection string, the MMR API base URL and the frontend's API base path, and
the API applies its EF Core migrations automatically against the fresh database.
Postgres data persists across runs in a Docker volume.

#### Clerk sign-in (optional, one-time)

The stack boots with placeholder Clerk values so you can explore it immediately.
To actually sign in, create an application at [clerk.com](https://clerk.com) and
store your keys in the AppHost's user-secrets:

```bash
cd local-dev/MMRProject.AppHost
dotnet user-secrets set "Parameters:clerk-publishable-key" "pk_test_..."
dotnet user-secrets set "Parameters:clerk-secret-key" "sk_test_..."
dotnet user-secrets set "Parameters:clerk-issuer" "https://your-app.clerk.accounts.dev"
```

The Clerk issuer URL is in your Clerk Dashboard under **API Keys**. You can
override the shared `admin-secret` parameter the same way if needed. See
[`local-dev/README.md`](local-dev/README.md) for the full reference.

#### Running a single service (advanced)

To iterate on one service without the AppHost, run it directly — see the
per-service commands and the configuration each one expects in
[AGENTS.md](AGENTS.md#development-commands). You are then responsible for
supplying that service's configuration yourself.

### Try the released images with Docker Compose

This path runs the **published release images** (no source checkout or local
toolchain needed) and is meant for evaluation, not development — for development
use the Aspire AppHost above.

Each release publishes container images for the frontend, API, and MMR API to
the GitHub Container Registry under `ghcr.io/office-rivals/mmr-project`. You can
run the whole stack from those prebuilt images without a local toolchain.

Create a `.env` file next to the compose file with your Clerk values and local
secrets:

```bash
PUBLIC_CLERK_PUBLISHABLE_KEY=<your_clerk_publishable_key>
CLERK_SECRET_KEY=<your_clerk_secret_key>
CLERK_ISSUER_URL=<your_clerk_issuer_url>
POSTGRES_PASSWORD=local-postgres-password
MMR_ADMIN_SECRET=local-admin-secret
```

Then create this compose file in the repository root. The images use `:latest`;
pin a specific version tag (for example `:1.2.1`) if you need a fixed release.

```yaml
name: mmr-project-local

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: mmr_project
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d mmr_project"]
      interval: 5s
      timeout: 5s
      retries: 20

  mmr-api:
    image: ghcr.io/office-rivals/mmr-project/mmr-api:latest
    restart: unless-stopped
    environment:
      ADMIN_SECRET: ${MMR_ADMIN_SECRET}
      MMR_API_PORT: 8080
    ports:
      - "8080:8080"

  api:
    image: ghcr.io/office-rivals/mmr-project/api:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      mmr-api:
        condition: service_started
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_URLS: http://+:8080
      ConnectionStrings__ApiDbContext: Host=postgres;Port=5432;Database=mmr_project;Username=postgres;Password=${POSTGRES_PASSWORD}
      Authorization__Issuer: ${CLERK_ISSUER_URL}
      Migration__Enabled: "true"
      MMRCalculationAPI__BaseUrl: http://mmr-api:8080
      MMRCalculationAPI__ApiKey: ${MMR_ADMIN_SECRET}
    ports:
      - "8081:8080"

  frontend:
    image: ghcr.io/office-rivals/mmr-project/frontend:latest
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      ORIGIN: http://localhost:3000
      API_BASE_PATH: http://api:8080
      PUBLIC_CLERK_PUBLISHABLE_KEY: ${PUBLIC_CLERK_PUBLISHABLE_KEY}
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
    ports:
      - "3000:3000"

volumes:
  postgres-data:
```

Save it as `docker-compose.local.yml`, then start everything:

```bash
docker compose --env-file .env -f docker-compose.local.yml up
```

Open `http://localhost:3000`. The API is also available at `http://localhost:8081/swagger`.

#### Create the first organization

The deployed UI does not currently include a first-run organization creation
screen. Create the first organization through the API after signing in locally.
The authenticated user that creates the organization becomes its `Owner` and
can then use the admin UI.

1. Open `http://localhost:3000` and sign in with Clerk.
2. Open your browser devtools console on the local frontend.
3. Get a Clerk token:

   ```js
   await window.Clerk.session.getToken()
   ```

4. Use that token to create the organization through the local API:

   ```bash
   curl -X POST "http://localhost:8081/api/v3/organizations" \
     -H "Authorization: Bearer <clerk_token_from_browser>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Local Organization",
       "slug": "local-org"
     }'
   ```

5. Open `http://localhost:3000/admin`. The organization should be listed there.

The `slug` becomes the organization URL segment, for example
`http://localhost:3000/local-org`. Avoid reserved slugs such as `admin`,
`api`, `login`, `join`, `profile`, `settings`, and `submit`.

## Development

### Frontend (SvelteKit)

- Built with TypeScript and TailwindCSS
- Uses OpenAPI generated clients for API communication
- Component-driven architecture
- Protected routes under (authed)

### API (ASP.NET Core)

- Service-based architecture
- Background services for matchmaking
- Entity Framework Core for data access
- JWT authentication

### MMR API (Go)

- Gin framework for HTTP handling
- Custom MMR calculation system
- Swagger documentation
- Testing utilities

## Observability

Both backend services are instrumented with OpenTelemetry and export traces, metrics, and logs over OTLP. The exporters are gated on `OTEL_EXPORTER_OTLP_ENDPOINT` — when it is unset, the services run with stdout-only logging exactly as without instrumentation, so local development and CI are unaffected by default.

What's emitted:

- **Traces**: inbound HTTP, outbound HTTP, EF Core queries (api), Gin handlers (mmr-api).
- **Metrics**: ASP.NET Core, HttpClient, EF Core, .NET runtime, and Go runtime via the OpenTelemetry contrib instrumentations.
- **Logs**: structured per-request entries on both services, correlated to traces via `trace_id` / `span_id`. The `mmr-api` calculation handler additionally logs every MMR calculation's full request and response, so any rating result can be traced back to the inputs that produced it.

To enable export against any OpenTelemetry-compatible backend (Grafana, Honeycomb, Datadog, a local OTel Collector, etc.), set the standard OTel environment variables before starting each service:

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otlp-endpoint
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=..."   # if your backend requires auth
export OTEL_RESOURCE_ATTRIBUTES="deployment.environment=local-$USER"
```

### Production environment variables (mmr-api)

The Container App running `mmr-api` should also have:

- `GIN_MODE=release` — switches Gin out of its default debug mode so it doesn't log `[GIN-debug]` warnings or print routes on startup.

## Health checks

Both backend services expose `GET /health` returning `200 OK` (the API via ASP.NET Core health checks, `mmr-api` via a Gin route). The endpoint is excluded from request tracing (and, on `mmr-api`, the access log), and is the intended liveness/readiness probe target for the Container Apps. The Aspire AppHost uses `/health` on both services for readiness gating, so dependent services start only once their dependencies are healthy.

## Testing

- API tests using Bruno collection
- MMR API tests using Go test framework
- Frontend tests with Vitest and Playwright
- Integration tests across services

## Deployment

- Releases are prepared through changeset files in `.changeset/` and collected in an automated release PR.
- Merging the release PR creates per-component GitHub Releases such as `frontend@0.1.0`.
- Azure deployment is manual and runs from an existing GitHub Release tag.
- The deploy workflow still builds, pushes to ACR, and updates Azure Container Apps in one run.

### Release Flow

1. Add a changeset in feature PRs that should ship.
2. Merge feature PRs into `main`.
3. Let the `Release PR` workflow create or update the release PR.
4. Merge the release PR when you want to publish GitHub Releases.
5. Run `Deploy Release` manually for the component and version you want in Azure.

## Database Management

### Generating Migrations

To create a new database migration:

```bash
cd api/MMRProject.Api
dotnet ef migrations add <migration-name> -o Data/Migrations -c ApiDbContext
```

Alternatively, you can use the helper script:

```bash
cd api/MMRProject.Api
./scripts/addMigration.sh <migration-name>
```

Migrations will be generated in the `Data/Migrations` directory. Make sure to review the generated migration files before committing them.

### Importing Data

To import data from the production database:

```bash
./scripts/import_data.sh <resource-group-name> <prod-server-name> <database-name> <tenant-id> <subscription-id> <username>
```

Note: Username must have access to the production database.

## Additional Resources

- [Bruno Collection](./api-collection) for API testing
- [Local Dev (Aspire AppHost)](./local-dev) for the one-command local stack
