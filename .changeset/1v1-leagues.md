---
"frontend": minor
"api": minor
"mmr-api": minor
---

Add support for 1v1 leagues, and replace `League.QueueSize` with `League.TeamSize` (the per-team player count) — `QueueSize` was the inverted way to think about the same concept. The queue requires `2 * teamSize` players. Migrating: existing `queue_size` values are halved into the new `team_size` column.

- **api**: rename `League.QueueSize` → `TeamSize` (column `queue_size` → `team_size`, values halved); validate `TeamSize >= 1`; enforce exactly two teams of equal size on match submission; expose `teamSize` on `MeLeagueResponse`. Wire format renames: `CreateLeagueRequest.queueSize` → `teamSize`, `LeagueResponse.queueSize` → `teamSize`, `MeLeagueResponse.queueSize` → `teamSize`.
- **mmr-api**: drop the hard-coded "exactly 4 unique players" rule and build team-player slices dynamically; both teams must still have ≥1 player and equal sizes.
- **frontend**: regenerated client (`teamSize` field); the create-league form has a 1v1 / 2v2 selector; the matchmaking page derives the required queue length from `teamSize * 2`; admin/league overviews display the format label ("1v1"/"2v2") instead of "Queue size N".
