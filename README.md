# MMR Project

This repository contains a matchmaking and rating system split into three main components:

1. **Frontend**: SvelteKit web application
2. **API**: ASP.NET Core service handling business logic and data
3. **MMR API**: Go service specializing in MMR calculations and team balancing

## Project Structure

```
/
├── frontend/           # SvelteKit web application
├── api/               # ASP.NET Core API service
├── mmr-api/           # Go MMR calculation service
├── local-development/ # Local development setup
└── api-collection/    # API test collection
```

## Getting Started

### Prerequisites

- Node.js 22+ for frontend and release tooling
- .NET 8+ for API
- Go 1.23+ for MMR API
- Docker for local services
- PostgreSQL client

### Local Development

The application uses Clerk for authentication. Follow these steps to get started:

1. Set up a Clerk account at [clerk.com](https://clerk.com) and create an application
2. Start local PostgreSQL database:
   ```bash
   cd local-development
   docker-compose up
   ```
3. Configure environment variables:
   - Frontend (.env):
     ```bash
     PUBLIC_CLERK_PUBLISHABLE_KEY=<your_clerk_publishable_key>
     CLERK_SECRET_KEY=<your_clerk_secret_key>
     API_BASE_PATH=http://localhost:8081
     ```
   - API (appsettings.Development.json):
     ```json
     {
       "ConnectionStrings": {
         "ApiDbContext": "Host=localhost;Database=mmr_project;Username=postgres;Password=<your_db_password>"
       },
       "Admin": {
         "Secret": "<your_admin_secret>"
       },
       "Migration": {
         "Enabled": true
       },
       "MMRCalculationAPI": {
         "BaseUrl": "http://localhost:8080",
         "ApiKey": "<your_mmr_api_key>"
       }
     }
     ```
   - API (user-secrets - required for Clerk):
     ```bash
     cd api/MMRProject.Api
     dotnet user-secrets set "Authorization:Issuer" "<your_clerk_issuer_url>"
     ```
     Note: The Clerk issuer URL can be found in your Clerk Dashboard under API Keys (e.g., `https://your-app.clerk.accounts.dev`)
   - MMR API (.env):
     ```bash
     ADMIN_SECRET=<your_admin_secret>
     ```

### Starting the Services

1. Start the MMR API:

   ```bash
   cd mmr-api
   go run main.go
   ```

2. Start the API:

   ```bash
   cd api/MMRProject.Api
   dotnet run
   ```

3. Start the frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Try Locally With Docker Compose

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

`mmr-api` exposes `GET /health` returning `200 OK`. The endpoint is excluded from the access log and is intended as the liveness/readiness probe target for the `mmr-api-prod` Container App.

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

- [Swagger UI](http://localhost:5000/swagger) for API documentation
- [Bruno Collection](./api-collection) for API testing
- [Local Development](./local-development) for development setup
