# frontend-beta

React rewrite of the SvelteKit `frontend/`, on **TanStack Start** (React 19 +
Vite 8 + TanStack Router/Query + Tailwind 3 + Clerk). It targets full feature
parity with `frontend/`; this commit is the scaffold only.

The stack, pinned versions and every config file here follow
`plans/frontend-beta/specs/00-stack.md`. Auth/API behaviour follows
`plans/frontend-beta/specs/01-auth-and-infra.md`; the theme follows
`plans/frontend-beta/specs/08-ui-library-and-theme.md`.

## Running it

```bash
npm install
npm run dev                                   # http://localhost:5173 (strictPort)
npm run dev -- --port 5180 --strictPort       # e2e / Aspire style invocation
npm run build                                 # → dist/client + dist/server/server.js
npm start                                     # node server.mjs, PORT/HOST from env
npm run check                                 # tsc --noEmit (alias: npm run typecheck)
npm run test                                  # vitest run (unit suite for src/lib)
npm run generate-api-v3                       # regenerate src/api-v3 (API must be up)
```

`npm run check` needs `src/routeTree.gen.ts`, which the Vite plugin writes on the
first `vite dev` / `vite build`. On a fresh clone, build once before typechecking.
The generated file is committed (and ignored by Prettier), same as upstream
guidance.

`vite.config.ts` pins `server.strictPort` so a port collision fails loudly
instead of drifting — Playwright's `webServer` probe depends on the port being
deterministic. The `dev` script is a bare `vite dev`, so `--port` / `--strictPort`
pass straight through.

## Environment contract

`.env` is git-ignored; `.env.example` is the template.

| Variable                     | Scope            | Notes                                                                                                                                                                   |
| ---------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_PATH`              | server only      | Base URL of the .NET API, e.g. `http://localhost:8081`. Read as `process.env.API_BASE_PATH` **per request** inside `createApiClientV3`.                                 |
| `VITE_CLERK_PUBLISHABLE_KEY` | server + browser | Renamed from the Svelte app's `PUBLIC_CLERK_PUBLISHABLE_KEY`. The `VITE_` prefix is what gets it into the client bundle; Clerk's server middleware reads the same name. |
| `CLERK_SECRET_KEY`           | server only      | Never `VITE_`-prefixed.                                                                                                                                                 |
| `CLERK_SIGN_IN_URL`          | server + browser | `/login` — this app does **not** use Clerk's default `/sign-in`.                                                                                                        |
| `CLERK_SIGN_UP_URL`          | server + browser | `/sign-up`.                                                                                                                                                             |
| `PORT` / `HOST`              | server only      | Read by `server.mjs`; default `3000` / `0.0.0.0`.                                                                                                                       |

Two env details worth knowing:

- **Vite never populates `process.env`** and only exposes `VITE_`-prefixed vars
  on `import.meta.env`. So `vite.config.ts` mirrors `.env` into `process.env`
  itself, but only in `serve` mode — doing it during `build` would risk baking a
  developer's local values into the output. `server.mjs` does the equivalent with
  an optional `dotenv/config` import that is a no-op when the dependency has been
  pruned in a production image.
- **`API_BASE_PATH` stays runtime-resolved** (the image is built once and
  configured per environment). The _server_ side of Clerk resolves
  `VITE_CLERK_PUBLISHABLE_KEY` from `process.env` at runtime too, but the value
  Vite inlines into the **client** bundle is fixed at build time. That is a
  behaviour change from the Svelte app's `$env/dynamic/public` and matters only
  if one image is ever run against two Clerk instances. Fixing it means passing
  `publishableKey` down from a server loader instead — deliberately deferred.

## Auth

- `src/start.ts` registers request middleware, in order:
  `clerkMiddleware()` then `authGuardMiddleware` — mirroring
  `sequence(withClerkHandler(), authGuard, …)` in `hooks.server.ts`.
- `src/lib/server/authGuard.ts` replicates the SvelteKit rules exactly:
  signed out + any path that is not under `/login` or `/sign-up` → **303**
  `/login`; signed in + `/login` or `/sign-up` → **303** `/`. Prefix matching,
  no return-URL preservation. It runs as request middleware rather than
  per-route `beforeLoad` so server routes and server-function RPCs are covered
  too.
  - It reads the session from the Clerk middleware's request **context**, not
    from `auth()`. `auth()` resolves the global Start context, which only exists
    further in (loaders, server functions, route handlers); called from request
    middleware it throws `No Start context found in AsyncLocalStorage`.
  - Asset-shaped paths are exempt. SvelteKit's `handle` hook never ran for files
    in `static/`; without the exemption a signed-out `/login` would 303 away its
    own stylesheet and Clerk bundle.
