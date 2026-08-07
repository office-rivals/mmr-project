---
title: Backups and Upgrades
description: Protect your data and roll forward safely.
---

The database is the critical asset in an Office Rivals deployment.

## Backups

Back up PostgreSQL on a schedule that matches how much match history you can afford to lose. The application stores tenant data, league state, matches, memberships, seasons, PAT metadata, and rating history in PostgreSQL.

At minimum, have:

- regular automated backups
- tested restore procedures
- a documented retention policy

## What To Back Up

At minimum, protect:

- the PostgreSQL database
- deployment configuration and secret management outside the app
- your Compose or infrastructure definitions

The frontend and API containers themselves are rebuildable from source. The database is not.

## Before Upgrades

Before deploying a new version:

1. Take a fresh backup
2. Review any migration notes
3. Confirm environment variables for new features
4. Confirm the API can still reach the MMR API and Clerk
5. Prefer a maintenance window for schema-heavy changes

## Migrations

The API can apply EF Core migrations automatically on startup when `Migration__Enabled=true`.

This is convenient for small deployments, but you should still think about rollout order:

- on a single API instance, startup migration is usually fine
- on multiple replicas, coordinate startup so you do not create unnecessary migration races

If you are doing the legacy-to-V3 transition, review:

- [V3 Migration Guide](/reference/v3-migration-guide/)
- [`scripts/backfill-legacy-data.sql`](https://github.com/office-rivals/mmr-project/blob/main/scripts/backfill-legacy-data.sql)
- [`scripts/verify-migration.sql`](https://github.com/office-rivals/mmr-project/blob/main/scripts/verify-migration.sql)

## During Upgrades

- watch API startup logs for migration errors
- verify background jobs start normally
- smoke-test login, org access, league access, and match submission
- confirm the frontend can still talk to the API
- confirm the API still reaches the MMR API with the configured shared secret

## After Upgrades

Validate:

- users can sign in
- organizations and leagues render correctly
- match submission still works
- PAT-scoped automation still behaves as expected

## Restore Drill Suggestions

Your restore drill should prove that you can:

1. restore the PostgreSQL backup into a clean database
2. point the API at the restored database
3. start the API successfully without schema mismatches
4. sign in and inspect at least one organization, one league, and one recent match

For migration-specific guidance, see the [V3 Migration Guide](/reference/v3-migration-guide/).
