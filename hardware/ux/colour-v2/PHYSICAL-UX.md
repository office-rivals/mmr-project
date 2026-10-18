# Scoreboard physical UX: numbers for mechanical and electronics

Owner: `ux`. These are targets. Mechanical and electronics turn them into parts. Screen side:
`SCOREBOARD-UI.md`.

## Keys (mechanical + electronics)

| Item | Value | Why |
|------|-------|-----|
| Count | 4 | Matches the ladder on one pin (electronics/firmware) and the UI. |
| Cap | Rectangular **12 × 10 mm**, corners r 2, flat or slightly dished top | Wider than tall like the on-screen label box, so key and label read as a pair. The 2.8" screen is only 57.6 mm wide, so this is the largest cap that keeps the gap. Below the earlier 15 mm wish: the click, the 2 mm height and the 2.55 N force make up for it. |
| Pitch | **15.24 mm** (6 perfboard holes), row centred on the active area: key centres at −22.86 / −7.62 / +7.62 / +22.86 mm from the active-area centre, ±0.5 mm. The labels are the screen's quarters (centres −21.6 / −7.2 / +7.2 / +21.6 mm), so each key is ≤ 1.3 mm off its label centre. | Each key sits under its label box. 20.32 mm would put the outer keys beyond the screen edge. |
| Gap | ≥ 3 mm between caps (15.24 − 12 = 3.2) | Fewer two-key presses by a wide finger. Firmware ignores a two-key reading anyway (SCOREBOARD-UI.md). |
| Height | 2 mm proud of the face | Findable by feel and pressable at an angle, but no edge for a sleeve or ball to catch. |
| Cap guide | Cap runs in its face opening with ~0.3 mm clearance and ≥ 3 mm of guide wall | A cap pressed at its corner must not tilt and jam. Presses will be sloppy. |
| Switch | Tactile with a **clear audible click**, actuation **1.6–2.6 N** (160–260 gf), travel ≥ 0.25 mm (≥ 0.5 mm preferred). E.g. a 12 × 12 tact switch with a cap stem (electronics picks). | The click is the instant physical feedback; the label fill follows within 50 ms. The force keeps a resting hand or a bumped table from triggering it. Avoid "silent" or soft membrane switches. |
| Same switch for all 4 | yes | One feel, one sound. |

## Label-to-key alignment (mechanical)

- **The vertical gap matters more than the horizontal one.** The key's top edge sits **≤ 8 mm**
  below the bottom edge of the display's **active area** (mechanical has 8 mm now ✓). Put the
  thick/FPC bezel at the top.
- Locate the module on its **active area**, not its outline: on many TFT modules the active area
  is off-centre. Electronics must give the active-area offset for the exact module.
- Face and keys sit on one plane, so there is no parallax at any viewing angle.
- Optional, cheap: a 0.4 mm-deep printed groove from each label zone down to its key. Add it only
  if the hallway test shows people mismatching keys.

## Viewing angle and mounting (mechanical)

- **Tilt 50° ±5° from horizontal** (mechanical: TILT_DEG 50 ✓). The eye-line: table top
  ~0.9 m, standing eyes ~1.6 m, so ~0.7 m above. Players stand along the long sides 0.3–1.2 m
  from the end, so they look down at it from 30–67°, ~45° typical. A 50° face points its normal
  at ~40° elevation. That is the middle of the range, and pressing pushes the box less than at
  60°.
- **Face along the table, toward the far end** (user). Both teams see it ~45° from the side.
  The TFT must be IPS (TN washes out at 45°). Choose a **matte / anti-glare** front if the module
  offers one, or add an anti-glare film: at a low backlight, ceiling-light reflections on glossy
  glass hide the score.
- Keep it low. The top of the box should block as little of the playfield as possible from the
  far side. Max height is pending the user's measurement. 110 mm is fine as far as UX goes.
- **Tape only** (user). A key press pushes the box back along the table: ~0.77 × the force at
  50°. People jab at 10–20 N, not 2 N. Size the tape area for **≥ 20 N of shear** without
  creeping, and keep the box's centre of mass low and back so it doesn't tip forward when a key is
  pressed.
- No glossy finish around the window. Matte PETG cuts ceiling-light glare.

## How the player knows a press registered

1. **Click** (switch, at once).
2. **The label fills** in its colour (< 50 ms) and the backlight boosts.
3. **The result screen** appears (server round trip, ~1–2 s).
4. If the server never confirms: **"✗ Not sent. Try again."** after 5 s, and the press is dropped.

No LED and no buzzer: they cost power, the click + label fill + boost cover it, and a buzzer at 10 tables
would be annoying. Add one only if the hallway test fails step 1–2.

## Battery swap (from the user's power-loss requirement)

A swap can happen mid-screen. The UI side is handled in `SCOREBOARD-UI.md` (black + connecting dots,
then the real screen, no replay). Physically, the swap must not require pressing the face
or keys (the back cover, as now). A key held down during boot must not do anything (firmware
ignores it).
