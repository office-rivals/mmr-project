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
├── api-collection/    # API test collection
└── supabase/         # Database configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ for frontend
- .NET 7+ for API
- Go 1.20+ for MMR API
- Docker for local services
- PostgreSQL client

### Local Development

Since we are using Supabase for authentication you will need to start Supabase locally. Follow these steps to get started:

1. Install the Supabase CLI ([install guide](https://supabase.com/docs/guides/cli/getting-started))
2. Start Supabase:
   ```bash
   supabase start
   ```
3. Configure environment variables:
   - Frontend (.env):
     ```
     PUBLIC_SUPABASE_URL=<your_supabase_project_url>
     PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
     API_BASE_PATH=http://localhost:8081
     ```
   - API (appsettings.Development.json):
     ```json
     {
       "ConnectionStrings": {
         "ApiDbContext": "Host=localhost;Database=mmr_project;Username=postgres;Password=<your_db_password>"
       },
       "Supabase": {
         "SignatureKey": "<your_jwt_signature_key>"
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
   - MMR API (.env):
     ```
     ADMIN_SECRET=<your_admin_secret>
     ```

You can now visit your local Supabase Dashboard at [http://localhost:54323/](http://localhost:54323/).

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

## Testing

- API tests using Bruno collection
- MMR API tests using Go test framework
- Frontend tests with Vitest and Playwright
- Integration tests across services

## Deployment

### Frontend

- Auto-deploys to Azure Container Apps on merges to main
- Containerized SvelteKit application
- Zero-downtime updates
- Auto-scaling enabled
- Application monitoring
- Environment configuration

### API

- Auto-deploys to Azure Container Apps on merges to main
- Containerized service
- Built-in auto-scaling
- Zero-downtime updates
- Health monitoring
- Virtual network integration

### MMR API

- Auto-deploys to Azure Container Apps on merges to main
- Containerized calculation service
- Horizontal pod autoscaling
- Application Insights integration
- High availability
- Resource governance

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
