---
title: Local development
description: Seed a local database with deterministic test data and run the Playwright end-to-end suite against either frontend.
---

This guide covers seeding a local database with deterministic test data and
running the end-to-end Playwright suite.

## Vendored seed

`scripts/seed-data.sql` is a deterministic test fixture that wipes all v3 data
and inserts:

- 2 organizations: `Test Org` / `test-org` (test user is Owner) and
  `Other Org` / `other-org` (test user is Member; used by RBAC e2e tests)
- 3 leagues: `Test League` (2v2, first to 10) and `Singles League` (1v1) under
  Test Org, and `Other League` (2v2) under Other Org
- 3 seasons in Test League (2 past + 1 current) and 1 current season in
  Singles League
- 65 league players in Test League, including the test user, and 3 in
  Singles League
- 2050 matches in Test League with rating histories whose `(mmr, mu, sigma)`
  triplet on each player is self-consistent under `RankingDisplayValue`, so
  submitting a new match produces sensible deltas. Singles League has no
  matches yet.
- 3 open match flags on Test League matches, so the admin match-flags page has
  data

The seed is the recommended starting point for local development.

### Apply the seed

Start the stack with the Aspire AppHost (it brings up Postgres on `localhost:5432`
and runs the API, applying migrations on startup), then run the seed. The script
needs `psql` on your `PATH`.

```bash
dotnet run --project local-dev/MMRProject.AppHost
# In another terminal, once the API is healthy:
./scripts/seed-local.sh
```

`seed-local.sh` defaults (`localhost:5432`, user `postgres`, password
`this_is_a_hard_password1337`, db `mmr_project`) match the AppHost's Postgres, so
it works without extra config. Override them with `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER` and `DB_PASS`.

Stable IDs you can use in URLs and tests:

| Entity                    | UUID                                       |
| ------------------------- | ------------------------------------------ |
| Test Org                  | `11111111-1111-1111-1111-111111111111`     |
| Test League               | `22222222-2222-2222-2222-222222222222`     |
| Singles League            | `22222222-2222-2222-2222-222222222299`     |
| Test user (`tuser`)       | `44444444-4444-4444-4444-444444444401`     |
| Test user membership      | `55555555-5555-5555-5555-555555555501`     |
| Test user (league player) | `66666666-6666-6666-6666-666666666601`     |
| Other Org                 | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`     |
| Other League              | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`     |

Season UUIDs are deterministic — re-applying the seed gives the same IDs.

The test user's profile is therefore at
`/test-org/test-league/player/66666666-6666-6666-6666-666666666601` on either
frontend.

The AppHost starts the SvelteKit frontend. To browse the seed in the beta
frontend, run `npm run dev` in `frontend-beta/` next to the AppHost, with
`API_BASE_PATH` and your Clerk keys in `frontend-beta/.env` (copy
`.env.example`). The beta dev server listens on port 5173 and fails to start if
that port is taken. See the
[frontend-beta README](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/README.md).

### Wiring the seed to your Clerk login

The seeded test user has an `identity_user_id` placeholder by default. To log
in to the app as the test user, set `IDENTITY_USER_ID` and `USER_EMAIL` to
match a Clerk dev account before running the seed:

```bash
IDENTITY_USER_ID=user_xxx \
USER_EMAIL=test1+clerk_test@example.com \
  ./scripts/seed-local.sh
```

To find your Clerk identity user ID, sign in once via the UI (the API will
create a user row), then query:

```bash
PGPASSWORD=this_is_a_hard_password1337 psql -h localhost -U postgres -d mmr_project \
  -c "SELECT identity_user_id FROM users WHERE email = '<your email>'"
```

Then re-run the seed with that value to attach the existing seed data to your
Clerk identity.

## End-to-end tests (Playwright)

Each frontend has its own e2e suite that drives Chromium against the full
stack: `frontend/e2e/` for the SvelteKit app and `frontend-beta/e2e/` for the
beta. Both cover the leaderboard, profile, statistics, match submission
(including singles and winning scores), matchmaking, the player picker, header
and layout, pull-to-refresh, settings, match flags and the admin area,
including role checks. The steps below use the SvelteKit suite; the beta's
works the same way from its own directory.

It is **not** part of the standard PR checks. Run it manually before each
release, locally or via the `E2E` GitHub Actions workflow (`workflow_dispatch`
only), which takes a `frontend` or `frontend-beta` target.

### One-time setup

You need Docker, Node 24, the .NET 10 SDK, Go and `psql`.

```bash
cd frontend
npm ci
npx playwright install chromium

cp .env.e2e.example .env.e2e
# Edit .env.e2e and fill in your Clerk dev test account's email, password
# and identity_user_id (see "Wiring the seed" above).
```

The suite starts each service outside the AppHost, so each one reads its own
configuration:

- the frontend's Clerk keys from `frontend/.env`
- the API's settings from `appsettings.Development.json`, plus its
  `Authorization:Issuer` user secret
- the MMR API's `ADMIN_SECRET` from `mmr-api/.env`, which must match the API's
  `MMRCalculationAPI:ApiKey` (`super-secret-admin` in
  `appsettings.Development.json`)

See [Environment variables](/configuration/environment-variables/).

### Running the suite

`npm run e2e` is self-contained. Playwright starts a dedicated Postgres
container (`local-development/docker-compose.e2e.yml`), then the MMR API, the
API and the frontend's Vite dev server, all on their own ports. The setup
project re-applies the seed and signs in to Clerk once at the start of each
run. A running AppHost stack is left alone.

```bash
cd frontend
npm run e2e             # headless
npm run e2e:ui          # Playwright UI mode (great for debugging)
```

| Service  | e2e port | Override env var   |
| -------- | -------- | ------------------ |
| Postgres | 5433     | `E2E_DB_PORT`      |
| MMR API  | 8090     | `E2E_MMR_API_PORT` |
| API      | 8091     | `E2E_API_PORT`     |
| Vite     | 5180     | `E2E_PORT`         |

Failed runs leave traces, screenshots, and videos under
`frontend/test-results/`; open a trace with
`npx playwright show-trace <path-to-trace.zip>`.

To wipe the e2e database completely:

```bash
cd local-development
docker compose -f docker-compose.e2e.yml down -v
```

### Running the beta's suites

The beta has its own Playwright install, config and test account file:

```bash
cd frontend-beta
npm ci
npx playwright install chromium
cp .env.example .env            # then fill in your Clerk keys
cp .env.e2e.example .env.e2e    # then fill in the Clerk test account
npm run e2e                     # headless
npm run e2e:ui                  # Playwright UI mode
```

The beta has two more suites:

- `npm run e2e:regressions` covers beta-specific native-form, transport and
  cache regressions.
- `npm run build && npm run e2e:production` runs the beta's suite against the
  production build in Chromium, then checks key flows in WebKit and Firefox.
  Install those browsers first with
  `npx playwright install chromium webkit firefox` in `frontend-beta/`.

Every suite resets the same database, so never run two at once. See the
[frontend-beta README](https://github.com/office-rivals/mmr-project/blob/main/frontend-beta/README.md)
for details.

### Adding a test

Specs live alongside their topic (`leaderboard.spec.ts`, `profile.spec.ts`,
etc.). Tests share a single seeded DB and run serially (`workers: 1`,
`fullyParallel: false`), so each test should be safe to re-run against the
seeded fixture without mutating it. Tests that need to mutate (e.g.
matchmaking queue/leave) should clean up after themselves.
