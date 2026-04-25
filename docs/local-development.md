# Local Development

This guide covers seeding a local database with deterministic test data and
running the end-to-end Playwright suite.

## Vendored Seed

`scripts/seed-data.sql` is a deterministic test fixture that wipes all v3 data
and inserts:

- 1 organization (`Test Org` / `test-org`)
- 1 league (`Test League` / `test-league`, 4-player queue)
- 3 seasons (one current, two past)
- 6 league players, including 1 test user account
- 18 matches (15 in current season, 3 in past season) with realistic
  rating-history deltas so sparklines, MMR, wins/losses, and streaks all
  populate

This is the recommended starting point for local development if you don't have
access to the production database (`scripts/import-prod-data.sh` is gated on
Azure credentials).

### Apply the seed

Bring up Postgres and apply migrations once (the API runs migrations on
startup), then run the seed:

```bash
cd local-development && docker-compose up -d
cd ../api/MMRProject.Api && dotnet run     # starts API on :8081 + applies migrations
# In another terminal, once the API has started and migrations are done:
./scripts/seed-local.sh
```

Stable IDs you can use in URLs and tests:

| Entity                    | UUID                                       |
| ------------------------- | ------------------------------------------ |
| Organization              | `11111111-1111-1111-1111-111111111111`     |
| League                    | `22222222-2222-2222-2222-222222222222`     |
| Past season               | `33333333-3333-3333-3333-333333333302`     |
| Current season            | `33333333-3333-3333-3333-333333333303`     |
| Test user (`tuser`)       | `44444444-4444-4444-4444-444444444401`     |
| Test user (league player) | `66666666-6666-6666-6666-666666666601`     |

The route to the test user's profile is therefore
`http://localhost:5173/test-org/test-league/player/66666666-6666-6666-6666-666666666601`.

### Wiring the seed to your Clerk login

The seeded test user has an `identity_user_id` placeholder by default. To log
in to the app as the test user, set `IDENTITY_USER_ID` and `USER_EMAIL` to
match a Clerk dev account before running the seed:

```bash
IDENTITY_USER_ID=user_3AxNl1GZF7UG4Og7EzDoqwSVHo3 \
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

## End-to-End Tests (Playwright)

The e2e suite under `frontend/e2e/` covers the leaderboard, profile,
statistics, submit, matchmaking, and layout flows. It is **not** part of the
standard PR checks. Run it manually before each release, locally or via the
`E2E` GitHub Actions workflow (`workflow_dispatch` only).

### One-time setup

```bash
cd frontend
npm ci
npx playwright install chromium

cp .env.e2e.example .env.e2e
# Edit .env.e2e and fill in your Clerk dev test account credentials
# and identity_user_id (see "Wiring the seed" above).
```

### Running the suite

The suite assumes the full stack is already running (Postgres + .NET API +
mmr-api + frontend dev server). The setup project re-applies the seed at the
start of each run.

```bash
cd frontend
npm run e2e             # headless
npm run e2e:ui          # Playwright UI mode (great for debugging)
```

Failed runs leave traces, screenshots, and videos under
`frontend/test-results/`; open the HTML report with
`npx playwright show-report`.

### Adding a test

Specs live alongside their topic (`leaderboard.spec.ts`, `profile.spec.ts`,
etc.). Tests share a single seeded DB and run serially (`workers: 1`,
`fullyParallel: false`), so each test should be safe to re-run against the
seeded fixture without mutating it. Tests that need to mutate (e.g.
matchmaking queue/leave) should clean up after themselves.
