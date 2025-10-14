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

- Node.js 18+ for frontend
- .NET 7+ for API
- Go 1.20+ for MMR API
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
