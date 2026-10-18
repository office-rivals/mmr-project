# SCRIPT — scoreboard (approved by lead 2026-10-15, with lead's updates; v2 earcons, L5/L7/L8/L11 re-voiced, v5 board + L3, lead 2026-10-15)

**Film:** how the scoreboard works. Outputs: `video/scoreboard.mp4` (subtitles drawn in),
`video/scoreboard-cc.mp4` (switchable subtitle track), `video/scoreboard.en.srt`. English only for now.
Build: `video/film/tools/build.sh scoreboard` (the goal-counter film's tools, pointed at this folder).
**Voice:** George (`bm_george`, Kokoro, local), speed 1.0. Same narrator as the goal-counter film: dry,
deadpan, a nature-documentary calm about something very silly. Never sells.
**Look:** the goal-counter film's look (paper, ink, one accent; Archivo Black + IBM Plex Mono; one big
on-screen line at a time, bottom left; subtitles below it; accent wipes where time jumps).
**Sync:** text in `{braces}` marks a sync point: the visual or on-screen line lands 0.3 s before that word.
It isn't spoken. The narration never reads an on-screen line word for word.

**Ground truth:** `ux/SCOREBOARD-UI.md` (incl. Scan-in, LEDs, Sound), `ux/PHYSICAL-UX.md`, and the screen
mockups. The board's screen shows real mockups, drawn by ux's generator (`ux/mockups.py`) at the panel's
400 × 300: the ones in `ux/out/` plus a few film states made with the same code (`tools/screens.py`), so
one story runs through them (names Alice, Bob, Carol, Dave, Eve). The goal counter gets one beat (L5).

**The stage:** one stylised view of the scoreboard (mechanical v5, `mechanical/out/scoreboard_preview.png`), held
the whole film: the 50° face seen from the players' side, the top edge and both side walls just visible (the phone
tag on the left wall, the speaker grille on the right). On the face: the e-paper under the anti-glare PC window on
the left, the glossy opal LED bar (one segment per key, lit in the player's colour) and the 4 MX keycaps (3 mm
proud) under the screen, and in the right wing the cream translucent badge target (ID-card mark + "badge"): a
soft white blink while the reader listens, white on touch, the player's colour for 1 s on a join. Not an exact
render. The screen changes like e-paper: a partial update is a quick redraw; a full refresh is the
black/white blink. The board's sounds are ux's v2 earcons (`ux/SOUNDS-V2.md`: Goal, Won, Undo, Scan, Joined,
Not joined, Saved), ux's own WAVs at ux's relative levels; key presses get a switch click.

---

## Line 1 — Asleep (s1)
**On screen:** "Asleep, and still readable."
**Visual:** the board settles in. Screen: Idle (`01b`: "Last game 10 : 7 … Press a key, then tap your badge →").
All lights off.

    This is the scoreboard. It sleeps, but the e-paper still shows the {cap}last game.

## Line 2 — Wake (s1)
**On screen:** —
**Visual:** `{key}` a key dips (click): Waking (Wi-Fi icon). `{bump}` the board jolts (table bump).
`{wake}` the Lobby (`18`, "Tap your badge →"); the target starts its soft listening blink.

    {key}Press any key, or {bump}bump the table, and it {wake}wakes.

## Line 3 — Badge (s2)
**On screen:** — (the strip says "✓ Bob joined")
**Visual:** `{tap}` a badge card is pressed onto the target in the right wing; just before `{blip}` the Scan blip, the target
lights white (the tap is held ≥ 0.3 s); the card lifts off, and ~0.3 s later `{joined}` the Joined chirp, the
screen shows `18b` ("✓ Bob joined"), the target glows Bob's colour for 1 s, and the LED bar segments above
Alice's and Bob's slots light in their colours. The narrator echoes the two sounds ("Bip." "Bidi-ding.").

    {tap}Tap your badge on the right. {blip}Bip. {joined}Bidi-ding. Bob's in, and the badge target glows in his colour.

## Line 4 — Teams (s2)
**On screen:** "Teams: yours, random, or fair."
**Visual:** just before: Carol and Dave tap in (blip, then the Joined chirp, for each). `{allin}` "✓ Dave joined", "All in!" with
the three ways to make teams (`18d`): K2 "Choose", K3 "Random", K4 "Fair". `{choose}`, `{random}`, `{fair}` each label
lights in turn (label inverted, its LED white). `{make}` K4 click: "Fair teams", Carol · Dave | Alice · Bob, LEDs
steady in each player's colour. `{swap}` K2 "⇄ Swap sides": the halves trade places, the LEDs follow.

    {allin}All in? {cap}{choose}Pick your teams, {random}draw them at random, {fair}or let M M R make them {make}fair. {swap}Wrong ends? Swap sides.

## Line 5 — Goals (s3)
**On screen:** "Goals arrive by themselves."
**Visual:** `{play}` full refresh to Live (7 : 5), LEDs off. `{goal}` nobody touches anything: the Goal
sound, the left side's two LEDs blink twice in Alice's and Bob's colours, and the screen goes to "GOAL! Who
scored?" (8 : 5).

    Then just {play}play. {goal}Goals turn up {cap}by themselves, with a little ding.

## Line 6 — Who scored (s3)
**On screen:** "Who scored? Optional."
**Visual:** `{who}` the four name labels; `{own}` K3 click: "Oops! Own goal, Carol" (Carol is on the right
team and the left team scored, so the spec records an own goal).

    {who}{cap}Who scored? Press a name, or don't. {own}Carol, apparently. Own goal.

