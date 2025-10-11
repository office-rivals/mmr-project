# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a matchmaking and rating system with three main components:
- **Frontend**: SvelteKit application with TypeScript and TailwindCSS
- **API**: ASP.NET Core service (C#) handling business logic and data
- **MMR API**: Go service for MMR calculations and team balancing

## Common Commands

### Frontend (SvelteKit)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start dev server on http://localhost:5173
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format with Prettier
npm run check        # Type check with svelte-check
npm run generate-api # Generate TypeScript API client from Swagger
```

### API (.NET)
```bash
cd api/MMRProject.Api
dotnet run                    # Start API on http://localhost:8081 (migrations run automatically on startup)
dotnet build                  # Build the project
dotnet test                   # Run tests
dotnet ef migrations add <name> -o Data/Migrations -c ApiDbContext  # Create migration (do NOT manually run migrations - they auto-run on startup)
```

### MMR API (Go)
```bash
cd mmr-api
go run main.go       # Start MMR API on http://localhost:8080
go test ./...        # Run tests
go build             # Build binary
```

### Database
```bash
cd local-development && docker-compose up  # Start local Postgres
```

## Architecture

### Frontend Structure
- **Routes**: File-based routing in `frontend/src/routes`
  - `(authed)/`: Protected routes requiring authentication (profile, matchmaking, statistics, etc.)
  - `login/`, `signup/`: Public authentication pages
- **API Client**: OpenAPI-generated TypeScript client in `frontend/src/api`
- **Server API**: Server-side API helpers in `frontend/src/lib/server/api/apiClient.ts`
- **Layout**: `hooks.server.ts` handles authentication via Clerk

### API (.NET) Structure
- **Services**: Business logic in `Services/` directory
  - `MatchesService`: Match creation and management
  - `MatchMakingService`: Queue and matchmaking logic
  - `SeasonService`: Season management
  - `StatisticsService`: Player statistics
  - `UserService`: Player/user management (currently being migrated from "user" to "player" terminology)
- **Controllers**: HTTP endpoints in `Controllers/` directory
- **Background Services**: `MatchMakingBackgroundService` runs continuous matchmaking
- **Data**: Entity Framework Core DbContext and entities in `Data/`
  - Entities: Match, Team, Player, Season, MmrCalculation, PlayerHistory, QueuedPlayer, PendingMatch, ActiveMatch, PersonalAccessToken
- **DTOs**: Request/response models in `DTOs/`
- **Migrations**: Database migrations auto-run on startup if `Migration:Enabled` is true (NEVER manually run migrations)
- **Auth**: Multiple authentication handlers in `Auth/` directory
  - `PersonalAccessTokenAuthenticationHandler`: Handles PAT authentication
  - `BuilderExtensions`: Configures multi-scheme authentication with policy-based selection
- **Configuration**: Uses user-secrets for Clerk authentication (other config in appsettings.Development.json)
  - Required user-secret: `Authorization:Issuer` (Clerk issuer URL)
  - Set via: `dotnet user-secrets set "Authorization:Issuer" "<clerk_issuer_url>"`

### MMR API (Go) Structure
- **Server**: Gin HTTP server setup in `server/`
- **Controllers**: HTTP handlers in `controllers/`
- **MMR Logic**: Core calculation in `mmr/` directory
  - Uses OpenSkill library (github.com/intinig/go-openskill)
  - Handles player ratings (mu, sigma), team balancing, and MMR deltas
- **Custom MMR**: Additional MMR logic in `mmrCustom/`
- **Middleware**: Authentication and other middleware
- **Swagger**: API documentation at `/swagger/index.html`

### Key Concepts
- **Authentication**: Multiple authentication schemes supported:
  - Clerk JWT (default): For user login via web UI
  - Personal Access Tokens (PAT): For programmatic API access (format: `pat_<64chars>`)
  - Both use multi-scheme authentication with automatic selection based on token format
- **MMR System**: Uses Bayesian skill rating with mu (mean skill) and sigma (uncertainty)
- **Matchmaking**: Background service polls QueuedPlayers and creates balanced matches via MMR API
- **Seasons**: Matches are scoped to seasons; statistics calculated per season
- **Teams**: Always 2v2 format (PlayerOne + PlayerTwo per team)
- **Migration in Progress**: Renaming "User" terminology to "Player" throughout codebase

### Service Communication
- Frontend → API: OpenAPI-generated client with JWT bearer tokens
- API → MMR API: HttpClient with X-API-KEY header authentication
- API → Database: Entity Framework Core with Npgsql (PostgreSQL)

### Database
- PostgreSQL via Docker (local) or Azure (production)
- Soft deletes on most entities (DeletedAt column with query filters)
- Auto-migrations enabled in development via Program.cs

## Development Workflow

Start services in this order: **Database → MMR API → .NET API → Frontend** (see Common Commands above for exact commands)

## Testing
- **API**: Bruno collection in `api-collection/` directory
- **MMR API**: Go test files in `test/` directory
- **Frontend**: Svelte testing with Vitest/Playwright (configured but not extensively used)

## Important Notes
- API runs on port 8081, MMR API on 8080, Frontend on 5173
- Swagger UI available at http://localhost:8081/swagger when .NET API running
- .NET API uses user-secrets for `Authorization:Issuer` only; Frontend and MMR API use `.env` files (see `.env.example` files)
- All API endpoints require authentication except Swagger endpoint
- Background matchmaking service runs automatically when API starts
