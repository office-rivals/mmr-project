---
"api": minor
"frontend": minor
---

Make the per-match winning score configurable per league. Leagues now expose a nullable `winningScore` field; when set (e.g. 10 for foosball, default), the winning team must score exactly that and the loser scores 0..(winning_score-1), matching the previous behaviour. When null, scoring is free-form: both teams enter raw scores and the higher score wins — useful for table tennis, badminton, etc. The submit form switches between the existing button picker and dual numeric inputs based on the league's config. Existing leagues are backfilled to 10 by the migration; the API derives `is_winner` server-side from the scores. No MMR recalc needed — score magnitudes don't affect openskill output.
