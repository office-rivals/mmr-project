---
title: Docker Compose
description: An example Docker Compose setup that builds MMR Project from the repository's Dockerfiles.
---

The repository doesn't ship a production Compose file. The only checked-in one, [`local-development/docker-compose.e2e.yml`](https://github.com/office-rivals/mmr-project/blob/main/local-development/docker-compose.e2e.yml), starts a database for the end-to-end tests. The example below runs the whole stack and builds each service from its Dockerfile.

## Example compose file

Save this as `compose.yaml` in the root of a checkout of the repository, so the build contexts resolve:

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: mmr_project
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d mmr_project"]
      interval: 5s
      timeout: 5s
      retries: 10

  mmr-api:
    build: ./mmr-api
    restart: unless-stopped
    environment:
      ADMIN_SECRET: ${ADMIN_SECRET}

  api:
    build: ./api/MMRProject.Api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      mmr-api:
        condition: service_started
    environment:
      ConnectionStrings__ApiDbContext: Host=postgres;Database=mmr_project;Username=postgres;Password=${POSTGRES_PASSWORD}
      Authorization__Issuer: ${CLERK_ISSUER}
      MMRCalculationAPI__BaseUrl: http://mmr-api:8080
      MMRCalculationAPI__ApiKey: ${ADMIN_SECRET}
      Migration__Enabled: "true"
    ports:
      - "127.0.0.1:8081:8080"

  frontend:
    build: ./frontend-beta
    restart: unless-stopped
    depends_on:
      - api
    environment:
      API_BASE_PATH: http://api:8080
      CLERK_PUBLISHABLE_KEY: ${CLERK_PUBLISHABLE_KEY}
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
      CLERK_SIGN_IN_URL: /login
      CLERK_SIGN_UP_URL: /sign-up
      APP_ORIGIN: https://app.example.com
      CLERK_AUTHORIZED_PARTIES: https://app.example.com
      TRUST_PROXY: "false"
    ports:
      - "127.0.0.1:3000:3000"

volumes:
  postgres-data:
```

Put the secrets in a `.env` file next to it, which Compose reads automatically. Keep this file out of version control:

```bash
POSTGRES_PASSWORD=change-me
ADMIN_SECRET=change-me-too
CLERK_ISSUER=https://your-app.clerk.accounts.dev
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

Replace `https://app.example.com` with your public origin, then start the stack:

```bash
docker compose up -d --build
```

## Service notes

### `postgres`

This is the only stateful service. Keep its volume, and back it up; see [Backups and upgrades](/operations/backups-and-upgrades/). You can use a managed PostgreSQL instead and point `ConnectionStrings__ApiDbContext` at it.

### `mmr-api`

The MMR API listens on port `8080` (set `MMR_API_PORT` to change it). It exits on startup if `ADMIN_SECRET` is unset, and rejects any request whose `X-API-KEY` header doesn't match it. It doesn't need a published port; only the API calls it.

### `api`

The API:

- listens on port `8080`, the .NET image's default
- applies EF Core migrations on startup when `Migration__Enabled` is `true`
- runs the matchmaking worker in the background
- validates Clerk JWTs against `Authorization__Issuer`, so it needs outbound HTTPS to Clerk
- sends `MMRCalculationAPI__ApiKey` to the MMR API, so it must equal `ADMIN_SECRET`

Its published port is bound to `127.0.0.1` for Swagger and health checks from the host. Remove it if you don't need that, or put it behind the proxy if you want [personal access tokens](/features/access-control-and-tokens/) to work from outside.

### `frontend`

The frontend image reads all its configuration at runtime, so you build it once with no credentials. It listens on port `3000` and has a built-in container health check on `/health`. `API_BASE_PATH` points at the API over the internal network; browsers never call the API directly.

## TLS and the reverse proxy

Terminate TLS in a reverse proxy in front of the `frontend` service, and keep the other services on the private Compose network.

- Set `APP_ORIGIN` to the public HTTPS origin, without a path. The frontend uses it for Clerk and form origin checks, and drops forwarded host and protocol headers.
- Keep `TRUST_PROXY=false` when `APP_ORIGIN` is set; that is the setup the frontend's README recommends for a fixed public hostname. `TRUST_PROXY` also accepts `true`, `loopback` or a comma-separated list of proxy IP addresses; any other value stops the frontend from starting.
- Set `CLERK_AUTHORIZED_PARTIES` to the origins allowed to mint session tokens, usually just your public origin.
- Use a Clerk application configured for your public domain.

The flow is:

1. the browser connects to the reverse proxy over HTTPS
2. the proxy forwards to `frontend` on port 3000
3. `frontend` calls `api`
4. `api` calls `postgres` and `mmr-api`

## First boot checklist

After `docker compose up -d --build`:

- `docker compose ps` shows the `frontend` container as healthy.
- `curl -i http://localhost:8081/health` returns `200`, and `/ready` returns `200` once the API can reach PostgreSQL.
- `curl -i http://localhost:8081/api/v3/me` returns `401 Unauthorized`, not a server error.
- `docker compose logs api` shows no `Missing Authorization:Issuer configuration` errors, and migrations completed.
- `http://localhost:8081/swagger` loads.
- Your public URL redirects to `/login`, and you can sign in.

Then create your first organization through the API, as described in the [Quick start](/quick-start/#4-create-your-first-organization), using your public frontend and `http://localhost:8081` as the API address.

## Next steps

- [Environment variables](/configuration/environment-variables/)
- [Authentication](/configuration/authentication/)
- [Backups and upgrades](/operations/backups-and-upgrades/)
