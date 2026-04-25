---
"frontend": minor
"api": minor
---

Restore feature parity with the old UI on the v3 routes:

- Leaderboard: wins/losses columns, current+prior winning/losing streak emojis, MMR sparkline, "Unranked" divider, current-user highlight, click row to open user stats modal, MMR toggle, default to current season.
- Player profile: extended KPIs (Last match, Streak), most-common-opponents and most-common-teammates tables, match filter, profile player pinned to the top-left of every match card, Settings/Logout buttons, season picker.
- Statistics: line chart restored + heatmap of match frequency by day-of-week and hour-of-day.
- Submit match: step-by-step UX (player picker → who won → loser score → preview), inline new-player dialog with optional email, primary-player + last-10-players persistence in localStorage.
- Active match submit: same step-by-step UX, current user's team rendered first.
- Matchmaking: pending-match accept/decline dialog with per-player acceptance status, 30s countdown, sound on match found.
- Layout: bottom navbar lifted to the (authed) layout so it persists across `/random` and `/settings`; queue-size badge on the matchmaking icon.

Backend changes that back the UI:

- `LeaderboardEntryResponse`: add `wins`, `losses`, `winningStreak`, `losingStreak`; `mmr` is nullable (null when player has fewer than 10 ranked matches).
- New `GET /rating-history` (league-wide) endpoint for sparkline data.
- New `?leaguePlayerId=` filter on `GET /matches`.
- New `GET /statistics/time-distribution` endpoint for the heatmap.

Adds backend integration tests for the new contracts and a Playwright e2e suite (workflow_dispatch only) with a vendored seed under `scripts/seed-data.sql`. See `docs/local-development.md`.
