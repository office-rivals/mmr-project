# Parity verification

Verified locally on 2026-09-10 on `feat/frontend-beta`, through `df8800e`.
The reference `frontend/src` was byte-identical to `origin/main`; no shared
Playwright tests were changed during this parity catch-up.

| Gate                                                            | Result                                 |
| --------------------------------------------------------------- | -------------------------------------- |
| Shared Svelte reference suite                                   | 96 passed, no skips or flaky tests     |
| Shared beta suite                                               | 96 passed, no skips or flaky tests     |
| Beta HTTP, native-form, cache, refresh, and polling regressions | 18 passed                              |
| Visual matrix                                                   | 118 comparisons, zero differing pixels |
| Complete visual runner, including fixtures and keyboard test    | 123 passed                             |
| TypeScript                                                      | Passed                                 |
| Vitest                                                          | 75 tests passed across 10 files        |
| Production build                                                | Passed                                 |

The previously reported reference MMR-delta failure did not reproduce in this
baseline. It also passed against beta, so neither gate used an exclusion.

The visual matrix contains 59 scenes at 1440×1000 and 390×844. The metric is
pixelmatch with threshold 0.1 and its default antialias handling, with zero
allowed differing pixels; this is not a claim of byte-identical PNG files.
Only the advancing pending-match countdown is masked. No cosmetic differences
are accepted. See [the harness instructions](README.md) for coverage and commands.

The final local report is `frontend-beta/playwright-report/visual/index.html`.
Each scene's reference, beta, diff, and metrics files are under
`frontend-beta/test-results/visual/`. These artifacts are intentionally ignored
by Git. The full visual run took about 14 minutes and used one worker.

There is one explicit native-form presentation difference: a failed native
POST returns a separate escaped error document with the correct HTTP status,
instead of SvelteKit's original form page with action data. Enhanced forms retain
inline feedback. The rationale and HTTP contract are documented in
[the runtime contract](../../plans/frontend-beta/specs/10-runtime-contract.md).

The rewrite is not a configured release component yet; these changes do not
bump or release the unchanged Svelte frontend. No deployment, push, or PR was
performed.
