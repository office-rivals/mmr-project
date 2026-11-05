# Game invite implementation validation

The API and beta frontend implement the agreed [design](game-invites.md). Changes include a database migration, per-component minor changesets, public beta documentation, and regression coverage. Application versions have not been manually changed.

## Checks

| Check | Result |
| --- | --- |
| `dotnet test api/MMRProject.Api.IntegrationTests --no-restore` | 287 passed |
| Beta `npm test` | 174 passed, including 11 invite component interaction tests |
| Beta `npm run check` | Passed |
| Beta `npm run build` | Passed |
| Docs `npm run check` | Passed, zero diagnostics |
| Docs `npm run build` | Passed |
| Docs `npm run check:links` | Passed, 20 pages |
| Formatting of new beta modules and invite e2e spec | Passed |
| `git diff --check` | Passed |
| Beta `npm run e2e` | Blocked before browser tests: MMR service requires `ADMIN_SECRET` |

The same full e2e command was attempted from a clean source snapshot of base commit `62a72459c86de1ea27046621bd58f25e0fddbcec`, using a real `npm ci`. It stops at the same missing `ADMIN_SECRET` error. This establishes an environment blocker; it does not establish that browser behavior passes on either version. Clerk application keys, the Clerk test-account configuration, and standalone service configuration are also absent locally. Restore those through the existing local setup instructions before running the main and feature suites again.

The new browser spec covers creation, sharing, reload persistence, queue exclusion, cancellation, player addition/removal, unknown links, and the logged-out sign-in redirect. It has not executed. Multi-user browser flows remain unverified. Component tests cover both representative leave choices, Escape/focus restoration, direct leave after self takeover, takeover during acceptance, proxy acceptance with the displayed round, invite-specific reads, completion notices to other participants, and unavailable shared invites. API integration tests cover multi-user state transitions, permissions, deadlines, commitment races, concurrent groups, and the existing result/rating path.

## Standards review

Separate Haiku 5.5 review identified a public documentation mismatch and possible maintainability or UI issues. The documentation now states the creator-decline/timeout cancellation rule. Follow-up fixes use the shared Button primitive for the player picker, identify the viewer by player ID in attribution, reject creating a different invite from an unavailable shared-link view, filter out selections concurrently added to the roster, and stop polling terminal invites. Module splitting and naming suggestions were advisory and did not block implementation.

## Specification review

Separate Haiku 5.5 review identified four frontend gaps. The public docs now include creator cancellation; shared-link previews include sharing and the countdown; participants use the full live invite controls from the link; non-acting participants receive completion/removal notices instead of silently losing the invite. Queue-exclusion copy distinguishes leaving an open invite from declining during acceptance. Parent review also corrected takeover controls during acceptance and authenticated sign-in return handling.

## Backend review

Parent review added final roster validation and regression tests to prevent starting an invalid match after a league-format change or represented player's membership removal. The creator can cancel such an invite, and the ordinary acceptance deadline still releases or reopens it; there is no separate configuration-change cancellation policy.

A fresh Haiku 5.5 backend review found that membership claim merging could be blocked by historical invite creator foreign keys. The merge now transfers those references to the surviving league player. Live invite participation blocks claim creation/approval, and approval serializes its activity check and merge with league commitments. Three added regression cases pass along with the full API suite.

League-format changes during an outstanding invite can still require cancellation and recreation; automatic roster adaptation is outside the agreed scope. Revoking a representative's organization access does not transfer their players immediately; the ordinary readiness deadline still applies. The implementation retains the creator as the group's anchor when another player interrupts a round before the creator has responded; an actual creator decline or deadline timeout cancels the invite.
