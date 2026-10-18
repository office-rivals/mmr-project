# Claim flow: speed review (ux → admin-ui)

The draft is good: one page, the match preselected, no score entry, everyone visible at once.
Suggestions are ordered by how much time they save.

1. **Count real taps.** A pick from recents is *tap the field + tap the name* = 2 taps, so the best
   case for 2v2 is 1 + 3 × 2 + 1 = **8 taps**, not 5. Fix: show the recents as **chips under each
   end** (top 4–6 league players, minus those already placed). One tap fills the next empty slot of
   that end. Keep the combobox for search and new players. → 5 taps for real.
2. **"Same players as last match"**: one button above the columns that fills all slots with the
   previous claimed match at this table, plus a **⇄** to swap the two ends. Office games mostly
   repeat the same four people. → **2 taps** (fill + Save), 3 if they changed sides.
3. **Players know their team by its score, not the end label.** "I played at Window" makes people
   work out which goal is "Window". They do remember "we won 10–7". Lead each column with the big
   score (as now), keep the end label small, and shorten the button to **"Me"**.
4. **Order the columns as the scoreboard shows them.** The board shows the left/right halves of the
   table. Put the column of the end on the board's left on the left (backend knows which end the
   board sits at), so the app looks like the board everyone just watched.
5. **Show the end labels on the board for unclaimed matches** (ux will do this). An unclaimed match
   has no names, so the board's empty names row shows "Window" / "Door" instead. Board and app then
   use the same words.
6. **Open the page without navigating**: a QR sticker on the table that links to its claim page. The
   admin UI can print it per table (generated at runtime: the URL is deployment-specific, so it
   never goes in the repo). This saves more time than any change to the form itself.
7. Small things:
   - After Save, show a toast ("Saved: Window 10 – 7 Door") on the league home, so people know it
     landed.
   - When Save is disabled, outline the empty slots so it's obvious why.
   - If a match was linked to the table in the app (players known), it needs no claim. Don't list
     it under "Who played?".

Pass target for a hallway test: someone who just played claims a 2v2 in **≤ 15 s from the phone
being unlocked** (QR) without help.
