# Runtime and form contract

This supplement supersedes the rewrite specs wherever they describe stale query
invalidation, successful HTTP envelopes for failed actions, JavaScript-only
SSR forms, or accepted cosmetic drift. Known reference bugs and older icon
drawings need not be copied.

## Shell lifecycle

Every authenticated navigation/invalidation fetches one fresh shell snapshot in
`_authed.beforeLoad` or `admin.beforeLoad`. Descendants resolve organization
and league identifiers from `context.authedShell` or `context.adminShell`. `ensureQueryData` and unobserved query invalidation
are not a freshness guarantee. The shell-cache regression starts with a cached
organization missing a newly joined league and verifies replacement before
resolution. Loader-only league listings, invitation details, and admin badge
counts also use fresh query reads.

Play mutation state is scoped by league and active-match ID. The active-match
list polls independently of whether the current user has an active match.
Pull-to-refresh first refetches cached data and checks the shell snapshot,
so a failed preflight leaves the existing page available for failure feedback.
It then awaits synchronous router invalidation and checks loader failures. Admin saves remain pending through their
loader refresh; a superseded dialog generation cannot close a later dialog.

Progressive match steps scroll after rendering without router navigation, URL
fragments or extra browser-history entries. This avoids a shell refetch that
could otherwise discard entered data after a network failure.

## HTTP and native forms

Enhanced mutations use TanStack Start server functions. Validation and API
failures set their actual HTTP status and return typed action feedback. A
transport exception also produces visible feedback. A failed action is never
reported as HTTP 200 merely because its result was serialized successfully.

Authentication redirects use TanStack's redirect protocol: documents receive
HTTP 303, while server-function requests receive a serialized redirect for the
router to follow. Expired sessions return to login on navigation and refresh.
An expired mutation instead retains its form and shows failure feedback until
the next navigation, unlike Svelte's immediate redirect.

SSR-visible mutation forms have explicit POST methods and same-route actions.
Their `_action` field selects a server handler that uses the same business
implementation as the enhanced path. Native handlers check Origin before
parsing/processing mutations. Invite email, display name, and username remain
in the request body and are not reflected into redirect URLs.
Behind HTTPS-terminating proxies, the server requires an explicit `TRUST_PROXY`
policy so the Origin check compares against the original request scheme.

The native response rendering differs from SvelteKit in two explicit ways:

- Success uses POST/Redirect/GET (303) and, where applicable, a generic success
  message in the redirected page. This also prevents refresh from repeating a
  successful mutation. Admin redirects use route-owned keys mapped to static
  messages; arbitrary query text is never rendered as success feedback.
- Failure returns an escaped error document with the original HTTP status.
  It does not re-render the original form with SvelteKit's `form` action data.

TanStack Start has no equivalent to SvelteKit's implicit action-data channel
that feeds `fail(status, data)` back into the page renderer. The beta uses
explicit raw POST handlers and preserves the mutation, status, privacy, and
feedback semantics; native error presentation is therefore a separate document.
Enhanced forms retain inline feedback and entered state. Dialogs and multi-step
controls that require JavaScript to become available continue to require it.

Regression coverage lives in `frontend-beta/e2e/*.functional.spec.ts`; run
`npm run e2e:regressions` in `frontend-beta`, separately from other seeded suites.
