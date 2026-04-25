# V3 Migration Guide

This guide covers migrating from the legacy single-tenant data model to the v3 multi-tenant model with organizations and leagues.

## Overview

The migration involves two steps:

1. **Schema migration** — EF Core migration renames tables (automatic on startup)
2. **Data backfill** — SQL script copies legacy data into the v3 tables

After migration, the legacy tables remain in the database (prefixed with `legacy_`) as a safety net. They can be dropped after the v3 model is verified stable.

## Prerequisites

- The API is deployed with the `RenameTablesRemoveV3Prefix` migration
- Database access with write permissions
- A maintenance window (no active matchmaking during migration)

## Table Rename Summary

The EF Core migration `RenameTablesRemoveV3Prefix` performs these renames:

### Legacy tables → `legacy_*` prefix

| Before | After |
|--------|-------|
| `matches` | `legacy_matches` |
| `seasons` | `legacy_seasons` |
| `teams` | `legacy_teams` |
| `Players` | `legacy_players` |
| `mmr_calculations` | `legacy_mmr_calculations` |
| `player_histories` | `legacy_player_histories` |
| `QueuedPlayers` | `legacy_queued_players` |
| `PendingMatches` | `legacy_pending_matches` |
| `ActiveMatches` | `legacy_active_matches` |
| `PersonalAccessTokens` | `legacy_personal_access_tokens` |
| `MatchFlags` | `legacy_match_flags` |

### V3 tables → remove `v3_` prefix

| Before | After |
|--------|-------|
| `v3_users` | `users` |
| `v3_organizations` | `organizations` |
| `v3_organization_memberships` | `organization_memberships` |
| `v3_leagues` | `leagues` |
| `v3_league_players` | `league_players` |
| `v3_seasons` | `seasons` |
| `v3_matches` | `matches` |
| `v3_match_teams` | `match_teams` |
| `v3_match_team_players` | `match_team_players` |
| `v3_pending_matches` | `pending_matches` |
| `v3_pending_match_teams` | `pending_match_teams` |
| `v3_pending_match_team_players` | `pending_match_team_players` |
| `v3_pending_match_acceptances` | `pending_match_acceptances` |
| `v3_active_matches` | `active_matches` |
| `v3_queue_entries` | `queue_entries` |
| `v3_rating_histories` | `rating_histories` |
| `v3_personal_access_tokens` | `personal_access_tokens` |
| `v3_match_flags` | `match_flags` |
| `v3_organization_invite_links` | `organization_invite_links` |

## Data Backfill

### What the backfill does

The script `scripts/backfill-legacy-data.sql` migrates all legacy data into the v3 model:

1. Creates a **default Organization** (slug: `default`)
2. Creates a **default League** (slug: `default`) in the default org
3. Creates **User** rows for each legacy player with a Clerk identity
4. Creates **OrganizationMembership** for every legacy player (claimed and unclaimed)
5. Creates **LeaguePlayer** for every legacy player with their current MMR/Mu/Sigma
6. Migrates all **Seasons** into the default league
7. Migrates all **Matches** — each legacy match becomes:
   - 1 `matches` row
   - 2 `match_teams` rows (team_one at index 0, team_two at index 1)
   - Up to 4 `match_team_players` rows (skipping null player slots)
8. Migrates **Rating History** — each `MmrCalculation` is "exploded" into up to 4 `rating_histories` rows, one per player, with `Delta` from the positional slot and `Mmr`/`Mu`/`Sigma` from the corresponding `PlayerHistory` row
9. Migrates **Personal Access Tokens** (skipping orphaned PATs from players without identities)

### Role mapping

| Legacy `PlayerRole` | V3 `OrganizationRole` |
|---------------------|----------------------|
| User (0) | Member (2) |
| Moderator (1) | Moderator (1) |
| Owner (2) | Owner (0) |

### Unclaimed players

Legacy players without a Clerk identity are migrated as:
- `OrganizationMembership` with `user_id = NULL` and `status = Invited (0)`
- `invite_email` populated from the legacy email field
- These can be claimed later through the invite/claim flow

