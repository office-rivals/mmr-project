---
title: Self-hosting overview
description: The services you run to host MMR Project yourself, and how they connect.
---

A self-hosted MMR Project instance has four parts you run and one you don't:

- **Frontend**: the web app from `frontend-beta/`, served by a Node server
- **API**: the ASP.NET Core backend, which also runs the matchmaking worker in the background
- **MMR API**: the Go service that calculates rating changes
- **Database**: PostgreSQL, the only stateful part
- **Clerk**: hosted sign-in, which you configure but don't run

## Deployment model

The simplest production layout is:

- a reverse proxy or ingress that terminates TLS
- the frontend container
- the API container
- the MMR API container
- PostgreSQL, in a container or as a managed service

Each service ships a Dockerfile, and [Docker Compose](/self-hosting/docker-compose/) has a working example.

## Runtime topology

1. browser → frontend
2. frontend → API
3. API → PostgreSQL
4. API → MMR API

The browser never calls the API directly: the frontend's server makes every API call with the signed-in user's Clerk token. Only the frontend has to be public. Expose the API as well if you want to reach it with [personal access tokens](/features/access-control-and-tokens/) or use its Swagger UI from outside.

| Service | Listens on (container) | Health endpoints |
| --- | --- | --- |
| Frontend | `3000` (`PORT`) | `/health`: the Node server is up; doesn't check the API |
| API | `8080` (image default) | `/health`: the process is up; `/ready`: the database is reachable |
| MMR API | `8080` (`MMR_API_PORT`) | `/health` |

## Hosting priorities

When you deploy MMR Project, get these right first:

- persistent, backed-up database storage
- TLS at the edge, with the frontend's public origin set in `APP_ORIGIN`
- a Clerk application whose issuer, publishable key and secret key all match
- the same shared secret on the API and the MMR API
- a tested upgrade and backup routine

## Authentication

Sign-in depends on Clerk:

- the frontend uses Clerk's TanStack Start SDK and hosts the sign-in and sign-up pages at `/login` and `/sign-up`
- the API validates Clerk-issued JWTs against `Authorization__Issuer`

You can run the app and its data yourself, but you still need a Clerk application. The codebase doesn't include another identity provider. See [Authentication](/configuration/authentication/).

## Source files that matter

- [`frontend-beta/Dockerfile`](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/Dockerfile) and [`frontend-beta/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/.env.example)
- [`frontend-beta/README.md`](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/README.md), for proxy and origin settings
- [`api/MMRProject.Api/Dockerfile`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/Dockerfile) and [`api/MMRProject.Api/appsettings.json`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/appsettings.json)
- [`mmr-api/Dockerfile`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/Dockerfile) and [`mmr-api/.env.example`](https://github.com/office-rivals/mmr-project/blob/main/mmr-api/.env.example)

## Next steps

- [Docker Compose](/self-hosting/docker-compose/): an example deployment
- [Environment variables](/configuration/environment-variables/): every setting per service
- [Authentication](/configuration/authentication/): Clerk and the API issuer
- [Backups and upgrades](/operations/backups-and-upgrades/)
