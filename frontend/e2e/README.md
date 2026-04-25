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

1. `globalSetup` (`global-services.setup.ts`) starts the docker-compose
   Postgres in `local-development/` and waits for the port to accept TCP
   connections. Idempotent — running with the container already up is a
   fast no-op.
2. `webServer` entries in `playwright.config.ts` start the MMR API,
   .NET API, and Vite dev server in parallel. Playwright blocks on each
   one's HTTP probe URL before any tests run.
3. The `setup` Playwright project (`global.setup.ts`) applies the
   vendored seed (`scripts/seed-data.sql`) and signs into Clerk once,
   saving the storage state for the rest of the suite.
4. The `chromium` project runs every spec against the seeded fixture
   using that storage state.

## Reusing already-running services

Locally, `reuseExistingServer: !process.env.CI` is the default. If you
already have the API or Vite running in another terminal, Playwright
will hit those processes instead of starting its own. CI always starts
fresh.

If a service won't start (port already taken by something incompatible,
build error in the Go or .NET project), Playwright surfaces stdout from
that command in the test output — look for the prefixed `[api]`,
`[mmr-api]`, or `[frontend]` lines.

## Adding a new spec

- Spec files live next to the existing ones; anything matching
  `*.spec.ts` runs in the chromium project.
- Use `data-testid` attributes for any interactive element you'll
  assert on — selectors that lean on accessible role + name break
  whenever copy moves.
- The seeded fixture has 1 Owner-role org (`test-org`) and 1 Member-only
  org (`other-org`). Use the second when writing RBAC tests.
