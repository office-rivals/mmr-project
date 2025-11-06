# AGENTS.md

## Project Overview

Three-service matchmaking and rating system:

- **Frontend**: SvelteKit 2 with Svelte 5 + TypeScript + TailwindCSS web application
- **API**: ASP.NET Core 8 service handling business logic and data persistence
- **MMR API**: Go 1.23 service for MMR calculations and team balancing

## Development Commands

### Frontend (SvelteKit with Svelte 5)

```bash
cd frontend
npm install
npm run dev              # Start dev server on http://localhost:5173
npm run build            # Production build
npm run check            # Type checking with svelte-check
npm run lint             # Lint with ESLint and Prettier
npm run format           # Format code with Prettier
npm run generate-api     # Generate TypeScript API client from http://localhost:8081/swagger/v1/swagger.json
```

### API (ASP.NET Core)

```bash
cd api/MMRProject.Api
dotnet restore
dotnet run               # Start API on http://localhost:8081
dotnet build             # Build the project
dotnet ef migrations add <MigrationName> -o Data/Migrations -c ApiDbContext  # Create migration
```

### MMR API (Go)

```bash
cd mmr-api
go run main.go           # Start MMR API on http://localhost:8080
go test ./...            # Run all tests
go test ./test/mmr       # Run specific test package
```

### Database Management

```bash
# Start local PostgreSQL
cd local-development
docker-compose up

# Import production data
./scripts/import-prod-data.sh <resource-group> <server-name> <db-name> <tenant-id> <subscription-id> <username>
```

## Architecture

### Authentication Flow

- Uses Clerk for authentication (migrated from Supabase)
- Frontend: `hooks.server.ts` handles auth middleware with `svelte-clerk`
- API: JWT bearer token validation configured in `Program.cs` via `builder.AddAuth()`
- Protected routes in frontend under `routes/(authed)/`
- User context resolved via `IUserContextResolver` in API
- **RBAC**: Three-tier role hierarchy (User, Moderator, Owner)
  - Role checks in `routes/admin/+layout.server.ts` redirect unauthenticated users to `/`
  - Admin routes accessible to Moderator and Owner roles
  - Role management page restricted to Owner role only

### Frontend Architecture

- **Svelte 5**: Uses modern Svelte 5 features (runes, snippets)
- **API Client Generation**: TypeScript clients generated from API's OpenAPI spec using `openapi-generator-cli`
- **API Client Creation**: `lib/server/api/apiClient.ts` creates typed API clients with automatic JWT token injection
- **Route Structure**:
  - `routes/(authed)/` - Protected routes requiring authentication with shared layout (navbar, queue indicator)
  - `routes/admin/` - Admin panel routes (separate from authed group, uses dark mode)
  - `routes/login/` - Login page
- **Auth Hooks**: `hooks.server.ts` sequence handles Clerk auth, auth guards, and API client injection into `event.locals`
- **UI Components**:
  - Component library: `bits-ui` for headless components + custom styled components in `lib/components/ui/`
  - Icons: `lucide-svelte` for all icons
  - Styling: TailwindCSS with HSL color variables for theming
  - Dark mode: Applied via `dark` class on root element (admin UI uses dark mode)
  - Reusable components: Button, Card, Input, Label, Table, Badge, Alert, etc.
  - Admin UI: Icon-based sidebar navigation, stat cards, professional dark theme

### API Architecture

- **Service Layer Pattern**: Controllers delegate to services (e.g., `IMatchMakingService`, `ISeasonService`)
- **DbContext**: Entity Framework Core with `ApiDbContext` for PostgreSQL
- **Background Services**: `MatchMakingBackgroundService` runs matchmaking asynchronously
- **External API Integration**: Communicates with MMR API via `IMMRCalculationApiClient` with API key authentication
- **User Context**: `IUserContextResolver` extracts authenticated user from JWT claims
- **Soft Deletes**: Query filters on `DeletedAt` column applied globally in `ApiDbContext.OnModelCreating`

### MMR API Architecture

- **Gin Framework**: HTTP routing and middleware
- **OpenSkill Integration**: Uses `go-openskill` library for MMR calculations
- **Custom MMR**: Custom MMR calculation implementations in `mmrCustom/`
- **Environment Config**: Loaded via `config.LoadEnv()` from `.env` file
- **Admin Secret**: API key authentication via `ADMIN_SECRET` environment variable

### Data Model

Core entities in `api/MMRProject.Api/Data/Entities/`:

- **Player**: User profile with MMR (mu, sigma, mmr), linked to Clerk via `IdentityUserId`
- **Season**: Time-based divisions for matches
- **Match**: Game record with two teams and season
- **Team**: Two players with score and winner flag
- **PlayerHistory**: Historical MMR snapshots per match
- **MmrCalculation**: MMR deltas for each player in a match
- **QueuedPlayer**: Matchmaking queue
- **ActiveMatch**: In-progress matches
- **PendingMatch**: Matches waiting to start
- **PersonalAccessToken**: API tokens for external integrations

## Configuration

### Frontend (.env)

```
PUBLIC_CLERK_PUBLISHABLE_KEY=<clerk_publishable_key>
CLERK_SECRET_KEY=<clerk_secret_key>
API_BASE_PATH=http://localhost:8081
```

### API (appsettings.Development.json)

```json
{
  "ConnectionStrings": {
    "ApiDbContext": "Host=localhost;Database=mmr_project;Username=postgres;Password=<password>"
  },
  "Admin": {
    "Secret": "<admin_secret>"
  },
  "Migration": {
    "Enabled": true
  },
  "MMRCalculationAPI": {
    "BaseUrl": "http://localhost:8080",
    "ApiKey": "<mmr_api_key>"
  }
}
```

### API User Secrets (Required)

```bash
cd api/MMRProject.Api
dotnet user-secrets set "Authorization:Issuer" "<clerk_issuer_url>"
```

The Clerk issuer URL is found in Clerk Dashboard under API Keys (e.g., `https://your-app.clerk.accounts.dev`)

### MMR API (.env)

```
ADMIN_SECRET=<admin_secret>
```

## Testing

- **API**: Bruno collection in `api-collection/` for API testing
- **MMR API**: Go tests in `mmr-api/test/` organized by package (api, custom, mmr, openskill)
- **Frontend**: Component testing with Vitest (configured but not extensively used)

## Deployment

All services auto-deploy to Azure Container Apps on merges to main branch. Each service is containerized with Dockerfiles in their respective directories.

## Important Notes

- Migrations run automatically on API startup when `Migration:Enabled` is true
- Swagger UI available at http://localhost:8081/swagger for API documentation
- Frontend API clients must be regenerated after API changes using `npm run generate-api`
- Local PostgreSQL runs on port 5432 with credentials in docker-compose
- All services use environment-based configuration (appsettings.json, .env files, user-secrets)