## Line 7 — Undo (s3)
**On screen:** "Undo asks first."
**Visual:** Live 8 : 5. `{undo}` K1 click: "Undo last goal? 8 : 5 → 7 : 5" (Cancel / ↶ Undo); `{down}` K4
click, the Undo sound (G6 → C6, falling), back to Live at 7 : 5.

    {undo}{cap}Not a goal? Undo asks first, {down}then plays the ding backwards.

## Line 8 — Won (s4)
**On screen:** "Rematch: same teams."
**Visual:** Live 9 : 7. `{won}` the Won sound (a short celebration), the left LEDs blink 4 times, Finished: WINNER, 10 : 7,
"9:26 · MVP Alice" (not narrated), "Saving to MMR in 8 s" with only ↶ Undo; `{count}` the countdown steps
down (6, 4, 2); `{saved}` "Saved to MMR ✓" with the Saved sound (v2), K4 "Rematch"; `{rematch}` K4 click: Teams at 0 : 0, same four.

    {won}The winning goal gets a little celebration. {count}Ten seconds to undo, {saved}then it's in M M R. {rematch}Same four again? {cap}Rematch.

## Line 9 — Unknown badge (s5)
**On screen:** "Any colleague can link it."
**Visual:** a new lobby (Alice, Bob). `{unknown}` a blank badge taps the target (blip, white); the Not joined
note, the target goes dark for 1 s, and screen `21` ("Badge not known", QR, "Link this badge: … you or any
colleague can scan"). `{link}` a phone rises and frames the QR. `{mate}` it asks "Whose badge is this?"; "It's
someone else's" is tapped, then Eve; `{in}` "Link this badge to Eve?" is tapped, and Eve appears in the lobby
with her LED segment lit (no chirp: nobody tapped).

    {unknown}An unknown badge gets a QR code. {link}Scan it yourself, or let a {mate}{cap}colleague do it for you. {in}Link the badge, and you're in.

## Line 10 — Volume (s6)
**On screen:** "No secret mute combo."
**Visual:** `{admin}` the board slides left; an admin card comes in: "Scoreboard sound: Off / Low / Medium /
High" (words), each word lit as it is said, ending on Medium (the default). `{combo}` a small diagram card,
"hold two keys to mute", gets a big accent ✗. (Not acted out on the board: the spec reads two keys pressed
together as K1, so a real two-key press would do K1's job.)

    {admin}Volume lives in the admin settings: {off}Off, {low}Low, {med}Medium, {high}High. {combo}{cap}No secret key combo. We know our colleagues.

## Line 11 — Batteries (s7)
**On screen:** —
**Number:** scoreboard battery life: see INTERFACES §0 (speaker build; a range, EST until the bench; spoken as "about two and a half to three"). Next re-voice: electronics suggests "about two to three months" (or the bench figure, once measured).
**Visual:** three AA cells drop in beside the board; `{months}` a month bar fills to 2.3, then a lighter band to 3.3: the estimated range from INTERFACES §0 ("est."). `{flat}` the cells
grey out, full refresh to "Change batteries · 3 × AA", all lights off, and the board stays like that.

    Three AA batteries, about {months}two and a half to three months a set, by our estimate. {flat}When they're flat, it says so.

## Line 12 — Close (s7)
**On screen:** "It keeps score. You play."
**Visual:** fresh cells; one full refresh back to Idle (`01b`); the board sits still.

    {cap}It keeps score, so you don't have to.

---

### Fixed texts (`tools/strings.json`)

| Key | Text |
|---|---|
| chrome | MMR PROJECT · SCOREBOARD |
| admin card | Scoreboard sound: Off / Low / Medium / High |
| phone (frontend-beta `cards.tsx`) | Whose badge is this? / This is my badge / It's someone else's / Eve / Link this badge to Eve? |
| combo card | hold two keys to mute |
| month bar | months (est.) |

### Claims check (each against the spec)

| Line | Claim | Source |
|---|---|---|
| L1 | The e-paper shows the last game while asleep, at zero power | UI 01 Idle |
| L2 | A key or table motion wakes it (a badge can't) | UI 01/02, Scan-in 1 |
| L3 | Badge target in the face's right wing (v5); tap ≥ 0.3 s; Scan blip + white on touch; Joined chirp + "✓ Bob joined" after release; target in the player's colour 1 s; the LED bar segment above the slot | PHYSICAL-UX badge target + LED bar, Scan-in 3, LEDs, Sound |
| L4 | "All in!" → three ways to make teams: K2 Choose, K3 Random, K4 Fair (one press, not automatic); Fair = balanced by MMR; K2 "⇄ Swap sides" | Scan-in 4, 5, ux 18d/19 (user decision: team modes) |
| L5 | Goals reach the board without anyone pressing anything; Goal sound; scoring side's LEDs blink twice | Sound, LEDs |
| L6 | Who-scored is optional (15 s, then unset); picking the other team's player records an own goal, "Oops! Own goal, Carol" | UI 08, 09 |
| L7 | Undo opens a confirm first; Undo sound = goal sound backwards and slower | UI 10, Sound |
| L8 | the Won sound (a short celebration, not a fanfare) instead of the goal sound; 10 s after the winning goal it is rated, Undo cancels until then; "Saved to MMR ✓"; K4 Rematch = same teams | UI 12, Auto-submit 12d/12c, Scan-in 9, Sound |
| L9 | Unknown badge → Not joined note, target off 1 s, QR "you or any colleague can scan" → any signed-in colleague links it for the player → joined at once, no chirp | Scan-in 7, Sound, LEDs, frontend-beta cards page |
| L10 | Volume Off/Low/Medium/High only in admin, default Medium; no key combo | Sound: Volume and mute |
| L11 | 3 × AA, battery life per INTERFACES §0 (scoreboard row, speaker build); "Change batteries" stays on screen at zero power | INTERFACES §0, UI 16 |
