# Parity verification

## Readiness check — 2026-10-02

Verified the `feat/frontend-beta` working tree based on `b97d4ff`, including the
readiness changes prepared in this workspace. An independent checkout of current
`origin/main` (`45dca00`) passed the full reference suite. The reference token-scope
fix from that commit is also applied here; the paired token tests now require
successful creation and revocation in both apps.

| Gate | Result |
| --- | --- |
| Current main reference baseline | 97 passed, including its new personal-token test |
| Final beta development suite | 96 passed |
| Built production server | 156 passed: full Chromium suite; WebKit/Firefox sign-ins and 26 smoke checks each; six production contracts |
| Beta HTTP, native-form, cache, refresh, polling and navigation regressions | 23 passed |
| Paired behavior | 59 passed, including token creation/revocation in both apps after the upstream fix |
| Visual matrix | 124 passed: 118 comparisons with zero unexplained pixels, plus setup, keyboard and icon-policy checks |
| TypeScript and Vitest | Passed; 95 tests across 15 files |
| API integration | 158 passed after dependency patches |
| Go | `go test ./... -race` passed |
| Release tooling | 54 tests; both changesets validated; full version/changelog rehearsal passed in a disposable copy |
| Workflow syntax | `actionlint` passed |
| Container | Credential-free Linux ARM64 and AMD64 builds passed; AMD64 runtime healthy as UID 1000; runtime-only Clerk keys; authenticated HTML, menus and no-JavaScript rendering passed without page errors |
| Dependency audit | Beta npm audit, API NuGet audit and integration-test NuGet audit report zero known findings |

The production suite runs `server.mjs` in UTC with an explicit `APP_ORIGIN` and
Clerk origin allowlist. Its locale checks cover Los Angeles, Copenhagen (Danish)
and Kiritimati across eight authenticated routes each. It verifies authenticated
HTML with JavaScript disabled,
same-origin native POST success, forged-origin rejection, public health and
manifest responses, anonymous protection, and sign-out that remains on this app.
The additional engines cover navigation, keyboard menus, phone-width header
layout, role restrictions and a complete match submission. WebKit is not a
physical Safari-device test.

Initial failures were investigated without weakening application assertions:

- A beta menu timeout passed a focused rerun and the complete 96-test rerun.
- Reusing one seed across browser engines triggered the API's duplicate-match
  guard. Each production browser now gets a fresh seed and sign-in, in order.
- The anonymous production request inherited Playwright's authenticated project
  state. Its context now explicitly starts without cookies; all four setup/contract
  tests passed in isolation, followed by the complete 153-test production run.
- The first visual run had 6,426 unexplained pixels on the desktop statistics
  heatmap. A fresh targeted rerun had zero raw differences; the final complete run
  then passed all 124 tests. The pixel policy and chart implementation were
  not changed.

A subsequent authenticated Linux-container check reproduced React hydration
errors because UTC server timestamps differed from the browser timezone. Date
and number rendering now uses an English/UTC initial snapshot, then adopts the
browser locale after hydration. Date groups use the same snapshot, and the
pending-match countdown starts from the loader timestamp. No hydration warnings
are suppressed. The final development, production, regression, behavior and
visual runs all passed with this repair.

The final visual run took 12.9 minutes. Of its 118 comparisons,
55 had no raw differences; the rest contained only the documented icon/dialog
exceptions (4,606 accepted pixels total). No cases were skipped or retried.

Readiness work adds the beta Docker image, health endpoint, independent release
component, PR build/unit/container checks, manual production/browser gates and
beta deployment target. It also pins the public request origin behind ingress,
removes untrusted forwarding headers before Clerk reads them, restricts Clerk
session-token origins, and keeps sign-in/up/out redirects on this frontend.
Release tooling now synchronizes component lockfile version metadata and allows
beta's independent major without relaxing alignment for the stable components.
No component version or changelog was manually bumped.

The existing Svelte frontend on current main still reports five production npm
audit findings (one high, four low). Those inherited packages are outside the
beta image; this is not a clean dependency-audit claim for the entire repository.

External deployment remains unverified: the actual Azure target and secrets,
custom-hostname DNS/TLS, production Clerk subdomain settings, shared live sessions
and a reversible live-data acceptance check. Automated tests only touched the
isolated local e2e database. No deployment, push or pull request was performed.
The deployment-specific plan is kept outside this public repository.

## Historical verification — 2026-09-28

The following records the earlier candidate, not the current readiness result.

Reverified locally on 2026-09-28 on `feat/frontend-beta`, after the dependency
upgrade and independent review fixes through `a723328`. The reference
`frontend/src` remains byte-identical to `origin/main` (`2fa3b90`). Reference
application source and shared test assertions were not changed during this upgrade. Both test
installations use Playwright 1.63. The existing shared-suite adapter recognizes
Svelte action/reload URLs versus Start RPC identifiers, selects the equivalent
delete form, and accepts beta's form-level confirmation for the scripted concurrent
delete. Those transport adapters preserve the same assertions; no further shared
spec changes were needed for the upgrade.

