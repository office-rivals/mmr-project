---
"api": minor
---

Add an optional `prediction` to pending and active matches in the v3 queue status, pending match and active matches responses, with each team's `winChance` and each player's `mmr`, `mmrIfWin` and `mmrIfLose` (null while the player is still placing this season). It is null when the MMR API is unavailable.