- `/login` and `/sign-up` are splat routes (`login.$.tsx`, `sign-up.$.tsx`)
  mounting Clerk's **prebuilt** `<SignIn>` / `<SignUp>` with
  `routing="path"`. The e2e suite types into `input[name=identifier]` and
  `input[name=password]`, which only exist on Clerk's own markup — do not swap in
  a hand-rolled form.

## API access

`src/api-v3/` is the generated `typescript-fetch` client, copied **unchanged**
from `frontend/src/api-v3`. Regenerate with `npm run generate-api-v3`.

**The v1/v2 client (`frontend/src/api`) is deliberately not ported.** Spec 01 §5.1
confirms `locals.apiClient` is not referenced by a single route, component or
action in the Svelte app — it is constructed on every authenticated request as
dead weight. If a consumer turns up, add only the specific generated class it
needs.

`src/lib/server/apiClientV3.ts` is server-only. `createApiClientV3(getToken)`
builds the same `Configuration` as the Svelte version (runtime `basePath`, one
`pre` middleware injecting `Authorization: Bearer …`). `requireApiClientV3()`
resolves the current request's Clerk session and throws a 401 `Response` when
there is none — the auth check lives in the factory rather than reproducing the
Svelte app's unsound "typed non-optional, only assigned when signed in" locals.

Never import these modules from a component at module scope; they belong in
`createServerFn` handlers and route `server.handlers`. Type-only imports from
`@/api-v3` are erased at compile time and safe anywhere.

### Same-origin proxy routes

SvelteKit's `handleFetch` only rewrote _server-side_ fetches, so browser code
needs same-origin proxies. These keep the Svelte URLs and contracts exactly:

