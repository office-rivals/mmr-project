# frontend-beta

React 19 / TanStack Start rewrite of the SvelteKit application in `../frontend`.
The reference application defines both behavior and appearance. shadcn components
use Base UI primitives, with styles adapted to match the Svelte rendering.

The stack uses React 19.3, TanStack Start/Router, TanStack Query for server data,
Clerk for authentication, TypeScript 7, Tailwind CSS 4 and Vite 8. Carbon Charts
and Lucide provide charts and icons. Vitest 5 covers unit tests; Playwright 1.63
runs the shared functional and screenshot comparisons.

shadcn components are owned source files in `src/components/ui`, not a versioned
component runtime. `components.json` selects the Base UI `base-vega` registry;
the local shadcn CLI is pinned by the lockfile. Generated styles and compatibility
wrappers intentionally preserve the reference UI. Regenerating components must
be followed by the behavior and visual gates. Tailwind uses its Vite plugin and
CSS-first configuration in `src/app.css`.

## Development

Use Node 24 LTS (see the repository `.nvmrc`). Install dependencies in both app
directories with `npm ci`. Run this app with:

```sh
npm run dev
npm run check
npm test
npm run build
npm start
```

Vite generates `src/routeTree.gen.ts`; on a fresh checkout, build before checking
if that file is absent. `npm start` serves the production build using `PORT`
(default 3000) and `HOST` (default `0.0.0.0`).

The implemented routes include authentication, organization browsing/settings,
leaderboards, profiles, statistics, matchmaking, active matches, match submission,
random teams, invitations, personal tokens, and organization/league administration.

## Configuration

Copy `.env.example` to `.env` and supply your own values. Never commit credentials
or deployment identifiers.

| Variable                     | Purpose                                         |
| ---------------------------- | ----------------------------------------------- |
| `API_BASE_PATH`              | Server-side API base URL, resolved per request  |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk public key, included in the browser build |
| `CLERK_SECRET_KEY`           | Server-only Clerk secret                        |
| `CLERK_SIGN_IN_URL`          | `/login`                                        |
| `CLERK_SIGN_UP_URL`          | `/sign-up`                                      |

The browser Clerk key is fixed at build time; unlike Svelte's dynamic public env,
a single built image cannot change Clerk instances without rebuilding. The API
base URL and server secret remain runtime configuration. Vite loads local env
for development; `server.mjs` loads optional dotenv configuration for production.

`src/api-v3` is hand-maintained, like the reference client. Update it alongside
API contract changes; do not overwrite custom client methods with generated code.

## Verification

Run the shared functional suite from either app directory:

```sh
# Here: boots beta and the isolated e2e backend stack
npm run e2e
npm run e2e:ui

# Reference baseline
cd ../frontend
PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/reference.json npx playwright test --reporter=json,list

# Beta, using the same tests
E2E_FRONTEND_DIR=frontend-beta PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/beta.json npx playwright test --reporter=json,list
```

See `../frontend/e2e/README.md` for prerequisites. These tests reset the database;
never run two suites (including visual comparisons) concurrently. Ports 8090,
8091, and 5180 must be free. Postgres uses the dedicated e2e port 5433.

Run the screenshot comparison from this directory:

```sh
npm run parity:visual
npm run parity:visual -- --grep '1440 leaderboard$'
```

The visual harness lives in `parity/` and starts both frontends on 5180 and 5181
against one seeded API. It uses the shared authentication setup and Playwright
installation, so `../frontend/node_modules` must be installed. Reference, beta,
and pixel-diff PNGs plus numerical results are retained under
`test-results/visual/`. Open `playwright-report/visual/index.html` for the report.
A nonzero diff fails the comparison; captures are never promoted automatically.

A functional test pass is not a visual parity claim. See `parity/README.md` for
capture coverage, determinism rules, and any remaining measured differences.

Run `npm run parity:behavior` to exercise the same interaction assertions against
both apps, including keyboard focus, touch input, modal state, and mutation
feedback. Run it alone, like the other browser suites. The harness README records
the intentional runtime differences; `parity/VERIFICATION.md` records measured
results.

## Data and mutation lifecycle

The app and admin layouts fetch one fresh `['me']` snapshot in `beforeLoad`
per navigation or invalidation. Descendants resolve organizations and leagues from
that snapshot in route context. They do not independently reuse a stale shell
query. Loader-only league lists, invitation details, and admin badge counts
also refetch on navigation. This makes newly joined leagues and renamed organizations available
before the destination route resolves.

Play-flow state is scoped to the current league and active-match ID. Queue and
active-match lists poll every two seconds. Pull-to-refresh fetches the shell, refetches callable cached queries, then
waits for synchronous route invalidation. A failed preflight preserves the
current page and shows refresh feedback.

Admin saves await `router.invalidate({ sync: true })` before settling the dialog.
A cancelled or reopened dialog retains its own generation, so an older save
cannot close it. Server-function validation/API failures preserve their HTTP
status while returning the action data used to display feedback.

## Native form responses

SSR-visible mutations support explicit same-route POST handlers with Origin
checks. Invitee fields stay in the POST body. Enhanced forms use inline action
feedback; native success uses a 303 redirect, and native failure renders an
escaped error document with the original HTTP status. Unlike SvelteKit,
TanStack Start has no implicit `form` action-data channel for rendering
`fail(status, data)` into the original page. This native error-page presentation
is an explicit framework contract difference; it does not require hydration to
submit the form. Controls revealed by JavaScript still require JavaScript.

The detailed contract is in `../plans/frontend-beta/specs/10-runtime-contract.md`.
Run `npm run e2e:regressions` for beta-specific native-form, transport, and cache
regressions. It uses the same destructive e2e seed and must run alone.
