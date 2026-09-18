# Parity verification

Reverified locally on 2026-09-18 on `feat/frontend-beta`, with runtime fixes
through `a26cc56`. The reference `frontend/src` was byte-identical to freshly
fetched `origin/main` (`92f2e34`). Neither reference source nor shared Playwright
tests were changed during this second pass.

| Gate                                                            | Result                                 |
| --------------------------------------------------------------- | -------------------------------------- |
| Shared Svelte reference suite                                   | 96 passed, no skips or flaky tests     |
| Shared beta suite                                               | 96 passed, no skips or flaky tests     |
| Paired behavior runner                                          | 53 passed: 49 cases and 4 setup tests  |
| Beta HTTP, native-form, cache, refresh, and polling regressions | 18 passed                              |
| Visual matrix                                                   | 118 comparisons, zero differing pixels |
| Complete visual runner, including fixtures and keyboard test    | 123 passed                             |
| TypeScript                                                      | Passed                                 |
| Vitest                                                          | 75 tests passed across 10 files        |
| Production build                                                | Passed                                 |

The previously reported reference MMR-delta failure did not reproduce in this
baseline. It also passed against beta, so neither gate used an exclusion.

The original shared suite passed before this second pass, but additional paired
tests exposed real gaps. Fixes cover picker focus, highlighting, keyboard and
touch selection, long-list scrolling, menu Tab behavior and accessible groups,
modal semantics, disabled pagination, invite reset timing, feedback after
navigation and delayed reloads, and the reference document title. The visual
rerun also caught the originating player picker disappearing behind its own
creation dialog; that state now survives opening and cancelling the dialog.

The paired suite additionally checks pending-match acceptance/decline, report
pagination and cancellation, and randomizer persistence and touch interactions.
These assertions run against both apps; this is measured coverage, not a claim
that every possible browser interaction has been exhaustively proven identical.

One intermediate shared run failed queue entry when its server-function POST
returned HTTP 303 and the UI showed `Failed to join queue`. The fresh-seed
isolated rerun and the subsequent complete 96-test run passed without a source
change. A session/authentication transient is suspected; the final run had no
retries, skips, or exclusions. An earlier superseded-save failure was a real
accessibility issue with late feedback under a reopened modal and was fixed,
then verified in both focused and complete runs.

The visual matrix contains 59 scenes at 1440×1000 and 390×844. The metric is
pixelmatch with threshold 0.1 and its default antialias handling, with zero
allowed differing pixels; this is not a claim of byte-identical PNG files.
Only the advancing pending-match countdown is masked. No cosmetic differences
are accepted. See [the harness instructions](README.md) for coverage and commands.

The final local report is `frontend-beta/playwright-report/visual/index.html`.
Each scene's reference, beta, diff, and metrics files are under
`frontend-beta/test-results/visual/`. These artifacts are intentionally ignored
by Git. The full visual run took 13.2 minutes and used one worker.

Four intentional runtime differences remain: supported token creation, native
POST response presentation, enhanced error statuses/transport feedback, and
independently refreshed active-match lists. Their rationale and evidence are
listed in [the harness README](README.md#intentional-behavior-differences), with
the HTTP details in
[the runtime contract](../../plans/frontend-beta/specs/10-runtime-contract.md).
The paired token cases explicitly confirm that the current Svelte form fails
with its unsupported scope while beta creates and revokes the token successfully.

The rewrite is not a configured release component yet; these changes do not
bump or release the unchanged Svelte frontend. No deployment, push, or PR was
performed.
