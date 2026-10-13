---
title: Reference
description: Lower-level technical material on the API design, the v3 data migration and local development.
---

These pages go deeper than the guides. Use them when you need implementation detail rather than setup or operating instructions.

- [API design](/reference/api-design/): the original design document behind the v3 API, covering multi-tenancy, endpoint layout, authorization and conventions.
- [V3 migration guide](/reference/v3-migration-guide/): how to move a pre-v3, single-tenant database onto the organizations-and-leagues model.
- [Local development](/reference/local-development/): seed a local database with deterministic test data and run the Playwright end-to-end suite.

## Related scripts

The v3 migration uses two SQL scripts:

- [`scripts/backfill-legacy-data.sql`](https://github.com/office-rivals/mmr-project/blob/main/scripts/backfill-legacy-data.sql) copies legacy data into the v3 tables.
- [`scripts/verify-migration.sql`](https://github.com/office-rivals/mmr-project/blob/main/scripts/verify-migration.sql) checks the result.

Local development uses [`scripts/seed-local.sh`](https://github.com/office-rivals/mmr-project/blob/main/scripts/seed-local.sh), which applies the test fixture in [`scripts/seed-data.sql`](https://github.com/office-rivals/mmr-project/blob/main/scripts/seed-data.sql).
