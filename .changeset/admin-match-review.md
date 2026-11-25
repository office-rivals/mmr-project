---
"frontend": minor
"api": minor
---

Show admins the matches played just before and after a flagged match in the same season, with likely duplicates marked, and let them delete the match from the report. Deleting a match now asks for its score to be typed, and puts every player who hasn't played since back to their rating from before the match, so a recalculation afterwards leaves every rating right. Adds `GET …/matches/{matchId}/neighbours`.
