# Brief: backend

You are `backend`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md` (especially the last two
sections), `team/INTERFACES.md` §6–§11, `firmware/openapi.yaml`, and the repo's `../CLAUDE.md`
(public repo, changesets, EF migrations, AppHost). You work in the parent repo's `api/` (ASP.NET Core).

## Goal
Make the MMR API the home for the foosball hardware: implement the device API (`firmware/openapi.yaml`),
model tables and devices, run live **unclaimed table matches**, link existing active matches to a table,
and expose an admin API for the frontend-beta admin UI.

## What exists (mapped by lead)
- v3 matchmaking: `QueueEntry` → `V3PendingMatch` (players required) → `V3ActiveMatch` (no score) →
  `SubmitActiveMatchResultAsync` → `V3MatchesService.SubmitMatchAsync` → rating via the Go mmr-api.
- No tables/devices, no live score, no realtime (clients poll), no device principal (auth is Clerk JWT or
  user PATs via `MultiAuth`), multi-tenant by org/league route + handlers, OTel already in `OpenTelemetryExtensions.cs`.

## Deliverables
1. Entities + EF migration (`dotnet ef migrations add … -o Data/Migrations -c ApiDbContext`) per §11.
2. Device auth scheme (device principal; per-device secret + enrolment token; claim/reset). Agree the exact
   header with `firmware` and have them update openapi.yaml; you implement exactly the spec.
3. Device endpoints per openapi.yaml (config, goal-events with event_id dedupe, status, scoreboard long-poll +
   actions incl. new game save/discard, assign scorer, undo, select/swap sides when the match has players).
4. Unclaimed match lifecycle + claim/submit flow (players chosen at submit time; new MatchSource), and
   linking an active matchmaking match to a table.
5. Admin API for tables/devices/unclaimed matches (Moderator/Owner policies, existing patterns), plus the
   user-facing endpoints the app needs to claim and submit an unclaimed match. Write your API contract in
   `api/` docs or an OpenAPI note and send the path to `admin-ui` and lead.
6. Tests in the repo's existing style; verify end to end with `twin` (digital twin) against the API.
7. A `.changeset/*.md` for the API change (1–2 sentences), per repo rules.

## Rules
- Stay in `api/` (plus a changeset). AppHost/observability changes go through `observability`.
- No commits. Public repo: no deployment-specific values.
- Report progress and completion to lead; questions for the user → lead.
