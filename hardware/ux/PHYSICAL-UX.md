# Scoreboard physical UX: numbers for mechanical and electronics

Owner: `ux`. These are targets. Mechanical and electronics turn them into parts. Screen side:
`SCOREBOARD-UI.md`.

## v5: fit the end shelf (user 2026-10-15)

The end rail's flat top is shallow and the bead counter stays in the middle (shelf depth, free
length and the v5 footprint: INTERFACES §0), so the board sits at **the right end of the rail, beside the counter** (photos: `team/drawings/drawer-photos/full/shelf-11..13.jpg`).
v4's face alone is 95 mm deep at 46°, so the reader can't stay on top. Below, **(must)** means
non-negotiable for ux; the rest are preferences.

1. **Screen and keys (must):** the screen is landscape and upright to the players. Under it are the
   LED bar and then the 4 keys in one row, as v4: 20.32 mm pitch, centred on the active area, key
   top → active area ≤ 14 mm, label → light → key in one column. The UI depends on it, and no layout
   puts keys beside the screen.
2. **Facing (must):** the face points along the table at the playfield, square to the rail (no yaw:
   it would cost ~20 mm of depth). Nothing overhangs the playfield (balls jump), and the tape
   footprint sits on the flat.
3. **Screen toward the counter, extras toward the corner (preferred):** put the screen section on
   the inner side, next to the counter, and the extra width (~50 mm) on the outer side, at the table
   corner. That moves the screen ~5 cm closer to the centreline for the far team. Viewing from the
   far long side is then ≤ ~65° off-axis at the nearest rods (30° at the far end), which is fine for
   the digits on e-paper (±80°). The names are mainly for the near team and the key presser.
