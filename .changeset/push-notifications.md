---
"api": minor
"frontend": minor
---

Add Web Push (PWA) notifications for two events:

- **Match found** — fired when the matchmaking coordinator creates a pending
  match that includes the user.
- **Match reported** — fired after a match is submitted and MMR has been
  applied; the body shows the rating delta.

## How it works

- A new service worker (`src/service-worker.ts`) shows incoming pushes and
  opens the deep link on click.
- The frontend exposes an opt-in toggle on the existing Settings page. The
  browser's permission prompt is only triggered when the user clicks Enable;
  we never auto-subscribe.
- The API persists subscriptions in a new `push_subscriptions` table and queues
  deliveries in `notification_deliveries`. A new
  `NotificationDispatchBackgroundService` polls the queue and sends via the
  Web Push protocol with a VAPID-signed payload. Failures (e.g. 404/410) prune
  the subscription; retryable errors (5xx, 429) are rescheduled with
  exponential backoff.

## Configuration

Both services need a VAPID keypair (generate with
`npx web-push generate-vapid-keys`). Add these to the AppHost user-secrets for
local dev:

```bash
cd local-dev/MMRProject.AppHost
dotnet user-secrets set "Parameters:push-vapid-public-key" "..."
dotnet user-secrets set "Parameters:push-vapid-private-key" "..."
dotnet user-secrets set "Parameters:push-subject" "mailto:you@example.com"
```

For Azure, set the same three parameters as Container App secrets on the API
(`Push__Vapid__PublicKey`, `Push__Vapid__PrivateKey`, `Push__Subject`) and as
an env var on the frontend (`PUBLIC_VAPID_PUBLIC_KEY`) before running the
Deploy Release workflow. Until those env vars are set, the settings UI will
report "Not supported" — the stack otherwise boots unchanged.

## Caveats

- iOS Safari only delivers Web Push when the site is added to the home screen,
  and only on iOS 16.4+. The settings UI calls this out.
- The pre-existing `match-found.mp3` sound on the matchmaking page still
  fires when the tab is foregrounded; the OS-level `tag` deduplicates so
  users don't get a notification and a sound for the same event. The
  notification path is the only one that fires when the tab is backgrounded
  or closed.
- The push subscription endpoints are not yet rate-limited; if abuse becomes
  a concern, add them to the existing `RateLimitPolicies` enum.