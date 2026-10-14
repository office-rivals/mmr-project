---
title: Backups and upgrades
description: Back up the database, apply schema migrations and upgrade MMR Project safely.
---

The PostgreSQL database is the only stateful part of an MMR Project deployment. The API, the MMR API and the frontend keep nothing on disk, so you can rebuild or replace their containers at any time. You can't recreate the database.

## What to back up

- **The PostgreSQL database.** It holds users, organizations, memberships, invite links, leagues, seasons, matches, rating history, match flags, matchmaking state and personal access tokens. Tokens are stored as hashes, but the `users` table holds email addresses and names, so protect backups like the live database.
- **Your configuration and secrets**: the database connection string, the shared secret between the API and the MMR API, and your Clerk keys and issuer.
- **Your deployment definitions**, such as your Compose file.

User accounts themselves live in Clerk. The database links each user to Clerk by their Clerk user ID, so restore into a deployment that uses the same Clerk instance.

Back up on a schedule that matches how much match history you can afford to lose, and test that you can restore.

## Restore drill

A restore drill should show that you can:

1. Restore a backup into a clean PostgreSQL database.
2. Point the API at it and start it without migration errors.
3. Sign in and open an organization, a league and a recent match.

## Migrations

The API applies Entity Framework Core migrations at startup when `Migration__Enabled=true`. The setting is off unless you set it. Only the `Development` environment turns it on, through `appsettings.Development.json`.

- Migrations run before the API starts serving requests. If one fails, the API exits, so a failed migration shows up as a crash at startup.
- Every API instance with the setting on runs migrations at startup. With more than one replica, turn it on for one instance only, or run migrations as a separate step.
- To apply migrations yourself, run `dotnet ef database update -c ApiDbContext` (from the `dotnet-ef` tool) in `api/MMRProject.Api`, with the connection string pointing at the target database.
- Deploying an older API version doesn't undo migrations. To roll back a release that changed the schema, restore the backup you took before upgrading.

If you're moving a database from before v3, follow the [V3 migration guide](/reference/v3-migration-guide/).

## Releases

The four components (`api`, `mmr-api`, `frontend-beta` and `frontend`) are versioned and released separately. Each release has a [GitHub Release](https://github.com/office-rivals/mmr-project/releases) and an entry in the component's `CHANGELOG.md`.

Each release also publishes a container image to GitHub Container Registry, tagged with its version and `latest`:

```text
ghcr.io/office-rivals/mmr-project/<component>:<version>
```

Pin version tags rather than `latest`, so you decide when to upgrade.

## Upgrading

Before you upgrade:

1. Read the release notes for each component you're upgrading, and look for new or changed configuration.
2. Take a fresh database backup.

While the new version starts:

- Watch the API's startup logs for migration errors.
- Check the health endpoints. The API serves `/health` (process is up) and `/ready` (database reachable). The MMR API and the beta frontend serve `/health`.

Afterwards, check that:

- users can sign in
- organizations and leagues load
- you can submit a match and ratings update, which needs the API to reach the MMR API
- automation that uses personal access tokens still works
