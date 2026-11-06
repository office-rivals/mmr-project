# End-to-end tests

Playwright drives the beta against the full stack — Postgres + MMR API +
.NET API + the beta app. The runner manages the service lifecycle, so each
command below brings everything up from cold.

| Command                                   | Specs                                        | Runs against                        |
| ----------------------------------------- | -------------------------------------------- | ----------------------------------- |
| `npm run e2e` (`e2e:ui` for UI mode)      | `*.e2e.spec.ts`                              | the Vite dev server, in Chromium    |
| `npm run e2e:regressions`                 | `*.functional.spec.ts`                       | the Vite dev server, in Chromium    |
| `npm run build && npm run e2e:production` | `*.e2e.spec.ts`, then `*.production.spec.ts` | the built Node server (`npm start`) |

- **`e2e`** is the main suite: leaderboard, profile, statistics, match
  submission (singles and winning scores), matchmaking, the player picker,
  header and layout, pull-to-refresh, settings, match flags, the admin area and
  invite onboarding.
- **`e2e:regressions`** covers beta-specific native-form, transport, cache and
  keyboard regressions.
- **`e2e:production`** repeats the main suite against the production build in
  Chromium, then runs the header, submit and admin-role specs in WebKit and
  Firefox, plus the touch-picker spec in Firefox (each browser on a fresh
  seed), then the production contracts: authenticated HTML without JavaScript,
  native POSTs, forged origins, public health and assets, and sign-out. The
  server runs in UTC while the browser checks cover several time zones and
  locales. WebKit does not replace testing on a physical Safari device.

Each suite re-seeds the same database, so never run two at once.

## Prerequisites

- Docker (for Postgres), Node, the .NET 10 SDK, Go and `psql`.
- `npm ci` in this directory, then
  `npx playwright install chromium` (add `webkit firefox` for
  `e2e:production`).
- `.env` with the beta's Clerk keys (see `../.env.example`). The suite also
  reads `CLERK_SECRET_KEY` from it to create throwaway users through Clerk's
  Backend API.
- `.env.e2e` — copy `../.env.e2e.example` and fill in the Clerk test user's
  email, password and identity_user_id. Its session token needs the claims
  listed under "Clerk sign-in" in
  [`local-dev/README.md`](../../local-dev/README.md#clerk-sign-in).

The API reads its settings from `appsettings.Development.json` and its
`Authorization:Issuer` user secret; the MMR API reads `ADMIN_SECRET` from
`mmr-api/.env`.

## How a run works

1. `globalSetup` (`global-services.setup.ts`) starts the e2e Postgres from
   `local-development/docker-compose.e2e.yml` (its own container and volume)
   and waits for the port.
2. `webServer` entries in `../playwright.config.ts` start the MMR API, the
   .NET API and the app on dedicated ports, and wait for each to answer.
3. The `setup` project (`global.setup.ts`) applies the vendored seed
   (`scripts/seed-data.sql`) and signs in to Clerk once, saving the session to
   `.auth/user.json` for every other project.

| Service  | Local dev | e2e  | Override env var   |
| -------- | --------- | ---- | ------------------ |
| Postgres | 5432      | 5433 | `E2E_DB_PORT`      |
| mmr-api  | 8080      | 8090 | `E2E_MMR_API_PORT` |
| .NET API | 8081      | 8091 | `E2E_API_PORT`     |
| App      | 5173      | 5180 | `E2E_PORT`         |

Failed runs leave traces, screenshots and videos under `../test-results/`
(one folder per suite).

## Adding a spec

- Name it for its suite: `<topic>.e2e.spec.ts`, `<topic>.functional.spec.ts`
  or `<topic>.production.spec.ts`. Each config selects its specs by suffix.
- Use `data-testid` attributes for interactive elements you assert on, or a
  role and name that the design fixes.
- Arrange and inspect database state with `psql` against the e2e database, and
  clean up what you add. Specs share one seeded database and run serially.
- The seed has one Owner-role org (`test-org`) and one Member-only org
  (`other-org`); use the second for role checks.
- `server-fns.ts` recognises a server-function request by function name, for
  specs that wait on or stall a specific mutation or loader.