| Gate | Result |
| --- | --- |
| Shared Svelte reference suite | 96 passed, no skips or flaky tests |
| Shared beta suite | 96 passed, no skips or flaky tests |
| Paired behavior runner | 59 passed: 55 cases and 4 setup tests |
| Beta HTTP, native-form, cache, refresh, polling and navigation regressions | 23 passed |
| Visual matrix | 118 comparisons, zero unexplained pixels |
| Complete visual runner, including fixtures, keyboard and policy tests | 124 passed |
| TypeScript | Passed |
| Vitest | 87 tests passed across 14 files |
| Production build | Passed |
| Production server browser smoke | Authenticated page rendering/hydration, menus, dialogs, admin chrome, submit input and actual sign-out passed; no uncaught page exceptions |
| Dependency audit | Zero known vulnerabilities reported by npm |

All 37 direct dependencies were checked against the npm registry and match its
latest stable releases on the verification date. The stack includes React
19.3.0, TypeScript 7.0.2, TanStack Start 1.168.59, Router 1.170.40, Query 5.104.0,
Base UI 1.8.0, shadcn CLI 4.21.0, Tailwind CSS 4.3.3, Vite 8.3.1, Vitest 5.0.2,
and Lucide 1.48.0. shadcn components are owned source files using the Base UI
registry; they retain app-specific styling and compatibility wrappers. Node 24
LTS is the development baseline. A clean beta `npm ci` also passed.

Three independent Claude Opus 5.5 agents, each running at xhigh effort through
Herdr, reviewed runtime/data/auth, UI/accessibility, and dependencies/build/gate
reliability. Their findings were addressed and rechecked:

- Explicit reverse-proxy trust preserves strict native-form Origin checks behind
  TLS termination. Integration tests exercise the actual form parser through srvx.
- Step controls scroll after React renders the next step, without router reloads
  or extra browser-history entries. A phone regression blocks every server RPC
  and checks that selections, scores and scrolling still work.
- Expired sessions produce serialized server-function redirects instead of
  invalid shell data. Navigation and pull-to-refresh return to login; the built
  production handler separately verifies document 303 and RPC redirect semantics.
- Admin native-action feedback accepts route-owned keys instead of arbitrary URL
  text. Tests cover native success and spoofed messages on all three affected pages.
- Icon exceptions require matching geometry, rendered sRGB paint and effective
  opacity. A browser test confirms that equivalent RGBA/OKLab syntax compares
  equally while actual paint, visibility and overlap changes are rejected. Hidden icons and icons covered by popups or fixed navigation receive
  no exemption. The exception covers the listed Lucide icons' solid-color and
  `none` paints; gradients require a newly reviewed policy. Raw screenshots and
  pixel differences remain intact.

The original shell-cache, stale-mutation, superseded-save, HTTP/native-form,
pull-refresh failure, keyboard-picker, polling and transport-feedback repairs
remain covered by the shared, paired and beta regression suites. The upgrade
also corrected menu Tab/Escape focus, dialog initial selection and touch focus,
usable modal Close controls, and Tailwind spacing/input-size changes.

The previously reported reference MMR-delta failure did not reproduce in this
baseline. It passed against beta too, so neither gate uses an exclusion. One
earlier beta run encountered an expired Clerk session during a mutation; a fresh
seed rerun passed. The first step-navigation repair also failed its new regression
because native hash changes emit `popstate`; the final scroll-only repair passes.
The final beta browser gates ran after the application fixes, with no retries or
skips. The earlier reference baseline remains valid because its source and shared
assertions were unchanged. The build covers the final runtime source; TypeScript
and unit tests were also rechecked after the later collector-only change.

The visual matrix contains 59 scenes at 1440×1000 and 390×844. Pixelmatch uses
threshold 0.1 and default antialias handling. Only the advancing pending-match
countdown is masked. Updated Lucide Trophy, Calendar Days, Swords and circled-check
shapes, plus the small bounds of the repaired dialog Close control, are documented
improvements rather than exact copies of Svelte. 55 captures have zero raw differences. The other 63 contain only approved
differences: 4,606 raw differing pixels, all classified by the documented policy.
The full serial visual run took 12.8 minutes, with no skips, retries or flaky tests.

The local report is `frontend-beta/playwright-report/visual/index.html`.
Each scene's reference, beta, diff and metrics files are under
`frontend-beta/test-results/visual/`. Artifacts are intentionally ignored by Git.
See [the harness instructions](README.md) for coverage and reproducible commands.

At that checkpoint, five intentional runtime differences were documented in
[the harness README](README.md#intentional-behavior-differences): working token
creation, native POST response presentation, enhanced error feedback, independently
refreshed active-match lists, and progressive-step scrolling without URL fragments.
An expired mutation retains its form and shows failure feedback; subsequent
navigation or pull-to-refresh returns to login. This last feedback distinction
was reviewed in code, while navigation and refresh expiry have browser tests.

These results cover Chromium at the recorded widths, selected states and
interactions, not every possible browser/device combination. The shared suites
use Vite's development server; the separate production smoke verifies the built
srvx server and hydration but does not repeat the entire suite in production mode.
It checks rendered pages and a visible submit input; it does not separately assert
pre-hydration server HTML or exercise the full play flow. Its error collection
covers uncaught page exceptions, not every console message or failed request.

At that checkpoint, the rewrite was not a configured release component. No
component version had been manually bumped, and the Svelte application source
was unchanged. No deployment, push, or pull request had been performed.
