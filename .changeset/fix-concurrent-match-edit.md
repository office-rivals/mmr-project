---
"api": patch
---

Fix overlapping edits of the same match corrupting each other. The two edits
deleted the team rows the other had just rebuilt, and the loser failed on the
`match_team_players` foreign key after the winner had committed — a 500 for an
edit that had actually landed. Edits of a match now serialise on its row, and
both child deletes key off the match rather than a list of team ids read
earlier, so they cannot disagree about which teams they are clearing.
