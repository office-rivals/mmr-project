# End-to-end tests

Playwright drives Chromium against the full stack — Postgres + MMR API +
.NET API + the SvelteKit dev server. The runner manages the service
lifecycle so a single `npm run e2e` brings everything up from cold.

## Prerequisites

- Docker (for Postgres). Anything else docker-compose-equivalent works.
- The repo's existing dev toolchain: Node, .NET 10, Go.
- A Clerk dev tenant configured in `.env.e2e` — copy `.env.e2e.example` and
  fill in the test user's email, password, and identity_user_id.

## Running

```bash
cd frontend
npm run e2e              # full suite, headless
npm run e2e:ui           # Playwright UI mode
```

The runner orchestrates four moving pieces:

1. `globalSetup` (`global-services.setup.ts`) starts the e2e Postgres via
   `local-development/docker-compose.e2e.yml` (a separate container with
   its own volume) and waits for the port to accept TCP connections.
   Idempotent — running with the container already up is a fast no-op.
2. `webServer` entries in `playwright.config.ts` start the MMR API,
   .NET API, and Vite dev server in parallel on dedicated e2e ports.
   Playwright blocks on each one's HTTP probe URL before any tests run.
3. The `setup` Playwright project (`global.setup.ts`) applies the
   vendored seed (`scripts/seed-data.sql`) against the e2e DB and signs
   into Clerk once, saving the storage state for the rest of the suite.
4. The `chromium` project runs every spec against the seeded fixture
   using that storage state.

## Port layout

The e2e stack is fully isolated from local development. You can have
your dev stack running and start `npm run e2e` without anything
colliding.

| Service     | Local dev | e2e   | Override env var      |
| ----------- | --------- | ----- | --------------------- |
| Postgres    | 5432      | 5433  | `E2E_DB_PORT`         |
| mmr-api     | 8080      | 8090  | `E2E_MMR_API_PORT`    |
| .NET API    | 8081      | 8091  | `E2E_API_PORT`        |
| Vite dev    | 5173      | 5180  | `E2E_PORT`            |

The e2e Postgres data lives in a named docker volume (`mmr-e2e-db`) so
EF migrations only run on first boot. To wipe the e2e DB completely:

```bash
cd local-development
docker compose -f docker-compose.e2e.yml down -v
```

## Why no service reuse

E2E always starts fresh processes on its dedicated ports. Reusing an
existing dev API or Vite server would point them at the wrong DB and
the wrong API URL respectively. If a service won't start (port taken,
build error), Playwright surfaces stdout from that command in the test
output — look for the prefixed `[api]`, `[mmr-api]`, or `[frontend]`
lines.

## Adding a new spec

- Spec files live next to the existing ones; anything matching
  `*.spec.ts` runs in the chromium project.
- Use `data-testid` attributes for any interactive element you'll
  assert on — selectors that lean on accessible role + name break
  whenever copy moves.
- The seeded fixture has 1 Owner-role org (`test-org`) and 1 Member-only
  org (`other-org`). Use the second when writing RBAC tests.
