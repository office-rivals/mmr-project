---
title: Quick Start
description: Get a local or self-hosted Office Rivals instance running quickly.
---

This guide is the fastest path to a working deployment based on the code in this repository.

## What You Need

- Docker and Docker Compose
- a PostgreSQL instance
- a Clerk application for login
- Node.js if you want to run the docs or frontend locally outside containers

## Services You Will Run

The repo is designed around four runtime services:

- `frontend`: SvelteKit web UI
- `api`: ASP.NET Core API and background matchmaking worker
- `mmr-api`: Go service used by the API for MMR calculations
- `postgres`: main application database

The only Compose file currently checked into the repo for local work is [`local-development/docker-compose.yml`](https://github.com/office-rivals/mmr-project/blob/main/local-development/docker-compose.yml), and it only starts PostgreSQL. For a real deployment, you should create your own Compose file or equivalent infrastructure using the Dockerfiles in this repo.

## Fastest Path To First Login

1. Clone the repository.
2. Create a Clerk application and note:
   - the publishable key
   - the secret key
   - the issuer URL
3. Create a deployment-specific Compose file using the example in [Docker Compose](/self-hosting/docker-compose/).
4. Set:
   - `ConnectionStrings__ApiDbContext`
   - `Authorization__Issuer`
   - `MMRCalculationAPI__BaseUrl`
   - `MMRCalculationAPI__ApiKey`
   - `API_BASE_PATH`
   - `PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
5. Start the stack.
6. Let the API apply migrations on startup with `Migration__Enabled=true`.
7. Open the frontend, sign in, and create your first organization.
8. Create one or more leagues.
9. Invite members or share an organization invite code.
10. Have members join leagues and start reporting matches.

## After First Boot

Once the stack is live, the typical first-run sequence is:

1. Create an organization
2. Create leagues
3. Share invite links or email invites
4. Have members join leagues from the league directory
5. Start reporting matches or using matchmaking

## Good First Verifications

Before you call the deployment done, verify:

- the frontend can load after login
- `GET /api/v3/me` on the API returns `401 Unauthorized` before sign-in instead of a server error
- a user can create an organization
- a member can join a league
- a match can be submitted successfully
- the matchmaking queue can create a pending match

For production guidance, continue to [Self-Hosting Overview](/self-hosting/).
