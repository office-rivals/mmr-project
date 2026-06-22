---
"api": minor
"frontend": patch
---

Show each player's last 5 results as colored dots in the leaderboard. A new "Form" column appears between Losses and Score on the league-page leaderboard, and a matching Form indicator is rendered on the player profile page and in the user-stats modal. The API now returns a `recentForm` field on each `LeaderboardEntryResponse` containing the 5 most recent results (most-recent-first) for the active season.
