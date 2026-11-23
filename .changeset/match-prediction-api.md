---
"api": minor
---

Add `GET /api/v3/organizations/{orgId}/leagues/{leagueId}/match-predictions?pendingMatchId=…`, which returns each chosen match's team `winChance` and each player's `mmr`, `mmrIfWin` and `mmrIfLose` (null while the player is still placing this season). Live matches are predicted for anyone in the league, found matches for their players only.
