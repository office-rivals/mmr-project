---
title: Docker Compose
description: Suggested structure for running Office Rivals with Docker Compose.
---

Docker Compose is the most straightforward way to self-host Office Rivals from this repository.

## What Exists In The Repo Today

The checked-in Compose file at [`local-development/docker-compose.yml`](https://github.com/office-rivals/mmr-project/blob/main/local-development/docker-compose.yml) only starts PostgreSQL for local development.

For an actual deployment, you will usually write your own Compose file at the repo root or in a separate infrastructure repository. The example below reflects the current runtime needs of the codebase.

## Example Compose File

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: mmr_project
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: change-me
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  mmr-api:
    build:
      context: ./mmr-api
    restart: unless-stopped
    environment:
      ADMIN_SECRET: change-me-shared-secret
    ports:
      - "8080:8080"

  api:
    build:
      context: ./api/MMRProject.Api
    restart: unless-stopped
    depends_on:
      - postgres
      - mmr-api
    environment:
      ASPNETCORE_URLS: http://+:8080
      ConnectionStrings__ApiDbContext: Host=postgres;Database=mmr_project;Username=postgres;Password=change-me
      Authorization__Issuer: https://your-instance.clerk.accounts.dev
      Migration__Enabled: "true"
      MMRCalculationAPI__BaseUrl: http://mmr-api:8080
      MMRCalculationAPI__ApiKey: change-me-shared-secret
    ports:
      - "8081:8080"

  frontend:
    build:
      context: ./frontend
      args:
        PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_xxxxxxxx
    restart: unless-stopped
    depends_on:
      - api
    environment:
      API_BASE_PATH: http://api:8080
      PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_xxxxxxxx
      CLERK_SECRET_KEY: sk_test_xxxxxxxx
      PORT: 3000
    ports:
      - "3000:3000"

volumes:
  postgres-data:
```

## Service Notes

### `postgres`

Persist PostgreSQL data. This is the one stateful service you must back up.

### `mmr-api`

The MMR API uses `ADMIN_SECRET` as its shared secret. The ASP.NET API must use the same value via `MMRCalculationAPI__ApiKey`.

### `api`

The ASP.NET API:

- serves the HTTP API
- applies EF Core migrations on startup when `Migration__Enabled=true`
- runs the background matchmaking worker
- validates Clerk-issued JWTs using `Authorization__Issuer`

### `frontend`

The frontend needs both:

- a runtime `CLERK_SECRET_KEY`
- a `PUBLIC_CLERK_PUBLISHABLE_KEY` at build time so the client bundle knows which Clerk app to use

The checked-in Dockerfile already builds the app with the SvelteKit Node adapter.

## Reverse Proxy

In production, terminate TLS in front of the `frontend` container and keep the internal service network private.

Typical flow:

1. public traffic hits a reverse proxy
2. the proxy forwards web traffic to `frontend`
3. `frontend` talks to `api`
4. `api` talks to `postgres` and `mmr-api`

## First Boot Checklist

After `docker compose up -d`, validate:

- the API starts without `Authorization:Issuer` errors
- the API can connect to PostgreSQL
- the API can reach `mmr-api`
- Swagger loads at `http://localhost:8081/swagger`
- the frontend can complete the Clerk login flow

## What to Validate Before Going Live

- Frontend can reach the API
- API can connect to the database
- API can reach the MMR API
- Authentication redirects use the correct public URLs
- Migrations complete successfully
- Health checks and logs are visible

## Suggested Follow-Up Docs

- [Environment Variables](/configuration/environment-variables/)
- [Authentication](/configuration/authentication/)
- [Backups and Upgrades](/operations/backups-and-upgrades/)
