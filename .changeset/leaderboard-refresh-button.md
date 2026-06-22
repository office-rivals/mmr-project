---
"frontend": patch
---

Add a refresh button to the leaderboard page that re-runs all SvelteKit loaders
via `invalidateAll()` so an organizer can pick up newly reported matches without
a full page reload. The icon spins while invalidation is in flight and the
button is disabled to prevent duplicate requests.
