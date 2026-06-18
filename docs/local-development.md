# Local Development

This guide covers seeding a local database with deterministic test data and
running the end-to-end Playwright suite.

## Vendored Seed

`scripts/seed-data.sql` is a deterministic test fixture that wipes all v3 data
and inserts:

- 2 organizations: `Test Org` / `test-org` (test user is Owner) and
  `Other Org` / `other-org` (test user is Member; used by RBAC e2e tests)
- 2 leagues: `Test League` (2v2) under Test Org and `Other League` under Other Org
- 3 seasons in Test League (2 past + 1 current)
- 65 league players, including the test user
- ~2050 matches with rating histories whose `(mmr, mu, sigma)` triplet on
  each player is self-consistent under `RankingDisplayValue`, so submitting
  a new match produces sensible deltas

The seed is the recommended starting point for local development.

### Apply the seed

Start the stack with the Aspire AppHost (it brings up Postgres on `localhost:5432`
and runs the API on `:8081`, applying migrations on startup), then run the seed:

```bash
dotnet run --project local-dev/MMRProject.AppHost
# In another terminal, once the API is healthy:
./scripts/seed-local.sh
```

`seed-local.sh` defaults (`localhost:5432`, user `postgres`, password
`this_is_a_hard_password1337`, db `mmr_project`) match the AppHost's Postgres, so
it works without extra config.

Stable IDs you can use in URLs and tests:

| Entity                    | UUID                                       |
| ------------------------- | ------------------------------------------ |
| Test Org                  | `11111111-1111-1111-1111-111111111111`     |
| Test League               | `22222222-2222-2222-2222-222222222222`     |
| Test user (`tuser`)       | `44444444-4444-4444-4444-444444444401`     |
| Test user membership      | `55555555-5555-5555-5555-555555555501`     |
| Test user (league player) | `66666666-6666-6666-6666-666666666601`     |
| Other Org                 | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`     |
| Other League              | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`     |

Season UUIDs are deterministic — re-applying the seed gives the same IDs.

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
