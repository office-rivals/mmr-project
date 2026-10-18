# STORYBOARD: teaser (approved by lead 2026-10-15: beads, not a pen; beat 6 = three team modes, user). Updated after the user's feedback (intro, beam, system, org chart)

**Film:** a 44.5 s teaser, "Just because we can": the over-engineering is the joke. No voice, no music:
sound effects only (the board's own buzzer jingles from `ux/SCOREBOARD-UI.md` § Sound plus synthesized foley).
On-screen text carries everything and works muted. No captions file.
**Sounds (2026-10-15):** the board's sounds are ux's v2 earcons (`ux/SOUNDS-V2.md`), ux's own WAVs.
**Look:** the goal-counter film's (paper #f2efe8, ink, one accent #e8431f; Archivo Black lines, IBM Plex Mono
footer asides; accent wipes between acts). Reuses the film's beam/network drawings and renders and the
scoreboard film's board + ux's real screens.
**Comic shape:** the table's bead counter does the job → three big "for a table game" beats with stingers → the beats speed up
→ a dead-silent pause → the punchline → a button with the beads.
**Output:** `video/teaser.mp4` + `video/teaser-poster.png`; own project `video/teaser/`, build target
`tools/build.sh teaser`.

| # | s | On-screen line (one at a time) | Visual | SFX |
|---|---|---|---|---|
| 1 | 0.0–3.0 | "Foosball. Scored with beads." · aside: "since forever" | the table's bead counter; beads slide along the rail by hand | bead clack ×4 |
| 2 | 3.0–6.4 | "The beads worked fine." → (pause) → "But we can do better." | the beads sit still; then the counter whooshes away | silence → whoosh |
| 3 | 6.4–10.4 | "A beam of light." → "To count a ball." | a security-camera view of a vault ("CAM 03 · GOAL", REC): one red laser; the ball rolls in, stops in the beam, red "INTRUDER" alarm, then "GOAL +1" and it rolls on | beam bip, tiptoe plucks, alarm, ding |
| 4 | 10.4–15.4 | "A server." → "For a table game." · aside: "they don't gossip" | the system, top-down: the table, a goal counter (sled) in each goal's drawer, one scoreboard on the end shelf, the server above (fans, lights). A goal at the right end: its packet goes to the server, which thinks, and back to the scoreboard (1 : 0); a dashed line between the two goal counters is crossed out; then the left end does the same (1 : 1) | thud, bip, packet zip up, server "thinking" (relay ticks + three rising blips), zip down, Goal ba-ding (×2), thud |
| 5 | 15.4–19.0 | "A badge reader." → "For foosball." | the scoreboard; a badge taps the target in the right wing (v5); the target glows; "✓ Bob joined" | Scan blip, Joined "bidi-ding" |
| 6 | 19.0–23.5 | "Teams? Pick your own." → "Or random." → "Or fair, by MMR." · aside: "friendship-preserving mode included" | "All in!" with three mode keys (provisional labels Choose / Random / Fair, until ux's spec); each lights in turn; K4 Fair → Teams made | soft pop ×3, key click, pop |
| 7 | 23.5–27.0 | "Auto-saved 10 s after the win." · aside: "undo until then" | Finished, countdown 8 → 6 → 4 → 2 → "Saved to MMR ✓" | Won fanfare, ticks, ding |
| 8 | 27.0–29.0 | "A digital twin." → "Of a foosball table." | a blueprint ghost of the board slides out of it | whoosh |
| 9 | 29.0–32.5 | "34 metrics." · chips "MVP", "Comebacks", "Own goal of the month" | the chips pop in; the last one droops | pops, the Undo jingle as a sad trombone |
| 10 | 32.5–35.4 | "Built by 14 AI agents." · aside: "one of them made this" | hub and spoke: lead in the centre, the 13 specialists around it, each with one line to lead, faint dashed lines between neighbours (they talk to each other); the "video" card lights up | 14 fast key clicks, pop |
| 11 | 35.4–36.6 | — | empty paper | silence |
| 12 | 36.6–39.1 | "Just because we can." | big, centred | Goal "ba-ding" |
| 13 | 39.1–42.9 | "Coming to a foosball table near you." | the goal counter (stylised sled) beside the scoreboard (Idle) | Won fanfare |
| 14 | 42.9–44.5 | aside: "The beads have been informed." | a small bead rail; one bead slides back | one bead clack |

Exact cue times: `tools/cues.json`. The sled is a stylised drawing of mechanical's v4 concept (pull-out sled, 3 × AA + board,
V-wall into a 40 mm gate with the beam along one wall, balls queueing past the beam); the old v3 insert render isn't used.

**Claims check:** IR break-beam counts goals (INTERFACES §1); the goal counter posts goals to the API;
badge reader on the scoreboard (SCOREBOARD-UI Scan-in); teams balanced by MMR (Scan-in 5); rated 10 s
after the winning goal, Undo cancels until then (Auto-submit 12d/12c); the twin runs virtual tables
(2 goal counters + 1 scoreboard each; `team/briefs/twin.md`); 34 metrics incl. MVP, M2 comebacks and O2
"Own goal of the month" (`analytics/METRICS.md`); 14 agents = lead + 13 specialists incl. coach (`team/briefs/`).