### Matchmaking state

Matchmaking state (queue, pending matches, active matches) is **not migrated**. It starts fresh on the v3 model. Schedule the migration during a window with no active matches.

## Running the migration

Run the entire migration during a **maintenance window** with no active users or matchmaking. This is a single-step cutover: schema rename, backfill, verify, then bring the API back online.

### 1. Enter maintenance mode

Stop the API to ensure no new data is written during migration.

### 2. Deploy the API (without starting it)

Deploy the new API build. On first startup, EF Core will apply `RenameTablesRemoveV3Prefix` which renames all tables. You can either:
- Start the API briefly to apply the migration, then stop it
- Run `dotnet ef database update` directly

### 3. Run the backfill script

```bash
psql -h <host> -U <user> -d <db> -f scripts/backfill-legacy-data.sql
```

The script runs in a single transaction and prints a summary at the end:

```
=== Migration Summary ===
Legacy players:        82
Users created:         59
Memberships created:   83
League players:        82
Seasons:               7
Legacy matches:        5351
Matches migrated:      5351
Match teams:           10702 (expect ~2x matches)
Match team players:    21404 (expect ~4x matches)
Rating histories:      21404 (expect ~4x matches)
PATs:                  2
=========================
```

Check that:
- `Users created` ≈ number of claimed legacy players
- `Memberships created` ≈ total legacy players (claimed + unclaimed)
- `League players` = total legacy players
- `Matches migrated` = legacy matches
- `Match teams` ≈ 2× matches
- `Match team players` ≈ 4× matches (less if some matches had null player slots)
- `Rating histories` ≈ 4× matches

### 4. Run the verification script

```bash
psql -h <host> -U <user> -d <db> -f scripts/verify-migration.sql
```

This runs 17 checks covering:
- Every legacy player has a user, membership, and league player
- Every match is migrated with correct teams, scores, and player links
- Every season is migrated
- Rating history deltas and snapshots match source data
- Role mapping and membership status are correct
- All migrated entities belong to the default org

All checks must pass before proceeding.

### 5. Start the API

Start the API. Matchmaking state (queue, pending matches, active matches) starts fresh.

### Re-running the backfill

The backfill script is **idempotent** — it uses `NOT EXISTS` checks and `legacy_*_id` columns to skip already-migrated rows. Safe to re-run at any time.

## Post-migration

### Update organization name and slug

The default organization is created with name `Default` and slug `default`. Update these to match your organization:

```sql
UPDATE organizations SET name = 'Your Org Name', slug = 'your-org-slug' WHERE slug = 'default';
```

Similarly for the default league:

```sql
UPDATE leagues SET name = 'Your League Name', slug = 'your-league-slug'
WHERE slug = 'default'
  AND organization_id = (SELECT id FROM organizations WHERE slug = 'your-org-slug');
```

### Legacy table cleanup

Legacy tables are retained as a safety net. Once the v3 model is verified stable in production, they can be dropped:

```sql
DROP TABLE IF EXISTS legacy_match_flags CASCADE;
DROP TABLE IF EXISTS legacy_personal_access_tokens CASCADE;
DROP TABLE IF EXISTS legacy_active_matches CASCADE;
DROP TABLE IF EXISTS legacy_queued_players CASCADE;
DROP TABLE IF EXISTS legacy_pending_matches CASCADE;
DROP TABLE IF EXISTS legacy_mmr_calculations CASCADE;
DROP TABLE IF EXISTS legacy_player_histories CASCADE;
DROP TABLE IF EXISTS legacy_matches CASCADE;
DROP TABLE IF EXISTS legacy_teams CASCADE;
DROP TABLE IF EXISTS legacy_players CASCADE;
DROP TABLE IF EXISTS legacy_seasons CASCADE;
```

After dropping legacy tables, the `Legacy*Id` columns on v3 entities can also be removed in a subsequent migration.

## Rollback

If issues are found after migration:

1. The legacy tables remain untouched — no data is modified or deleted from them
2. To revert, redeploy the previous API version which reads from legacy tables
3. The v3 data can be truncated and re-backfilled after fixing issues
