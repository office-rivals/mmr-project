---
title: Self-Hosting Overview
description: Understand the main moving pieces required to run Office Rivals yourself.
---

Office Rivals is easiest to self-host as four logical parts:

- **Frontend**: the user-facing web app
- **API**: the ASP.NET Core backend and background matchmaking worker
- **MMR API**: the Go service that performs rating and balance calculations
- **Database**: PostgreSQL for application data

## Deployment Model

The simplest production layout is:

- Reverse proxy or ingress
- Frontend container
- API container
- MMR API container
- PostgreSQL database

You may also run the database as a managed service while hosting the app containers yourself.

## Runtime Topology

The runtime dependency chain is:

1. browser -> `frontend`
2. `frontend` -> `api`
3. `api` -> `postgres`
4. `api` -> `mmr-api`

The API also runs background processing for matchmaking, so it is not just a thin request layer.

## Hosting Priorities

When you deploy Office Rivals, optimize for:

- Stable database persistence
- Correct environment variable setup
- Reliable authentication configuration
- Reliable connectivity from API to MMR API
- Safe upgrades and backups
- TLS at the edge

## Current Authentication Constraint

The frontend and API are currently built around Clerk:

- the frontend uses `svelte-clerk`
- the API validates JWTs using `Authorization:Issuer`

That means Office Rivals is self-hostable for the app and data plane, but it still depends on an external Clerk tenant for authentication.

## Source Files That Matter

If you are operating or modifying a deployment, these files are the main reference points:

- [`frontend/Dockerfile`](https://github.com/office-rivals/mmr-project/blob/main/frontend/Dockerfile)
- [`api/MMRProject.Api/Dockerfile`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/Dockerfile)
- [`mmr-api/Dockerfile`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/Dockerfile)
- [`frontend/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/frontend/.env.example)
- [`api/MMRProject.Api/appsettings.Development.json`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/appsettings.Development.json)
- [`local-development/docker-compose.yml`](https://github.com/office-rivals/mmr-project/blob/main/local-development/docker-compose.yml)

## Next Steps

- Use [Docker Compose](/self-hosting/docker-compose/) for the practical setup shape
- Review [Environment Variables](/configuration/environment-variables/)
- Configure [Authentication](/configuration/authentication/)
- Read [Backups and Upgrades](/operations/backups-and-upgrades/)
