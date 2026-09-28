# Parity verification

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
| Production server browser smoke | Authenticated SSR/hydration, menus, dialogs, admin, play form and actual sign-out passed; no page errors |
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
reliability. Their actionable findings were fixed and rechecked:

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
  no exemption. Raw screenshots and pixel differences remain intact.

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
Final gate results above are fresh runs after the fixes, with no retries or skips.

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

Five intentional runtime differences are documented in
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

The rewrite is not a configured release component yet. No component version was
manually bumped; the Svelte application source is unchanged. No deployment, push,
or pull request was performed.
