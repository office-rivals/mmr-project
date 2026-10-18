# Goal-counter film redo (EN + DA) + goal-counter short teaser (lead ACTION, 2026-10-17)

Not published: for the user to watch first (lead). Nothing committed. The previous renders are kept locally as
`goal-counter-v3.mp4`, `goal-counter-cc-v3.mp4`, `goal-counter-da-v3.mp4` (all *.mp4 are gitignored).

## Outputs (all decode cleanly, `ffmpeg -xerror`)

| File | Length | Loudness | Notes |
|---|---|---|---|
| `video/goal-counter.mp4` / `goal-counter-cc.mp4` | 122.97 s (was ~101) | −14.1 LUFS | cc: soft English track, on by default; `goal-counter.en.srt` |
| `video/goal-counter-da.mp4` / `goal-counter-da-cc.mp4` | 122.30 s | −14.2 LUFS | cc: soft Danish track; `goal-counter.da.srt` |
| `video/goal-counter-poster.png`, `goal-counter-da-poster.png` | — | — | same moment as before ("Ball blocks the beam: goal."), new diagram |
| `video/teaser-short-counter.mp4` + `.jpg` | 8.2 s | −16.0 LUFS | SFX only; still = the beam broken |

## What changed in the film

| Scene | Before | Now |
|---|---|---|
| s2 beam diagram | symmetric funnel (insert v3) | mechanical/sled.py from above at 3.6 px/mm: L with its 45° V-wall, the 40 mm channel, R's pod, beam at s 194; the ball comes in at the back, slides along the V-wall, cuts the beam, queues at the frame's bar. Each goal chirps with the counter's own buzzer (was a generic "bip") |
| s4 L11 | "It all lives in a 3D-printed insert." (v3 render) | "It all lives in a 3D-printed sled, in two halves. They go in where the balls come out." (exploded → in the drawer) |
| s4 L12 | "…rolls through a funnel that sends it to the sensor." | "A slanted wall sends every ball past the beam." (top view, lid off, ball + beam overlay) |
| s4 L13 (new) | — | "Every goal gets a little chirp. No chirp? Then it didn't count." On screen: "No chirp, no goal." Waves from the buzzer grille, count 0 → 1, the buzzer's goal sound |
| s4 L24 (new) | — | "Counted a hand by mistake? Hold the undo button for a second. Gone. You get ten seconds. After that, it's your phone's problem." On screen: "Hold to undo." The cap darkens, a ring fills over the 1 s hold (press tick), count 1 → 0 with the buzzer's undo sound |
| s5 icons | insert v3 render | the closed sled |
| s6 L18 | "about four months", bar to ~4 | "two to four months" (copied from §0 on purpose), bar solid to 2, light band to 4; still = L with the lid off (holder) |

Facts behind L13/L24: ux/goal-counter-phase1-2026-10-17.md B1–B3 (goal chirp on by default; hold 1 s; only this
counter's own goal within `undo_window_s`, default 10 s; later fixes on the phone). Danish: same lines, adapted
("Intet pip, intet mål." / "Hold inde for at fortryde.").

## How

- Sled stills: `video/film/tools/sled_renders.py` imports mechanical's model and renders title-free, transparent
  stills at film size into `video/film/assets/sled/`, plus `points.json` (where the beam, V-wall, channel, button
  and grille land, found by marker spheres), so overlays sit on the right pixels. Re-run it when the sled changes;
  it picked up today's finger-cup removal and the board-pin fix (B15). It writes nothing into mechanical/.
  (Slip, fixed at once: the first run created `mechanical/.venv-cad` because a relative path resolved there;
  deleted, and the env now lives in `video/film/.venv-cad`, gitignored.)
- Buzzer sounds in the film: `film/tools/sound.py` loads `video/sounds/buzzer/*.wav` (firmware player + CMT-1209
  model), kept at their relative levels.
- Re-voiced only L11, L12, L13, L18, L24 (EN Kokoro; DA Chatterbox, best of 3 + 5 seeds).

## For the user's review

- **Danish takes:** parakeet recognised L11 82 %, L13 70 %, L24 68 %, L18 69 %, L12 56 % of the words. Parakeet
  is weak on Danish, so the score is a hint only: please listen to s4 (≈ 50–73 s) and L18 (≈ 97 s) in Danish.
- **Tone check:** "After that, it's your phone's problem." is the deadpan way to say later fixes go through the
  phone's live view (phase 1 Part A). Easy to swap if it's too flip.
- **The goal-counter short teaser:** the 11 s short teaser's tunnel and beam, two balls each breaking it with the
  counter's real chirp, black, "Soon, the goals count themselves.", the crest. Rebuild: `sh tools/build.sh
  teaser-short-counter` from `video/film`.
- The front-face still shows the opening at e_L 4.75 (EST); the user's ≈ 10–15 is within the ≤ ~22 that keeps the
  button and USB-C inside, so the picture holds.

## Update 2026-10-18: the AA drawer + the OLED (lead: show the OLED, don't narrate it)

Re-rendered from mechanical's sled.py (the drawer, the dash with the button + OLED, the buzzer grille now on the
dash's top); no narration changed, so no re-voicing in either language.
- **s4 front shot:** from a little above, as through the frame, L clipped to its first 75 mm: the grille (the chirp's
  waves now rise from it), the undo button (ring + 1 → 0 as before), the OLED shown dark (it's off unless
  short-pressed, ux), the cord bay and the drawer front with its battery glyph.
- **s6 battery:** the sled with its drawer in, then pulled out through the frame (`sled.DRAWER_OUT`), while the cells
  drop in and the month bar fills. Both stills share one camera and crop so they crossfade cleanly.
- **s4 exploded / in the drawer, s5 icons:** re-rendered with the dash and drawer.
- `tools/sled_renders.py` now mirrors mechanical's part groups (ELEC / DPARTS / DRW); `points.json` has the new
  button, grille and OLED positions.

## Final render 2026-10-18 02:17 (lead GO; sled CAD final: L 54, 0.91" upright OLED, AA drawer, R's lead-loop bay)

Stills re-rendered from the final sled.py (incl. the board's 5.2 move and `pair_bay`); front overlays moved to the
new still (the OLED shown dark, not narrated; the button ring and the grille's waves unchanged in timing); the battery
drawer still shrunk so it clears the L19 caption. All four films decode cleanly, check passed:
goal-counter.mp4 / -cc 122.97 s, −14.1 LUFS (eng soft subs); goal-counter-da.mp4 / -cc 122.30 s, −14.2 LUFS (dan).
Posters regenerated. Not published. Earlier interim renders were overwritten; the pre-redo films stay as *-v3.mp4.