| Route                                                        | Contract                                                                                                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v3/organizations/$orgId/leagues/$leagueId/matches` | Bare `MatchResponse[]`. `seasonId` / `leaguePlayerId` pass through; `limit` / `offset` go through an unvalidated `Number()`, so `?limit=abc` still forwards `NaN`.                   |
| `GET /$orgSlug/$leagueSlug/api/recent-match`                 | Wrapped `{ match }`. Query param is **`season`**, forwarded as `seasonId`. `400 'leaguePlayerId is required'`, `404 'League not found'`. Still does a `getMe()` round-trip per call. |
| `GET /api/v3/organizations/$orgId/leagues/$leagueId/queue`   | **New.** Response shape is `V3QueueApi.getQueueStatus`'s `QueueStatusResponse`, unchanged.                                                                                           |

The queue route is a **deliberate improvement, not parity**: spec 02 §4.3
documents that both queue pollers in the Svelte app fetch this exact URL from the
browser while no proxy route ever existed, so every poll 404s and the navbar
queue badge never appears in production. The route makes the intended behaviour
work; the client-side rules ("0 queued → no badge", "error → keep previous
value") are unchanged.

## Production server

`vite build` emits `dist/client` and `dist/server/server.js` (a WinterCG
`{ fetch }` handler) — no Nitro, no `.output/`. `server.mjs` adds the Node
listener via `srvx`, plus a small static-file layer for `dist/client`:
`dist/server/server.js` renders routes only, while `adapter-node` used to serve
static files, so without it every hashed asset 404s.

## UI library

Spec: `plans/frontend-beta/specs/08-ui-library-and-theme.md`, plus the shared
component sections of specs 02, 03 and 05.

### Primitives — canonical shadcn/ui, installed by the CLI

`src/components/ui/*` is **CLI output, taken as-is**, from
`npx shadcn@4.14.1 add button card input label table badge alert dialog dropdown-menu`.
`components.json` keeps a non-empty `tailwind.config`, which is what makes the
CLI emit the Tailwind-3 flavoured component set (`cva`, `focus-visible:ring-1`,
individual `@radix-ui/react-*` packages) rather than the v4 `data-slot` set.

Per the user's decision (spec 08, top blockquote) the per-variant class strings
in the spec are **informative, not targets** — they describe what the Svelte app
renders. Cosmetic drift from the CLI defaults is accepted and deliberate, e.g.:

|                       | Svelte app                                       | shadcn CLI (what we ship)                     |
| --------------------- | ------------------------------------------------ | --------------------------------------------- |
| Button base           | no `gap-2`, no `[&_svg]` sizing                  | has both — icons no longer need manual `mr-2` |
| Button `size=default` | `h-10 px-4 py-2`                                 | `h-9 px-4 py-2`                               |
| Card root             | `rounded-lg … shadow-sm`                         | `rounded-xl … shadow` (still `bg-card`)       |
| Card title            | `<h3 class="text-lg …">`                         | `<div class="font-semibold …">`               |
| Badge                 | `rounded-full`                                   | `rounded-md`                                  |
| Input                 | `h-10 … bg-background`                           | `h-9 … bg-transparent shadow-sm`              |
| Dialog overlay        | `bg-background/80 backdrop-blur-sm`, Svelte fade | `bg-black/80`, `data-[state]` animations      |
| Alert                 | no title/description parts                       | ships `AlertTitle` / `AlertDescription`       |
| Dropdown item         | `px-3 py-2`, `bg-muted` highlight                | `px-2 py-1.5`, `bg-accent` highlight          |

Four things were **not** left to the CLI, each for a behavioural reason:

1. **`Badge` gains `user` / `moderator` / `owner` variants** and **`Alert` gains
   `success` / `warning`** — app-specific variants the pages depend on. The
   role-badge strings keep the `border-transparent` + coloured `border-*` pair
   verbatim so `tailwind-merge` resolves them identically.
2. **The dialog close button carries `data-dialog-close`.** Radix does not emit
   it; bits-ui did, and `loading-overlay` hides the button through that
   selector. Its accessible name is still `Close`.
3. **`tailwindcss-animate` is registered in `tailwind.config.js`.** The Svelte
   app had no Tailwind plugins, but the CLI dialog/dropdown emit
   `data-[state=open]:animate-in` utilities that do not exist without it.
   Additive — no existing utility changes.
4. **`src/app.css` and the `theme` block of `tailwind.config.js` are
   authoritative** and were verified byte-identical after the CLI run. The
   orange palette, `--header-height`, the `*` `font-family: 'Chakra Petch'`
   rule and `future.hoverOnlyWhenSupported` all survive untouched.

**`Button` has no `href` prop.** bits-ui's `Button.Root` rendered an `<a>` when
given `href`; the canonical React equivalent is
`<Button asChild><Link to="…">…</Link></Button>`, which is what call sites
should use.

**The `ui/form/` (formsnap) family is skipped** — it has zero consumers in the
Svelte app (spec 08 §7.10). Every form there is a plain progressive-enhancement
`<form>`. If a React form layer is ever wanted, add it then.

**Not installed, deliberately** (spec 08 §8): no `Select`, `Checkbox`, `Switch`,
`Tabs`, `Tooltip`, `Popover`, `Avatar`, `Skeleton`, `Sheet`, `Textarea`,
`Pagination`, and **no toast library**. Pages use native controls and inline
`<Alert>` feedback; swapping in shadcn equivalents changes DOM roles and breaks
e2e selectors.

### Utilities

- `src/lib/utils.ts` — `cn`, `formatDate(d, fallback = '—', localeOptions?)`,
  `formatDateTime`, `isToday`, `matchDateGroupKey`, `matchDateGroupLabel`,
  `groupMatchesByDate`, `getPlayerDisplayName`, `formatLeagueFormat`,
  `getRoleBadgeVariant`, `isModeratorOrAbove` (+ module-private
  `parseLocalDate` / `isSameDay` / `localDateKey`). Ported 1:1.
  `flyAndScale` is **not** ported — it is a Svelte transition, and the
  equivalent animation now comes from the shadcn dialog's `data-[state]`
  classes.
- `src/lib/util/{isPresent,season,session,url}.ts`, `src/lib/constants.ts`,
  `src/lib/scoring.ts` — verbatim. `session.ts` uses `[...players].sort()`
  instead of `toSorted()` (same result, non-mutating).
- Every date-bucket helper still takes an injected `now`. Call sites must pass
  a loader-pinned value, never `Date.now()` inside a component, or a page
  rendered around midnight hydrates with different labels than it was served.

### Shared components

| Path                                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/match-card/match-card.tsx`                                   | Username-first naming (opposite of `getPlayerDisplayName` — intentional), index-based team lookup with positional fallback, `🥚` for a zero score, mirrored team-2 column.                                                                                                                                                                                                                                       |
| `components/match-card/match-date-header.tsx`                            | Fixed class string, `...rest` spread after `className` (so `data-testid` reaches the DOM and a caller `className` would replace, not merge). `uppercase` is CSS-only — the DOM text stays `Yesterday`.                                                                                                                                                                                                           |
| `components/match-card/mmr-delta.tsx`                                    | `(+12)` / `(0)` / `(-7)`; renders nothing when the delta is absent. `positive`/`destructive` are inert class names in the Svelte app too — kept verbatim rather than silently colourised.                                                                                                                                                                                                                        |
| `components/pull-to-refresh.tsx`                                         | PWA-only. Native `window` listeners attached imperatively in an effect (`touchstart`/`touchmove` `{ passive: true }`) — **not** React synthetic events, which are root-delegated and cannot be passive. All handlers read refs, so the one attach/detach pass never goes stale and StrictMode's double-invoke is a true no-op; the error timer is cleared on cleanup. `invalidateAll()` → `router.invalidate()`. |
| `components/loading-overlay.tsx`                                         | Non-dismissible (`preventDefault` on escape/outside). Hides the close button with `[&>button[data-dialog-close]]:hidden` — the same selector the Svelte scoped style used, expressed as a Tailwind arbitrary variant so no global CSS is needed. Adds an `sr-only` `DialogTitle` to satisfy Radix's accessible-name requirement.                                                                                 |
| `components/player-button.tsx`, `page-title.tsx`, `status-indicator.tsx` | 1:1 ports.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `hooks/use-show-mmr.ts`                                                  | `useSyncExternalStore` singleton — same `show-mmr` localStorage key, same `"true"`/`"false"` values, same default (**off**), and the server snapshot is always `false`, exactly like the Svelte store's `browser` guard.                                                                                                                                                                                         |

### Charts

`components/charts/` wraps `@carbon/charts-react` with the exact options objects
from specs 05/08 (`theme: 'g100'`, `curveMonotoneX`, `groupMapsTo: 'player'`,
the `Rating`/`Time` and `Hour of day`/`Day of week` axis titles, the reversed
weekday domain, the 10-stop `hsl(var(--primary) / …)` ramp). Options are built
in a `useMemo(…, [])` so they are computed **once**, matching the Svelte `const`
— rebuilding them per render thrashes Carbon.

- **Client-only and code-split.** Carbon needs the DOM and crashes during SSR,
  so `Sparkline` / `LineChart` / `Heatmap` are `ClientOnly` + `React.lazy`
  wrappers around `*.impl.tsx`.
- **Where the stylesheet lives.** The Svelte app imported
  `@carbon/charts-svelte/styles.css` from the `(authed)` layout. Here it is
  imported by `components/charts/carbon-charts.tsx`, the single module that
  touches Carbon — and because that module is only ever reached through a
  dynamic import, the CSS ships in the same lazily-loaded chunk as the charts
  (`dist/client/assets/carbon-charts-*.css`). A chart therefore can never
  render unstyled, and chart-free routes pay nothing.
- The `.bx--chart-holder` / `.cds--chart-holder` element that e2e locates comes
  from Carbon itself and is unaffected — verified: three chart instances render
  three holders with live `<svg>` inside.
- `Sparkline` keeps the **`data.length <= 1` renders nothing** quirk, which also
  swallows the `loading: true` placeholder (the leaderboard's loading branch
  passes `data={[]}`). Preserved deliberately; changing it is a visible
  behaviour change.

### Tests

`npm run test` runs vitest (`vitest.config.ts`, node environment, TZ/locale
pinned so `toLocaleDateString` output is machine-independent). It deliberately
does not reuse `vite.config.ts` — the Start plugin's SSR/router codegen is
irrelevant to a pure-function suite. The five upstream suites
(`lib/utils.test.ts`, `lib/util/{isPresent,season,session,url}.test.ts`) are
ported verbatim: 42 tests. Two suites are new to this app —
`lib/scoring.test.ts` (10) and `lib/move-player-to-top-left.test.ts` (6) — for
58 across 7 files.

## Intentionally deferred

Everything below is out of scope for the scaffold and lands with the feature
specs:

- ~~**All pages except `/`**~~ and ~~**the app shell**~~ — both landed with
  spec 02; see "Routing conventions" below. The misc routes (`/join`,
  `/join/$code`, `/random`, `/settings`) landed with spec 07. Still missing:
  the league pages (leaderboard, submit, matchmaking, active match, player,
  statistics) and the admin tree.
- **Admin routes and the two-tier RBAC gate** (403/404 as real document status
  codes, per spec 09) — the mechanism is shipped (`createRouteGuard`), the
  routes are not.
- **ESLint.** Prettier is configured; no ESLint config is shipped yet, so there
  is no `lint` script.
- **Playwright config and the e2e suite.** `@playwright/test` is installed;
  spec 09 §5.1 recommends pointing the existing `frontend/playwright.config.ts`
  at this directory via `E2E_FRONTEND_DIR` / `E2E_FRONTEND_CMD` rather than
  forking the suite.
- **Dockerfile.** Shape per spec: `npm ci && npm run build`, ship `dist/`,
  `server.mjs` and `node_modules`, `CMD ["node", "server.mjs"]`, `EXPOSE 3000`.

## Routing conventions

The authed shell (spec 02) is in place. **Every route below `/` that a signed-in
user can see belongs under the `_authed` pathless layout** — that is where the
single `getMe()` fan-out, the header, the `<main>` container and the bottom
navbar live. Adding a page anywhere else silently drops the chrome.

### File layout

| File                                                | Route id                        | Owns                                                                                                                                      |
| --------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/_authed.tsx`                            | `/_authed`                      | shell loader + `PullToRefresh` / `Header` / `<main>` / `Navbar`, and the `html { scroll-padding-top }` + `body { min-height }` head style |
| `src/routes/_authed/index.tsx`                      | `/_authed/`                     | `/` — org list, empty state, single-org×single-league 307 redirect                                                                        |
| `src/routes/_authed/$orgSlug/index.tsx`             | `/_authed/$orgSlug/`            | `/:orgSlug` — league browser + Join League                                                                                                |
| `src/routes/_authed/$orgSlug/settings.tsx`          | `/_authed/$orgSlug/settings`    | `/:orgSlug/settings` — Owner-only org settings                                                                                            |
| `src/routes/_authed/$orgSlug/$leagueSlug/route.tsx` | `/_authed/$orgSlug/$leagueSlug` | the league shell layout (zero API calls, `<Outlet/>` only)                                                                                |

New pages go in as siblings, e.g.
`src/routes/_authed/$orgSlug/$leagueSlug/index.tsx` (leaderboard),
`.../submit.tsx`, `.../matchmaking.tsx`, `.../statistics.tsx`,
`.../active-match.$id.tsx`, `.../player/$id.tsx`, plus
`src/routes/_authed/random.tsx`, `src/routes/_authed/settings.tsx`,
`src/routes/_authed/join/…`. Admin lives at `src/routes/admin*` — **outside**
`_authed`, because it has its own chrome and must not render this header/navbar.

Static segments outrank dynamic ones, so `/$orgSlug/settings` and `/settings`
resolve ahead of `/$orgSlug/$leagueSlug` and `/$orgSlug` without any extra work.

The three proxy routes (`routes/api/v3/**`, `routes/$orgSlug/$leagueSlug/api/
recent-match.ts`) stay outside `_authed` on purpose: they are request handlers,
not pages, and they are already covered by the global auth-guard middleware.

### The `getMe()` context: `AuthedShellData`

`src/lib/shell.ts` is the only sanctioned entry point. It exports:

```ts
authedShellQueryOptions(); // queryKey ['me'], staleTime 0
meQueryKey; // ['me'] — invalidate this after any org/league mutation
getAuthedShellData(); // the server fn behind it (rarely called directly)
interface AuthedShellData {
  userId;
  organizations;
  profileLoadFailed;
  displayName;
  username;
  defaultOrgSlug;
  defaultLeagueSlug;
  defaultOrgId;
  defaultLeagueId;
  defaultLeaguePlayerId;
}
```

Read it, never re-fetch it:

```ts
// in a loader / beforeLoad
const shell = await context.queryClient.ensureQueryData(
  authedShellQueryOptions()
);

// in a component under _authed
const shell = getRouteApi('/_authed').useLoaderData();
```

Rules that are load-bearing:

- **`staleTime: 0` is deliberate.** It is what replaces SvelteKit's
  `invalidateAll: true`, and it is what makes pull-to-refresh's
  `router.invalidate()` actually issue a request (`pull-to-refresh.spec` waits
  on one). Don't raise it.
- **`profileLoadFailed` must not be collapsed into "zero orgs".** The shell
  loader never throws on a `getMe()` failure; `/` renders `Welcome to Office
Rivals`, `/settings` and `/random` degrade, and only the league layout 401s.
- **Defaults skip league-less orgs** (`find(o => o.leagues.length > 0)`), not
  `organizations[0]`.
- Any mutation that changes org/league membership or naming must
  `invalidateQueries({ queryKey: meQueryKey })`.

### League context

`src/routes/_authed/$orgSlug/$leagueSlug/route.tsx` exports `LeagueContext`
(`orgId`, `leagueId`, `leagueTeamSize`, `leagueWinningScore`, `leaguePlayerId`,
`orgSlug`, `leagueSlug`, `orgRole`) and publishes it twice:

```ts
// child loader / beforeLoad — resolved before yours runs
loader: ({ context }) => { const { orgId, leagueId } = context.league; … }

// child component
const { leaguePlayerId } = getRouteApi('/_authed/$orgSlug/$leagueSlug').useLoaderData()
```

It replaces SvelteKit's `page.data.orgId / leagueId / leaguePlayerId` — the
bottom navbar already reads it through
`useMatch({ from: '/_authed/$orgSlug/$leagueSlug', shouldThrow: false })`.
It makes **zero** API calls: everything comes from the parent's `getMe()`.
`leaguePlayerId` uses `||`, so an empty string collapses to `null` ("has not
joined this league").

### Status codes: `HttpError` + `createRouteGuard`

`e2e` reads `response.status()` (403 on `/admin/:orgSlug`, 200 on `/other-org`),
so an RBAC gate has to produce a **real document status**, not a 200 page
rendering an error. TanStack Router only ever derives 200/404/500 from a failed
loader, so gates are written in two halves that share their message strings:

```ts
// 1. document requests — real Response, real status, runs before the router
const ownerGuard = createRouteGuard(async ({ params }) => {
  resolveOwnedOrg(await loadShellDataOnce(), params.orgSlug ?? '');
});

export const Route = createFileRoute('/_authed/$orgSlug/settings')({
  server: { middleware: [ownerGuard] }, // covers every descendant document request
  // 2. client navigations — same check, same HttpError, rendered by errorComponent
  loader: async ({ context, params }) => ({
    org: resolveOwnedOrg(
      await context.queryClient.ensureQueryData(authedShellQueryOptions()),
      params.orgSlug
    ),
  }),
  errorComponent: HttpErrorView,
  component: OrgSettingsPage,
});
```

- `HttpError` (`src/lib/http-error.ts`) is isomorphic; `createRouteGuard` and
  `httpErrorResponse` (`src/lib/server/http-error.ts`) are server-only and are
  stripped from the client bundle by the route `server` option.
- Put the guard on the **layout** route when the whole subtree is gated (the
  admin org layout should do exactly this — one guard, every sub-page 403s).
- `loadShellDataOnce()` memoises `getMe()` per `Request`, so a guard plus the
  `_authed` loader cost one round-trip, not two.
- Guards run **server-side only**; the matching `loader`/`beforeLoad` check is
  what covers in-app navigation, and it must throw the identical status and
  message.

Current gates: org home 500/404, org settings 500/404/403 (`Only organization
owners can access settings`), league layout 401 `Failed to load user profile` /
404 `Organization not found` / 404 `League not found`.

### Links built at runtime

TanStack Router types `to` as a literal union of known route ids, so
`` `/${orgSlug}/${leagueSlug}/submit` `` cannot typecheck — and a plain `<a>`
would trigger a full document reload. Use `AppLink`
(`src/components/app-link.tsx`) for any slug//id-interpolated path and the real
`<Link to="/literal">` everywhere else:

```tsx
<AppLink to={`/${orgSlug}/${leagueSlug}/player/${leaguePlayerId}`}>…</AppLink>
```

This is also the answer to the `MatchCard` gotcha: pass `renderPlayerLink` an
`AppLink`, never a bare anchor. For imperative navigation use
`router.navigate({ href })`, which accepts a plain string.

`Button` has no `href` prop — wrap: `<Button asChild><AppLink …/></Button>`.
All five navbar entries are anchors, which is what `layout.spec`'s
`nav.getByRole('link')` count of 5 depends on.

### Queue-badge polling

The navbar badge (`src/components/shell/matchmaking-button.tsx`) is the pattern
for any queue polling:

```ts
useQuery({
  queryKey: ['queue', orgId, leagueId],
  queryFn: () => fetch(`/api/v3/organizations/${orgId}/leagues/${leagueId}/queue`)…,
  refetchInterval: 10_000,   // 2_000 on the /matchmaking page
  staleTime: 0,
  retry: false,
})
```

The proxy route it calls exists in this app (it never did in the Svelte one —
see "Same-origin proxy routes" above), so the badge actually works. Keep the
client-side rules: an immediate fetch on mount, `0 queued` renders **no** badge
at all, and a failed poll leaves the previous value in place (TanStack Query
keeps the last successful `data`, and `retry: false` keeps the cadence honest).
The `/matchmaking` page should reuse `queueQueryKey(orgId, leagueId)` so the two
pollers share one cache entry.

### Deviations from the Svelte transport (deliberate)

- Form actions (`?/joinLeague`, `?/update`) are server functions + `useMutation`.
  The `303` that SvelteKit emitted on success is now a `router.navigate()` after
  the mutation resolves; the resulting URL is identical, and the mutation
  invalidates `['me']` first so the switcher and navbar see the change.
- `goto(url, { invalidateAll: true })` on a league switch is
  `invalidateQueries(['me'])` + `router.navigate({ href })`: TanStack Router
  re-runs every loader on navigation anyway.
- The `/` single-org×single-league jump is still a real **307** thrown from the
  loader, and the signed-out guard is still a real **303**.
- **The `/api/v3/organizations/$orgId/leagues/$leagueId/queue` proxy route is
  new** — see "Same-origin proxy routes" above. Both queue pollers in the
  Svelte app fetched that URL from the browser while no such route existed, so
  every poll 404'd and the navbar queue badge never appeared. The client-side
  rules are unchanged; only the transport now resolves.
- **`/matchmaking` live-updates its active-match list** — the Svelte page
  copied `data.activeMatches` into `$state` once and never wrote to it again,
  so the list stayed frozen at the first server render even though the poll
  called `invalidateAll()`. Here it is a `useQuery` seeded from the loader, and
  the `activeMatch` appearing in the queue poll invalidates it. Deliberate fix,
  not parity — it is what the original code was reaching for.
- **The statistics heatmap recomputes its rows when `data` changes** — the
  Svelte component mapped its rows once at init, so a season switch (which kept
  the component mounted) left the previous season's cells on screen (spec 05
  quirk 9, flagged there as "fix it, don't reproduce it"). Only the *options*
  object stays `useMemo(…, [])`; `mappedChartData` is keyed on `[data, labels]`.
  The half-done UTC conversion inside the mapping (hour converted, weekday not)
  is still reproduced verbatim.
- **`/settings` creates tokens with `scope: 'write'`, not `'full'`** — a
  deliberate bug fix, the one behavioural break with the Svelte app in spec 07.
  The API's `PatScopes.TryNormalize` accepts only `'write'`, so the Svelte
  action's hardcoded `'full'` makes every token creation 400 and render
  `Failed to create token`; token creation has never worked in that UI. Any
  e2e written against the old behaviour would be asserting the failure path.
  Everything else on the page is parity, including `datetime-local` being
  parsed with `new Date(...)` **on the server**, so the expiry is interpreted
  in the server's timezone (spec 07 §4.2).
- The `/settings` token table renders `formatDate()` on both the server and
  the client, and `toLocaleDateString()` with no options follows each
  runtime's default locale. The three date cells carry
  `suppressHydrationWarning` so a Node/browser locale disagreement patches
  quietly instead of logging a hydration error; pin a locale if the two ever
  need to be byte-identical.
- `/join/$code` deliberately does **not** catch loader errors, matching the
  Svelte load: the invite lookup is rate limited to 10 requests/minute per
  user, and the 11th request 500s the page rather than showing a friendly
  state. "Expired" vs "unknown" copy is still chosen by `organizationName`
  being non-empty — an unknown code is a 200 with `isValid: false`, never a
  404.