4. **Badge target (must: flush, lit, ≥ 40 × 28, where the screen's arrow points):** on the **face,
   in the outer wing beside the screen** (decided: the RIGHT wing, lead), in the upper half, with the RC522 behind it parallel to the
   face. Same insert, LED5 and mark as v4. The on-screen arrow changes from ↑ to → or ← (ux
   changes the text). A top target only works if the top keeps ≥ 30 mm of flat, which the shelf depth doesn't allow.
5. **Phone NFC tag: on the inner (left) wall, upper back, above the bead counter** (lead, after the
   top collided with the DESPI adapter). It is ~90 mm from the RC522 loop (≥ 60, hard minimum 45). See NFC tap marks, below.
6. **Speaker grille:** facing the players. Best is the face, in the outer wing below the badge
   target (if the ≥ 25 mm loop keep-out fits); otherwise the outer wall. **Never** the inner wall
   (the counter blocks it), the back or the bottom.
7. **Angle (must): 42–50°. Decided (ux, 2026-10-15): 50°.** The shelf caps the depth, not the
  height, and 50° reads as well as 46° (Viewing angle table) and keeps further from lamp glare. At
  the same face length 50° is 88 mm deep instead of 95, and 105 high instead of 99 (≤ 110 ✓). Shortening the face helps more. v4 has ~39 mm
   of face below the key centre; a short vertical front wall that lifts the slanted face lets the
   keys sit lower without adding depth. The key centre stays ≥ 20 mm above the shelf (knuckle room).
   Never below 42° (lamp glare).
8. **Height:** ≤ ~110 mm (as v4).
9. **Tape and tipping:** with the shallow shelf depth, keep the centre of mass back and low and the
   tape across the full width. Key jabs (10–20 N) push it back along the table and down (50°: 0.77 /
   0.64 × the force). It must not creep or tip.

**v5 as built (mechanical, 2026-10-15) ✓**, checked against the list above (render:
`mechanical/out/scoreboard_badge.png`; footprint: INTERFACES §0):
- Face 50° on a 17 mm vertical front wall. Key centre 27.7 mm above the shelf (≥ 20 ✓); key top →
  active area 12.9 mm (≤ 14 ✓).
- Badge target in the right wing, upper half ✓. Phone tag inside the left wall, 62 mm up, glyph over
  it, nothing else on that wall ✓.
- Speaker on the outer (right) wall, back and low. The face under the badge couldn't keep the 25 mm loop
  keep-out (lead OK'd the fallback); it still faces the near team and is clear of the key hand ✓.
- Window: 3 mm satin hard-coated PC, satin side out, 0.9 mm air, masked back (below) ✓. A printed
  flush rim on 3 sides, open at the bottom over the LED bar.
- LED bar: opal **polycarbonate** (was acrylic).

## Protective window over the e-paper (user 2026-10-15)

A clear ~2 mm polycarbonate window in front of the panel, with an air gap, takes the hard shots
(the face looks at the playfield, so balls that jump the end land on it).

- **Recommendation: low-haze anti-glare PC, hard-coated, textured side OUT, smooth side in.**
  "Low haze" means satin (haze ≈ 10–20 %), not velvet or matte on both sides.
  - Why not plain glossy: each PC surface mirrors ~5 % of the light at the angles players look from
    (7 % at 50°, 10 % at 60°). E-paper has no light of its own, so a mirrored ceiling light or window
    sits right on top of the score. The office has big windows and many ceiling lights, and the board is read
    from everywhere along both sides, so somebody will always see one. Satin spreads that 5 % into a
    soft patch instead of a hot spot.
  - Why not strong matte: a matte surface over an air gap blurs the image. The blur grows with the
    distance from texture to pixels and the scatter angle. Satin at ~3° over (2 mm PC + 1 mm gap) is
    ≈ 0.12 mm, under one pixel (0.21 mm). High haze (~10°) is ≈ 0.4 mm, 2 px, so the 4 mm names go soft and white turns milky.
  - Hard coat: PC scratches easily, and hands, sleeves and balls will rub it.
  - **Glossy is the acceptable fallback** if satin hard-coated PC can't be had in small sizes.
    The over-table lamp is fine at 50°: from 65–70° up it reflects at 10–15° above horizontal, so
    it reaches eye height only 2.6–4 m out, past the far end of the table. (At 46° it was 1.6–2.3 m.)
    Windows and ceiling lights behind the players still show for some of them.
  - Either way the image is ~20 % dimmer (≈ 89 % transmission each way through 2 mm PC). Contrast is unchanged
    except where something reflects. E-paper is easily readable in office light even so.
  - **Bench check, cheap:** hold a satin and a glossy sample at 50° over the printed mockups
    (`out/04-live.png`) in the real room, from the key presser's spot and from the far side.
  - The panel's own front finish is unknown (no datasheet says). Electronics will look at a
    ceiling light in it on arrival (bench item in `electronics/README.md`). If the panel is glossy, it
    adds its own mirror under the window, which is one more reason for satin on the outside.
- **Air gap: target 0.5 mm, max 1.0 mm.** The image sits ≈ 2/1.585 + gap below the window's surface
  (PC looks shallower than it is): 1.8 mm at 0.5, 2.3 mm at 1.0. Up to ~2.5 mm reads as "under glass",
  like a phone screen protector; more reads as sunk into a box. The gap must be wide enough that a hard
  shot never pushes the PC onto the panel glass (mechanical: deflection under a shot + ≥ 0.3 mm). A
  touch would pass the shot on and leave rainbow rings (Newton rings). **If that needs more than
  1 mm, use 3 mm PC, not more air:** extra PC adds only 0.63 mm of apparent depth per mm and makes the
  window ~3.4× stiffer. Keep the gap even (a spacer frame outside the active area) and dust-sealed
  (a dust speck in the gap shows as a shadow on white).
- **Framing edge vs parallax:** whatever opaque edge frames the active area (face opening, frame, or
  a black border printed on the window's inner side) hides a strip of the image off-axis: (depth from
  that edge down to the pixels) × tan(angle). The players look from ≤ ~40° off the normal vertically
  and up to ~65° sideways (the far team at the nearest rods). With the edge at the window's outer face
  and a 1 mm gap, that's ~1.9 mm vertically and ~4.9 mm sideways. So **oversize the opening beyond the
  active area by ≥ 2 mm top and bottom and ≥ 5 mm left and right**, or put the framing edge on the
  window's inner side (a printed border, about 1 mm above the pixels) so the margins can stay small.
  An opening inside the face skin, 2.5 mm above the window, would hide ~10 mm sideways: don't.
- **As built: masked back (user feedback, mechanical).** A clear window sized to the panel glass framed
  the image unevenly: ~13 mm above (the glass's 10.3 mm FPC border) against ~4–6 mm at the sides and
  bottom. The window's back is now masked matte black in the case's colour (vinyl or paint), leaving a
  clear aperture of the **active area + 2.8 mm on every side** (90.4 × 69.2). The skin opening
  matches. The mask follows `ACTIVE_DX` / `ACTIVE_BOTTOM` if the real panel's offsets differ. Its edge
  is ~1.2 mm above the pixels, so it hides nothing at 65° sideways or 40° vertically (2.6 / 1.0 mm
  needed, 2.8 available) ✓. This is the "printed border on the window's inner side" option above.
- The window covers only the screen. The LED bar stays its own glossy opal strip, and the keys stay
  uncovered.

## Keys (mechanical + electronics)

| Item | Value | Why |
|------|-------|-----|
| Count | 4 | Matches the ladder on one pin (electronics/firmware) and the UI. |
| Cap | Rectangular **16 × 11 mm**, corners r 2, flat or slightly dished top | Wider than tall like the on-screen label box, so key and label read as a pair. ≥ 15 mm suits a thumb or knuckle (hands may be full). |
| Pitch | **20.32 mm** (8 perfboard holes, electronics), row centred on the active area: key centres at −30.48 / −10.16 / +10.16 / +30.48 mm from the active-area centre, ±0.5 mm (= label centres x 56 / 152 / 248 / 344 px) | Each key sits exactly under its label box. |
| Gap | ≥ 4 mm between caps (20.32 − 16 = 4.3) | No two keys pressed at once by a wide finger. Firmware ignores most two-key readings anyway (SCOREBOARD-UI.md). |
| Height | **3 mm proud** of the face (lead, for MX switches; was 2), top edges chamfered or rounded ≥ 0.8 (v4: 0.8 chamfer) | Findable by feel and pressable at an angle. A standard MX switch actuates at 2.0 mm, so it triggers 1 mm before the cap is flush (rule below). The rounded edge keeps a sleeve or ball from catching. |
| Switch (user, 2026-10-15) | **MX-style** keyboard switch, printed cap on the stem, ~4 mm travel. Tactile or clicky preferred (you feel the moment it counts); linear is acceptable, because the key LED now flashes white the instant a press is accepted. | MX parts are cheap, consistent and pleasant to press. |
| **Actuation point vs height** | The switch must actuate **≥ 0.5 mm before the cap top is flush with the face**. Decided: caps 3 mm proud with standard 2.0 mm actuation = 1 mm margin ✓. | A fingertip is wider than the 16 × 11 cap. At flush, the face stops the finger, so a standard switch would actuate exactly where the finger is blocked: missed presses. Past flush the cap may keep travelling; the face is the stop. |
| Force | Whatever the user's own MX switches are (user). **≥ 0.6 N preferred**, not required. **Bench check:** a hand resting on the box and knocks from play must not press a key; if they do, use heavier springs. | A knock on a 46° face rarely presses a cap, and firmware's "same window for the whole press, fire on release" handles bounce. A leaning hand is the case to check. |
| Cap fit | Cap on the stem, **≤ 0.3 mm side play** at the cap top (no rattle when the table is played on), and **≥ 0.5 mm clearance** to the face opening on every side, so it never rubs. Pressing any corner of the cap must actuate it, with no sticking. v4: opening 17 × 12 (0.5 per side) with a 0.5 × 45° flare; the cap rides on the stem alone, like a keyboard; the skirt stops on the housing just past flush ✓. Side play depends on the user's switches: bench check. | The board sits on a table that shakes with every shot; a rattling key sounds cheap. A rubbing cap sticks down and repeats a press. Presses will be sloppy and off-centre. |
| Same switch for all 4 | yes | One feel, one sound. |

## Label-to-key alignment (mechanical)

- **The vertical gap matters more than the horizontal one.** The key's top edge sits **13.0 mm**
  below the bottom edge of the display's **active area** (v4; it grew from 8 for the LED bar).
  Keep it **≤ 14 mm**. It still reads as one column because each label, LED and key share the
  same x (±0.5 mm), the labels fill their 20 mm
  column, and the caps are 4.3 mm apart: label → light → key is a chain. If the hallway test shows
  mismatches, add the 0.4 mm groove below. Put the
  thick/FPC bezel at the top.
- Locate the module on its **active area**, not its outline: on many e-paper modules the active area
  is off-centre. Electronics must give the active-area offset for the exact module.
- Face and keys sit on one plane, so there is no parallax at any viewing angle.
- Optional, cheap: a 0.4 mm-deep printed groove from each label zone down to its key. Add it only
  if the hallway test shows people mismatching keys.

## Viewing angle and mounting (mechanical)

- **v5: 50°** (the shelf caps the depth; see v5 above). The 46° history below still explains the window.
- **Tilt 46° from horizontal (v4 final: 109 wide × 148 deep × 100 high, 146 mm base).** The user wants it as
  low as possible and accepts the depth (lead), so the face came down to 46°, inside the 42–50°
  window below. Legibility sits between the 45° and 50° columns. The eye-line: table top ~0.9 m, standing eyes ~1.6 m, so ~0.7 m above. Players stand
  along the long sides 0.3–1.5 m from the end and ~0.5 m to the side. Angle between the line of
  sight and the face normal (cos = how much the screen is foreshortened):

  | Viewer (along the table, 0.5 m to the side) | 45° face | 50° face |
  |---|---|---|
  | 0.4 m (the key presser) | 34° (0.83) | 36° (0.81) |
  | 0.8 m | 25° (0.91) | 24° (0.91) |
  | 1.2 m | 24° (0.91) | 21° (0.93) |
  | 1.5 m (far end) | 25° (0.90) | 22° (0.93) |

  45° reads the same as 50° (≤ 3° apart everywhere; e-paper keeps its contrast to ±80°) and the
  box is ~6 mm lower per 100 mm of face. **Don't go below ~42°**: a lamp hanging over the table
  (~65–70° up from the board) starts to reflect into the eyes of players standing along the table
  (at 40° it reaches the mid-table players; at 45° only people ~1.6 m out, past the far end).
  (The earlier "50° if deeper than ~140 mm" fallback was dropped when the user chose height over
  depth.)
- **One board per table, at one end, facing along the table** (user). Both teams see it ~45° from
  the side. Players at the far end read it from ~1.5 m: the 30 mm digits are fine there, and the
  4 mm names are at their limit. Only the players near the board can reach the keys, which is fine
  for occasional actions.
  E-paper is readable to ±80°.
- Keep it low. The top of the box should block as little of the playfield as possible from the
  far side. Max height is pending the user's measurement. 110 mm is fine as far as UX goes.
- **Tape only** (user). A key press pushes the box back along the table: ~0.72 × the force at
  46°, and presses it down with 0.69 ×. People jab at 10–20 N, not 2 N. Size the tape area for
  **≥ 20 N of shear** without creeping, and keep the box's centre of mass low and back so it
  doesn't tip when a key is pressed. v4 final: 4 × 19 mm strips across the full 109 mm width
  (~8300 mm² on the 109 × 146 base) ✓; centre of mass ~104 mm back of 146 (71 %) and ~41 mm up of
  100, ~336 g ✓.
- No glossy finish around the window. Matte PETG cuts ceiling-light glare.

## LED bar (mechanical + electronics)

- v4 (user: it should look like an LED strip): one **glossy opal bar** (v5: polycarbonate; v4: acrylic) between the keys and
  the glass, visible slot 83 × 5.5 mm, flush. The four LEDs sit behind it, each **centred on its
  key's x (±0.5 mm)**.
- **The four segments must stay apart when lit in different colours.** The Teams and Remove who?
  screens light four player colours side by side, and each one means "this key is this player". A
  plain bar blends neighbours (red next to green turns yellow in between). v4 final has **three
  opaque baffles** on the retainer frame touching the bar's back at the key boundaries, so each key
  lights its own segment; unlit it is one glossy bar ✓. The LED sits 8 mm behind the bar, so each
  segment is brightest right over its key (~7 mm spot in a ~20 mm segment). That suits the meaning
  ("this key"). Bench check: with one LED lit, its neighbour's segment centre gets ≤ ~15 % of its
  brightness.
- No light leaking onto the e-paper or into the case.
- Behaviour and colours: `SCOREBOARD-UI.md`, Scan-in → LEDs.

## Badge scan target (mechanical)

- **v5: on the face, in the wing to the RIGHT of the screen** (lead: the board sits at the right end
  of the rail, so the wing is on the outer side; a mirrored build puts it on the left). It is in the upper half, flush in
  the face plane, and **centred over the RC522 antenna loop** (that is where the read range is; ~2–4 cm through the
  wall). Upright when read from the front, where the players stand. (v4 had it on top; the shallow
  shelf leaves no top.)
- **Mark** (unchanged, just moved): an ID-badge outline, ~28 × 18 mm (a rounded card with a lanyard slot near the top edge
  and a simple head-and-shoulders figure on its left half), with the word **"badge"** under it in
  ~5 mm lower-case letters. **Engraved 0.4 mm** (nothing stands proud where the shell meets the
  print bed; mechanical/lead). Raised is fine instead if the top prints facing up. Strokes ≥ 0.8 mm wide so the groove shows as a shadow line on
  black PETG and can be felt.
- **Lit from below** (one RGB LED, user 2026-10-15): the mark must let light through. v4: a
  **translucent natural-PETG insert, 40 × 28 mm**, flush, mark engraved 0.4, with the word "badge"
  on the insert so it glows too. LED5 feeds it through a hidden tongue under a 1 mm black skin (v4: from
  the right end; **v5: from below**, the LED under the RC522's header end, 23.9 mm from the loop). The
  feedback is the glowing mark, not the LED. So: no hot spot in view outside the mark, and the brightest part is
  inside the mark (people put the badge where the light is). The mark's far end must still be clearly lit in
  all six colours (bench print: far end ≥ ~30 % of the near end, seen from the key presser's spot and from 1 m to the side; ASSEMBLY S6). If it fails, LED5 moves up
  beside the loop (≥ 10 mm from the copper, wires leading away): green and blue have no current headroom
  (~2 mA max) to brighten a dim far end (electronics). Electronics: place the LED so it doesn't detune the antenna loop (e.g. at
  the loop's centre, leads away from the trace). Behaviour: `SCOREBOARD-UI.md`, LEDs.
- Deliberately **not** the contactless waves: those mean "phone", on the left wall. **Badge on the
  right, phone on the left.**
- The screen points at it: "Tap your badge →" in the Lobby and "Press a key, then tap your badge →"
  on Idle (`BADGE_ARROW` in `mockups.py`: ← on the mirrored build). The arrow only works if the
  target sits right beside the screen, level with its upper half.

## NFC tap marks (mechanical)

- **v5 (lead, 2026-10-15): one sticker in the INNER (left) side wall, upper back, above the bead
  counter.** The top was the first pick, but it collides with the DESPI adapter. The outer wall
  has no room for a phone beside the rail's side panel. The wall is 16 mm from the 25 mm-tall beads:
  **tag centre ≥ ~60 mm above the shelf**, so a phone held flat (landscape) against the wall clears
  the beads. It is ~90 mm from the RC522 loop (≥ 60 from the loop copper edge to edge, hard minimum
  45, out of the loop's axis; electronics). Bench: ASSEMBLY S6 step 4 (empty Lobby, 10 s, no flash or
  blip). Glyph on that wall, centred over the sticker, and nothing else on that wall. The mirrored
  build mirrors it with the case (`PHONE_SIDE` in `mockups.py` follows `BADGE_SIDE`).
- **Glyph:** generic contactless waves, a dot plus 3 concentric arcs opening away from the face.
  Not the NFC Forum N-Mark or the EMV contactless logo (both trademarked). ~18 mm wide, 0.6 mm
  proud (its shadow shows on black PETG, and it can be found by touch), centred exactly over the
  sticker centre. No glyph on the side walls (nothing to tap there).
- **Sticker centre ≥ 15 mm from the cells, display and perfboard** (metal detunes NFC). Electronics
  confirms the tag type and read range through the wall.
- The screen's after-game hint says "scan, or tap the left side" and the phone toast "Phone? Tap the
  left side." (`HINT_TEXT`, `PHONE_TOAST`), so screen and wall point at each other.

## How the player knows a press registered

1. **Feel** (the tactile bump or click, at once) and the **key LED flashes white** (0.2 s) when
   the board accepts the press.
2. **The label inverts** to white on black (partial refresh, ~0.3 s).
3. **The result screen** appears (server round trip, ~1–2 s).
4. If the server never confirms: **"✗ Not sent. Try again."** after 5 s, and the press is dropped.

The board stays silent on key presses: the feel, the LED flash and the inversion cover them. Sound
is only for goals, undo, the win, badges and Saved (`SCOREBOARD-UI.md`, Sound; `SOUNDS-V2.md`).

## Speaker opening (the default build, user 2026-10-15: `SOUNDS-V2.md`, `electronics/premium-sound.md`)

- A mini speaker behind a grille over its cone, sealed to the wall with a foam ring. Electronics'
  part today: 40 mm (40 × 28.3 × ≤ 15 mm, Ø ≈ 30 mm cone, grille ~30–40 % open). Electronics gives the keep-outs: ≥ 25 mm from the RC522 loop, ≥ 20 mm from the NTAG.
- **Where (ux):** the grille faces where the players stand: never the back
  or the bottom. The face is full (screen, LED bar, keys), the top holds the badge target, and the
  left wall holds the NFC tag. So the **right side wall** is the natural place: it faces the players
  on that long side. At 0.6–2.4 kHz a box this small sends sound round to the other side too, so both
  teams hear it. Keep it clear of the tape area and of where a hand rests to press a key, and put
  nothing on that wall that someone would want to tap or touch.
- **Mechanical v5 ✓:** outer (right) wall, back and low (v4 had it mid-height on the same wall), clear
  of the key hand. A sealed printed back cup, stuck to the wall with a foam ring.
- Rattle check on the bench: Won at High must not buzz the case, the key caps or the badge insert
  (in mechanical's print-and-install fit step).

## Buzzer opening (fallback build only)

- **The sound opening faces the players**: on the face (beside or below the keys) or the top
  edge, never the back or the bottom. The back faces away along the table, and the bottom sits on
  tape.
- Keep it clear of the tape area and of where a hand rests to press a key, so a palm doesn't muffle
  it.
- Volume: the level (Off/Low/Medium/High) is set per table from the admin UI; firmware maps it to
  PWM duty. Socket the series resistor so the maximum (High) can be tuned once on a real table:
  clearly audible at ~1.5 m over play, not across the office.

## Battery swap (from the user's power-loss requirement)

A swap can happen mid-screen. The UI side is handled in `SCOREBOARD-UI.md` (one full refresh
straight to the real screen, no replay). Physically, the swap must not require pressing the face
or keys (the back cover, as now). A key held down during boot must not do anything (firmware
ignores it).
