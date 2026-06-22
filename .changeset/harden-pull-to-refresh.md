---
"frontend": patch
---

Harden the PWA pull-to-refresh gesture:

- Ignore pulls that start on surfaces owning their own touch gestures (the
  `/random` touch randomizer), so its multi-finger flow no longer triggers a
  spurious refresh.
- Only attach the global touch listeners in standalone (installed) mode, and
  resolve standalone status once instead of on every gesture.
- Handle `touchcancel` so an interrupted pull no longer leaves the spinner
  stuck on screen.
- Restrict the gesture to a single finger and only commit once the last finger
  lifts, fixing multi-touch origin/commit glitches.
- Surface a brief error state (instead of silently resetting) when the refresh
  fails, and expose the refresh state to assistive tech via an `aria-live`
  status region.
- Render the indicator beneath the app-shell header (`z-20`) so it emerges from
  under the header as intended.
