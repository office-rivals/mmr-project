---
"api": minor
---

Add game invites: league players can create a shared invite link, join it, and add league players, then accept shuffled teams before the game starts through the existing result flow. New endpoints live under `api/v3/organizations/{orgId}/leagues/{leagueId}/game-invites` and `api/v3/game-invites/{shareCode}`.
