# Changelog

## 1.0.1

- Bump frontend, api, and mmr-api dependencies to the latest minor/patch
  within their current major. Includes Clerk JS SDK updates that pull in
  patches for GHSA-vqx2-fgx2-5wq9 (middleware route protection bypass)
  and GHSA-w24r-5266-9c3c (authorization bypass).

## 1.0.0

- **Major:** v3 multi-tenancy migration. Breaking changes in both the
  frontend route tree and the public API surface.
  
  ### Multi-tenancy (organizations + leagues)
  
  Every match, player, season, leaderboard, queue, and rating now lives
  under an organization → league hierarchy. Frontend routes move from
  flat-namespace `/random`, `/matchmaking`, etc. to scoped paths under
  `/[orgSlug]/[leagueSlug]/...`. Users can belong to multiple
  organizations with separate ratings per league, gated by the new
  `OrganizationRole` (Owner / Moderator / Member) on `OrganizationMembership`.
  
  ### Legacy v1/v2 API removed
  
  All `/api/v1/*` and `/api/v2/*` endpoints, plus their controllers,
  services, adapters, DTOs, and background services, are deleted.
  Legacy routes return `410 Gone` via `DeprecatedApiController`. Swagger
  is simplified to a v3-only document at `/swagger/v3/swagger.json`. The
  old global `PlayerRole` (User/Moderator/Owner) is replaced by per-org
  `OrganizationRole`.
  
  ### v3 API surface
  
  - 14 new REST controllers under `api/v3/organizations/{orgId}/leagues/{leagueId}/...`
  - Organization-role authorization (`RequireOrgOwner`, `RequireOrgModerator`,
    `RequireOrgMember`, `RequireLeagueAccess`).
  - Organization invite-link flow (Discord-style codes).
  - Per-organization Personal Access Tokens with scope validation.
  - Match flagging migrated to v3 with full CRUD + admin endpoints.
  - League-scoped matchmaking with a transactional pending-match coordinator
    (row-level FOR UPDATE locks; partial unique index on
    `pending_matches(league_id) WHERE status = 0`).
  - Admin match edit + MMR recalc endpoints restored to feature parity with
    the legacy /admin/matches page (`PATCH /matches/{id}`,
    `POST /matches/recalculate?fromMatchId=...`).
  - `LeaderboardEntryResponse` adds `wins`, `losses`, `winningStreak`, `losingStreak`;
    `mmr` is nullable (null until 10 ranked matches).
  - New `GET /rating-history` (league-wide), `GET /matches?leaguePlayerId=`,
    `GET /statistics/time-distribution`.
  
  ### Data migration
  
  - Hand-written EF Core migration renames v3 tables (drops `v3_` prefix)
    and prefixes legacy tables with `legacy_`. No data loss.
  - Idempotent backfill SQL (`scripts/backfill-legacy-data.sql`)
    migrates users, default org + league, memberships, league players
    (with MMR), seasons, matches (normalized teams), rating history
    (exploded from `MmrCalculation`), and PATs.
  - Verification script and migration guide for operators.
  
  ### Frontend rewrite
  
  Every page under `(authed)/` was rewritten against the v3 API client:
  
  - Leaderboard with wins/losses, streak emojis, MMR sparkline, Unranked
    divider, current-user highlight, click-row stats modal, MMR toggle,
    default-current-season behavior.
  - Player profile with extended KPIs (Last match, Streak), opponents and
    teammates tables, match filter, profile player pinned top-left of
    every match card, Settings/Logout, season picker.
  - Statistics: line chart restored + heatmap of match frequency by
    day-of-week and hour-of-day.
  - Submit match: step-by-step UX (player picker → who won → loser score
    → preview), inline new-player dialog with optional email,
    primary-player + last-10-players persistence in localStorage.
  - Active match submit: same step-by-step UX, current user's team rendered
    first.
  - Matchmaking: pending-match accept/decline dialog with per-player
    acceptance status, 30s countdown, sound on match found.
  - Layout: bottom navbar lifted to the (authed) layout so it persists
    across `/random` and `/settings`; queue-size badge on the matchmaking
    icon.
  
  ### Admin tree rebuilt
  
  Legacy `/admin/{users,matches,match-flags}` deleted (was wired to v1/v2
  endpoints that no longer exist). Replaced with a v3-native admin shell
  scoped to organizations and leagues:
  
  ```
  /admin/                                       super-admin landing (placeholder)
  /admin/[orgSlug]/                             org overview
  /admin/[orgSlug]/members/                     members + invite links
  /admin/[orgSlug]/leagues/                     leagues list + create
  /admin/[orgSlug]/leagues/[leagueSlug]/        league overview
  /admin/[orgSlug]/leagues/[leagueSlug]/match-flags/
  /admin/[orgSlug]/leagues/[leagueSlug]/matches/    edit / delete / recalc
  /admin/[orgSlug]/leagues/[leagueSlug]/seasons/    list + create
  ```
  
  Org admin pages enforce `orgRole >= Moderator`; the `/admin` landing
  filters out orgs where the user is only a Member. Match-edit dialog
  allows lineup + score changes and surfaces a "Recalculate season"
  button to replay MMR from the affected match.
  
  ### Tests
  
  - Backend: 109 integration tests across multi-tenancy, authorization,
    matchmaking, match flags, PAT scoping, match edit + recalc
    correctness.
  - Frontend: 35 Playwright e2e tests covering the leaderboard, profile,
    statistics, submit, matchmaking, layout, full admin UI, and RBAC
    (Member-only second org in the seed verifies admin pages return 403).
  - E2E orchestration: `npm run e2e` brings up Postgres
    (docker-compose), the Go MMR API, the .NET API, and the Vite dev
    server in one command via `globalSetup` + Playwright `webServer`.
  - Vendored seed (`scripts/seed-data.sql`) with deterministic players,
    matches, rating histories, two organizations.
  
  See `docs/local-development.md`.

## 0.1.0

- Set up Changesets-based releases and manual deployment from GitHub Releases.
