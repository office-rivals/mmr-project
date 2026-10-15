# frontend-beta

React 19 / TanStack Start rewrite of the SvelteKit application in `../frontend`.
The reference application guides behavior and appearance; known bugs and older
icon drawings need not be reproduced. shadcn components
use Base UI primitives, with styles adapted to match the Svelte rendering.

The stack uses React 19.3, TanStack Start/Router, TanStack Query for server data,
Clerk for authentication, TypeScript 7, Tailwind CSS 4 and Vite 8. Carbon Charts
and Lucide provide charts and icons. Vitest 5 covers unit tests; Playwright 1.63
runs the shared functional suite and the beta's own regression and production
suites.

shadcn components are owned source files in `src/components/ui`, not a versioned
component runtime. `components.json` selects the Base UI `base-vega` registry;
the local shadcn CLI is pinned by the lockfile. Generated styles and compatibility
wrappers intentionally preserve the reference UI. Regenerating components must
be followed by the e2e suites below. Tailwind uses its Vite plugin and
CSS-first configuration in `src/app.css`.

## Development

Use Node 26 (see `frontend-beta/.nvmrc`, which the production image matches).
Install dependencies in both app directories with `npm ci`. Run this app with:

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
| `CLERK_PUBLISHABLE_KEY` | Clerk public key, supplied to the browser during SSR |
| `CLERK_SECRET_KEY`           | Server-only Clerk secret                        |
| `CLERK_SIGN_IN_URL`          | `/login`                                        |
| `CLERK_SIGN_UP_URL`          | `/sign-up`                                      |
| `TRUST_PROXY`                | Forwarded-header trust policy; defaults false   |
| `APP_ORIGIN`                 | Fixed public origin behind a TLS-terminating proxy |
| `CLERK_AUTHORIZED_PARTIES`    | Comma-separated origins allowed to mint session tokens |

The Clerk middleware reads the runtime public key and supplies it to the browser
through its SSR initial state. No credentials are required to build the image.
`VITE_CLERK_PUBLISHABLE_KEY` remains supported for existing local configurations;
prefer `CLERK_PUBLISHABLE_KEY` for deployments. The API URL and secret key are also
runtime configuration. Vite loads local env for development; `server.mjs` loads
optional dotenv configuration for local production runs.

For a fixed public hostname behind managed ingress, set `APP_ORIGIN` to its HTTPS
origin and leave `TRUST_PROXY=false`. The server uses that origin for Clerk and
native-form validation and removes conflicting forwarded host/protocol headers.
Set `CLERK_AUTHORIZED_PARTIES` to the explicitly trusted application origins; a
shared Clerk instance may need both its primary and beta origins. Sign-in and
sign-up return to this app's `/`; sign-out returns to `/login`.

`TRUST_PROXY` accepts `false`, `true`, `loopback`, or a comma-separated list of
proxy IP addresses. Keep the default when the app receives traffic directly.
When a controlled reverse proxy terminates HTTPS, use `loopback` for a same-host
proxy or list its exact peer addresses. Use `true` only when every immediate peer
is controlled and overwrites forwarded headers; invalid values stop startup.

`src/api-v3` is hand-maintained, like the reference client. Update it alongside
API contract changes; do not overwrite custom client methods with generated code.

## Verification

The beta is verified by the e2e suite it shares with `../frontend`, plus two
beta-only suites in `e2e/`:

```sh
# Shared suite: boots beta and the isolated e2e backend stack
npm run e2e
npm run e2e:ui

# Beta-only native-form, transport, cache and keyboard regressions
npm run e2e:regressions

# The shared suite against the built Node server, plus WebKit/Firefox smoke
# and production contracts
npm run build && npm run e2e:production
```

See `../frontend/e2e/README.md` for prerequisites. These tests reset the database;
never run two suites concurrently. Ports 8090, 8091, and 5180 must be free.
Postgres uses the dedicated e2e port 5433.

For the production suite, install all three browser engines from `../frontend`
with `npx playwright install chromium webkit firefox`. It repeats the full shared
suite against the built Node server in Chromium, then checks sign-in, navigation,
role restrictions and match submission in WebKit and Firefox. Each browser gets
a fresh database seed. Final contracts check authenticated HTML without JavaScript,
native POSTs, forged origins, public health/assets and sign-out. The server runs
in UTC while browser checks cover multiple timezones and locales. WebKit coverage
does not replace testing on a physical Safari device.

## Data and mutation lifecycle

Date and number rendering uses a consistent English/UTC snapshot for SSR and
initial hydration, then adopts the browser's locale and timezone. Use
`useLocaleFormatters()` for rendered values and date groups; formatting directly
with the runtime defaults can disagree between Linux containers and browsers.
Without JavaScript, date displays retain the UTC snapshot.

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

## Container and release

```sh
docker build -t frontend-beta:local .
docker run --rm --env-file /private/path/beta.env -p 127.0.0.1:3000:3000 frontend-beta:local
```

The image runs as the unprivileged `node` user and excludes local env files,
test artifacts and development dependencies. `/health` checks the Node listener
without requiring a Clerk session; it does not check upstream API availability.
Use port 3000 for ingress and health probes. Set the public origin and production
Clerk credentials at runtime before testing authentication on the custom hostname.

`frontend-beta` is a separate changeset/release component. After merging its
release PR, choose `frontend-beta` and the released version in **Deploy Release**.
Provision a separate Container App first and set `BETA_UI_CONTAINER_APP_NAME` in
GitHub. Configure its API URL, Clerk keys, public origin and HTTP probes in Azure.
The workflow rejects an empty beta target or the primary frontend's app name.
It deploys the image published for that release to GHCR, without rebuilding it,
and does not configure DNS, TLS, runtime credentials or probes. Roll back by
deploying the previous version.

For a beta subdomain sharing live users, reuse the production Clerk instance and
API issuer, check Clerk's Allowed Subdomains setting, and verify login, refresh,
logout and an agreed live test mutation after binding HTTPS. Beta mutations affect
the same live database. The destructive Playwright suites must never target it.
