# Review: L's front, take 2 (battery drawer + OLED), findability and labels, 2026-10-17

Owner: `ux`. Reviewing `mechanical/reports/2026-10-17-drawer-oled-proposal.md` (lead's ask). The verdict
is **OK with one change and two small additions.** Decider for the geometry: mechanical.

**Update 2026-10-18 (user via lead): no undo label.** The ↶ on the cap is dropped, and no replacement
label is added: the button may get another job when the scoreboard returns. Findability = the
contrasting cap only. The ↶ mentions below are history.

**Status (mechanical, 2026-10-17): accepted.**
- Button cap r 18–28 (centre ~23).
- OLED active area r ~34–55.5.
- Bay r 59.5–70.4.
- ▭+ glyph beside the grip notch.
- The eye-camera renders come with the CAD.
- The build waits for lead's call on the drawer vs Li-ion.
- **2026-10-18: the display is now the 0.91" upright** (`goal-counter-phase1-2026-10-17.md` B5a). Its active
  area is r ~35–57, mid-opening, with 7 to spare from 20° left. The eye renders get re-checked when they
  come.

## 1. Change: put the OLED in the middle of the opening, not at its left edge

The proposal puts the active area at r 18–40, so its left edge is 3 behind the frame's left edge
(e_L 15). The face sits ~35 behind the frame's front, at the end of the tube. Someone who looks in
from the left at an angle θ loses everything left of r ≈ e_L + 35·tan θ. (The first version said
"from the right"; the renders show it's the left. The fix is the same.)

| Viewing angle from the left | Hidden up to r (e_L 15) | Of the active area r 18–40 |
|---|---|---|
| 10° | 21 | the first ~3 mm (1–2 characters) |
| 20° | 28 | almost half |
| 30° | 35 | ~¾ |

The display's lines are left-aligned, with their labels first ("WiFi", "Batt", "Beam", "End", B5).
So the part that gets hidden first is the one that says what each number is. From the right or
straight on it's fine, but nobody should have to find the one right spot.

**Ask:** swap the OLED and the button in the dash.
- **Button:** at the left, r ≈ 18–32. The cap centre at r ≈ 25 is ~10 clear of the frame edge at
  e_L 15. A finger reaches past the edge easily; it's the eye that can't.
- **OLED:** to its right, module r ≈ 31–58, active area ≈ r 34–56, centred in the visible face.
  At 20° from the left, 1 mm is lost at most.
- If the cartridge won't fit at the left: move the OLED as far right as the bay allows, and tell me
  what's left. Firmware could then right-align the values, but I'd rather not.

The 60° tilt is good: it faces someone looking down through the tube, ~30° off the screen's normal,
and the text is only ~13 % shorter.

## 2. Accepted

- **The ↶ on the cap**, as there's no room beside it. Make it ≥ 6 mm and only ~0.4 raised, so the
  cap still presses comfortably. The contrasting cap plus the arrow is enough on its own.
- **The grip notch** in the drawer's front plate, at its top edge. One finger, a pull, a click home:
  good. The click is the "it's in" cue.
- **The hidden buzzer** with its grille through the dash's top: no findability issue (electronics
  judges the sound).
- **USB-C reached through the empty lane** with the drawer out: fine for a rare service job.
- A short press of the button with the drawer out is harmless: it only shows the screen.

## 3. Additions

1. **A battery mark on the drawer's front plate** (mechanical): a battery glyph ▭+ (~8 mm, 0.6
   raised) beside the grip notch. The face then reads **screen · ↶ button · battery drawer**, and
   nobody has to guess which plate pulls out. No text: it would be too small to read, and the glyph
   works in any language.
2. **The screen comes on after a battery swap** (firmware, B5): a power-on boot, i.e. cells just
   pushed in, turns the screen on until 10 s after Wi-Fi settles (as a wake from deep sleep does).
   The person who swapped then sees `Batt 4.1V` and `WiFi -61 srv ok` without pressing anything, so
   they know it worked. No sound (SOUNDS-V2 rule 1: never at boot).

## 4. What I'll check on the renders

- A camera at a standing player's eye, looking through the opening from straight on and from ~20°
  either side: all 4 lines fully visible, and the ↶ readable.
- The drawer out: the empty lane and the USB-C are visible, and the notch is obvious.
- In the hallway test (when printed), someone told only "the batteries are in a drawer in the goal"
  finds it, swaps the cells, and sees the screen confirm, on the first try.

## 5. Renders checked (2026-10-18): OK

`mechanical/out/sled_eye_0.png`, `sled_eye_left20.png`, `sled_eye_right20.png`, at e_L 15 (the worst case).
As built: OLED active area r 32.9–54.6, tilted 55°; button cap centre r 22 with a raised ↶;
finger pocket 18 × 10 and a ▭+ on the drawer.

| View | OLED | ↶ button | Drawer + pocket + ▭+ |
|---|---|---|---|
| Straight on | fully visible | visible | visible |
| 20° right | fully visible | visible | visible |
| 20° left | fully visible (~5 mm to spare: hidden up to r ≈ 27.7) | **hidden behind the frame edge** | visible |

- The screen now reads from every angle, which was the point of the swap.
- The button is out of sight only from the far left. A finger still reaches it, and it shows from
  straight on, so this is fine. The hallway test checks it on the print.
- The renders are small: the opening fills ~⅕ of the frame. The ↶ and ▭+ are legible on screen,
  but **check their size on the print**.

## 6. Renders re-checked with the 0.91" upright (2026-10-18): OK

The same three views, now with the active area at r 34.3–56.7, z 43.7–49.3.

| View | OLED | Button | Drawer, pocket, ▭+ |
|---|---|---|---|
| Straight on | fully visible | visible | visible |
| 20° right | fully visible | visible | visible |
| 20° left | fully visible | hidden behind the frame edge | visible |

The result is the same as §5. The flat strip reads well in all three, so it's done on paper. Glyph
sizes and the hallway test wait for the print.
