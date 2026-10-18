# Drawer + OLED review 1: mechanical's proposal (2026-10-17)

This reviews `mechanical/reports/2026-10-17-drawer-oled-proposal.md` (a flat top at 52; the drawer in the bottom
row; a dash with the OLED, the button and the bay; the board behind the lane). I checked it against my criteria
(`2026-10-17-drawer-criteria.md` §2) and sled.py's numbers.

It's a paper check: there's no CAD yet. Every value is EST. The coordinates are r (from L's left face), z (from the
floor) and s (inward).

**Before the build: the user's choice decides this.** Electronics recommends **Li-ion charged in place**
(`electronics/battery-drawer-electrical-2026-10-17.md`). That needs no drawer, keeps USB-C on the face, and still
fits the OLED. Everything below applies only if the user keeps AA cells in a drawer. Lead is asking the user.

## Checked and fine

- **The flat top at 52** keeps L inside the opening when it's lifted over the bar (52 + 10 = 62 < 65). L's top over
  the box can't take balls: they stay in the channel. The rail and R's bridges (z 40–43, r 71.4+) are unchanged.
- **The drawer lane** (r 21–71.4) stays out of the channel (r ≥ 81.4) and away from the queue's corner. A ball on
  the tunnel floor can't climb into the empty lane: its floor is at z 12.
- **The latch:** a detent flexing in the layer plane, lead-ins, a key rib, a hard stop and a flush plate cover §2.
- **The antenna** is ≥ 20 from the cells, and the sockets get a lid hole.
- **The swap** is three steps with the sled in place.

## Should-fix (AA drawer)

**S28. The drawer's bottom-left corner skims the opening's R10 corner.** → mechanical.
- At e_L 15 and the bar at 10 (both EST), the corner's centre is at (r 25, z 20). The drawer's corner at (21, 12) is
  **8.9** from it, leaving **1.1** of margin, not 3.
- With the bar at 11 the margin is 0.15.
- **Fix:** chamfer the drawer's bottom-left corner (≥ 5 × 5 at 45°, or R ≥ 6), with the lane mouth to match, so it
  keeps ≥ 3 inside.

**S29. The grip notch is under the dash.** → mechanical.
- The notch is in the front plate's top edge (z 32), and the dash starts right above it (z 32.5).
- A finger working ~36 deep through the tube can't come down onto that edge. It can only push in horizontally, and
  then it needs a real pocket to hook and pull ~10 N.
- **Fix:** a finger pocket in the plate, ≥ 18 wide × 10 high × 8 deep, behind the plate face and not covered by
  the dash. Or a ribbon or cord loop on the plate, like the mouth plug's tab. It costs nothing and works by feel.

**S30. USB-C is blind, 120 deep.** → mechanical.
- The port is at the lane's back wall (s 120), reached through an empty lane 50 × 20 in cross-section. A 13 × 8
  overmould can wander ±18 / ±6 in there, so finding the receptacle by feel at that depth is hard.
- **Fix:**
  - Centre the port at the height of a plug lying on the lane floor (≈ z 12 + 4).
  - Add a tapered guide at the back wall, ~25 × 14 narrowing to the 14 × 8.5 cut, so the plug slides along the floor
    into the port.
  - Keep the 3.4 face recess, which a ≤ 13 × 8 overmould reaches.

**S31. The dash's leads would cross the open lane.** → mechanical, electronics.
- The OLED (4 wires), button (2), buzzer (2) and J_PT extension (2) run from the dash at s 36–55 to the board at
  s 122+. The lane has **no ceiling**, so any wire that sags lies in the drawer's path.
- **Fix:** a closed duct from the dash to the board in the free strip **r 1.2–19**: behind the frame, left of the
  lane, with ~40 of height. It must stay clear of the latch's notch in the lane's left wall.
- Electronics gives the lead lengths with that route.

**S32. The tilted OLED may be partly hidden from a viewer looking in from above.** → mechanical, ux.
- Seen from outside, the highest sightline is ~31° (to the opening's top outer edge, s 0, z 65).
- The panel leans back, so its top edge sits deeper (s up to ~55) and higher (z ~48) than the window. A sightline
  at 20° to a point at (s 55, z 48) is at z ≈ 55 when it reaches the dash front (s 36), above a window that ends at
  z ≤ 50.
- So the panel's rear part is hidden for any elevation above a few degrees, unless the window's top edge is opened
  back.
- **Fix:** chamfer the window's top edge back to the panel's top edge, along the 31° sightline, or let the panel look
  up through a window in the dash's top front.
- I'll check it with sightlines at 0–30° through the frame at e_L 10 and 15 once it's CAD.

**S33. (Slack-loop option) The shelf's cross ribs chop the loop's chamber.** → mechanical, electronics.
- The lane shelf sits on "ribs every ≤ 16 along s", so the ribs are walls across r, under the shelf, in the
  z 0.4–10.8 chamber where the ≥ 120–160 loop has to travel along s.
- **Fix:** run the ribs **along s**: 3–4 ribs ≤ 16 apart across r. The shelf still bridges ≤ 16, and one cell is
  free for the loop. The gate will sweep the loop as a tube at full and short travel.
- Also, the holder has to stay in the tray while the drawer moves (a clip or strap), and lift out on purpose for the
  cover slide.

## Nice

**N21. A funnel at the lane mouth.**
- The drawer is pushed in by hand through the 35-deep tube, so give the lane's mouth on L's face a ≥ 3 chamfer all
  round. The drawer's rear edges then find it blind.

**N22. The "tunnel roof ~46 EST" note is stale.**
- Counter 2 (the 2026-10-17 layout) used the concept's pre-correction figure: 60 − 10 − 4. With the floor 10 below
  the bar, the interior is ~55 + 10 − (3–5) ≈ 60. So the 52 flat top fits.
- A ruler reading in the real tunnel would close it. It doesn't block anything.

**N23. (Contacts option) The cover slide.**
- With contacts the holder's leads end at plates on the tray, so either:
  - the holder can't lift out of the tray, so the tray needs an open end for the 68-long cover slide; or
  - the leads need a plug.
- Electronics prefers the loop: contact bounce > 1 ms in a Wi-Fi burst resets the board. That's their call.

## Next

- Once the user has chosen (via lead) and the CAD exists, I'll add the chosen variant to `check.py sled`:
  - **AA drawer:** the drawer path and the latch's click, the loop (as a tube) or the contacts, the USB plug through
    the lane, the dash and lid order, and the OLED sightlines at e_L 10 and 15.
  - **Li-ion:** the pack's pocket, and nothing pressing on the pouch.

## Re-check log

- **2026-10-17 23:55, paper:**
  - Mechanical accepted S28, S29, S30, S31, S32 and N21 into the proposal.
  - S33 is moot, because the drawer uses contacts.
  - Electronics (study §4b):
    - S31 lead lengths via the r 1.2–19 duct: OLED ≈ 160, button ≈ 220, buzzer ≈ 200, J_PT extension ≈ 210, all
      within 30 cm jumpers.
    - N23: the tray end is open on the cover's slide side, or a Keystone 2487 snap cover is used.
  - **Still to verify in CAD**, once lead picks drawer or Li-ion:
    - the drawer path and the latch's click;
    - the contacts' preload under the latch (≥ 1–2 N each, electronics' bounce limit);
    - the USB guide;
    - the duct;
    - the OLED sightlines at e_L 10 and 15.

## CAD review (2026-10-18): the gate on the drawer build

`check.py sled` was rewritten for the drawer and dash build (SLED-ASSEMBLY §4–§7) and runs **49 steps: 48 pass,
1 fail. The full gate is 107 pass, 1 fail.**

It sweeps these:
- the emitter, the pogo pins, the board (the one pin and the tilt-in path) and its 6 plugs;
- the OLED, button, buzzer and header into the dash;
- the dash onto L (snaps);
- the lid at 2°;
- the drawer in from its pulled-out pose (s −125), through the frame at e_L 10 and 15, past a ball waiting at the
  mouth;
- the swap (the holder out on its ~30 lead, the cover off);
- the reflash plug through the empty lane;
- the mouth plug out through the frame;
- OLED sightlines at 0–30°.

**Verified ✅**
- **S28:** the drawer's keyed corner passes the R10 corner at e_L 10 and 15.
- **S29:** the finger pocket is 18 × 10 × 8, with a lip to hook behind.
- **S31:** the duct is free, and no lead crosses the lane.
- **S32:** no sled part hides the OLED at any elevation. The whole active area is seen up to 20°; above that, the
  frame's own top edge hides its top rows, which no layout can change.
- **N21:** the lane-mouth lead-ins.
- **N23:** the holder lifts out on ~27 of lead (the guide gives ~30), and the cover slides off forward.

**Also passing:**
- the latch: no bump in the wall at home, and a pull of 1 mm meets the notch;
- the pogo pins on their targets, compressed 0.75 of their 1.5 stroke;
- the hard stop on the stand-offs;
- the dash snaps and the lid held (lifted 1 mm, both hit).

**S34 (S30 is only half fixed). By feel, the reflash plug misses the port.** → mechanical.
- The plug now lies on the lane floor at the port's height, and the funnel is 16 × 10, catching ±1.5 (its ceiling
  bridges 16).
- Laterally, though, the only thing the user can feel is the lane's wall. A plug run along the left wall (the latch
  side) lands **6.4** off the port (y −27.5 against the port at −33.9). Anywhere else in the 51-wide lane, it's
  guesswork 120 deep.
- **Fix:** move the board 6.4 toward the left wall (B0 y −43.6). The port then sits on the plug's left-wall line, and
  the funnel's ±1.5 covers overmoulds 11–13 wide.
  - That fits: the board's new span y −43.6 to −13.6 at s 122–192 is behind the duct (which ends at s 121.7), and clear
    of the emitter block (y ≤ −58.5).
  - The lid's socket hole moves with it.
- The guide (§7 reflash) then says: "run the plug along the lane's left wall".

## Re-check log (CAD)

- **2026-10-18 01:15:**
  - **S34** ✅: the board is at B0 y −44.8 and the port at y −28.7. A plug riding the lane's left wall over the
    keyed corner's 1.2 ridge lands **0.0** off it, and the funnel is flush with the wall on the left.
  - SLED-ASSEMBLY §1 and §7 say "run the plug along the lane's left wall".
  - The gate's check now includes the ridge.
  - **Full gate 108 pass, 0 fail.** §0 "assembly gate" 97 → 108.

## Slim display, L 54 (2026-10-18): the gate on mechanical's build

The gate was updated for the 0.91" upright build:
- the module goes into its pocket from behind;
- sightlines over `active` at 0–30° up and ±20° sideways;
- R's pair (`pair_bay`) checked as clear and above the drawer;
- the plug's fingertip check is kept.

**112 pass, 2 fail.**

**Passing:**
- **OLED:** no sled part hides any point of the active area. The whole area is seen up to 25° up, at yaw −20/0/+20
  and e_L 10/15. The 57 opening lifts the frame's limit from 20° to 25°.
- **R's pair:** its route is clear of L, the dash, the OLED and the drawer. Its lowest point is z 32.9, above the
  drawer's 30.9.
- **The mouth plug** comes out through the frame at e_L 10 and 15.
- Every earlier sled step still passes at L 54.

**S35. The OLED module can't get past its lips.** → mechanical.
- Both long edges have **0.8 lips running the full 38**, which is **1.6 of interference** on a rigid PCB.
- **The top lip** hangs from the 1.3 skin over the pocket, only 4–6 behind the window frame. **The bottom lip** sits
  on ~9 of solid dash. Neither can flex 0.8.
- **Gate:** `OLED into its pocket from behind` fails 1–4 short of home, with 18–42 mm³ in the dash.
- sled.py's assert only checks that the module is held once it's home (pushed back 0.6, it meets the lips), not that
  it can get in.
- **Fix:** a fixed ledge on one edge, plus **one short snap** on the other: a lip ~6–8 long on an arm cut free by two
  slots. The dash prints face-down, so an arm flexing in z bends in the layer plane.
- Other options: a printed wedge pushed in behind the module (tool-free, removable), or the earlier glue dots.

**S36. The mouth plug is 6 behind the face, so a fingertip can't push it home** (mechanical asked for my call: it fails). → mechanical.
- The bay's front opening under the OLED is 9.6 × 6.9, and the housing's front end is at s 42, **6** behind the
  dash face. A fingertip reaches ≤ ~1 into an opening that size. The plug is only for service (R in or out), but it
  still has to go on by hand.
- **Fix:** move the header forward so the housing's front end is ≤ 1 behind the face, as mechanical offered. The
  pair's U-turn then sits ~3 proud of the face, inside the frame tube.
- That works if the turn stays **above the drawer (z > 31)** and **right of the active area (r ≥ 58)**. The gate
  already checks `pair_bay` for both and will sweep the new route.

### Re-check (2026-10-18)

- **S35** ✅: the OLED drops into a slot from the dash's top. It's held along s by the window and by 0.8 rails
  behind its ends (moved 0.5 it meets 135.7 / 5.9 mm³). Nothing flexes.
- **S36** ✅: the bay's back wall is at s 51, so the plug's front end is 1.0 behind the face. R's pair U-turns 3 proud
  (s 33), with its lowest point at z 32.9, above the drawer's 30.9, and clear of L, the dash, the OLED and the drawer.
- **Full gate 115 pass, 0 fail.** §0 "assembly gate" 108 → 115.
- **N24 (nice). Nothing holds the OLED down in its slot.** Lifted 1, 2, 4, 8 or 15 mm, it meets nothing in the dash,
  the lid or L. There's 1.5 of open slot above it (module top z 52.5, top 54).
  - In use it sits there under gravity, plus a little from its lead.
  - On the bench (L out and turned over for service) it falls out and hangs on its lead.
  - **Fix:** a dot of hot glue at each top end, or a 1.5 printed strip pressed into the slot above it.
- **N24** ✅ (2026-10-18): SLED-ASSEMBLY step 4 now says to put a dot of hot glue on each top corner of the OLED (it
  peels off for service). No CAD change, so the gate stays 115/0.

## Status LEDs + plain undo cap (2026-10-18)

The gate gets 8 new steps for the two 3 mm status LEDs (green on the left, red on the right, under the OLED window):
- each drops into its open channel behind the OLED and slides forward;
- each sits on its step (pushed 0.3 further, it meets 0.84 mm³);
- each face is seen through its Ø3.1 hole at yaw −20/0/+20 and 0–15° up, at e_L 10 and 15.

J_STAT's plug passes. The plain cap (no ↶) changes nothing else.

**Full gate 125 pass, 0 fail.** §0 "assembly gate" 115 → 125.

## Service grip (pull cord removed, 2026-10-18)

- **What it is:** `PULL` is a 15 × 14 window (s 40–55, z 14–28) through the lane's right wall at y −72, into the empty
  space under the rail.
- **The gate:** a finger is modelled with the drawer out: a Ø14 shaft through the frame and the empty lane, and a
  Ø12 tip curled 5 into the window.
  - It's clear of L, the dash, the lid, R and the frame at e_L 10 and 15.
  - With the window's slack taken up, the pull (2.5 back) bears on L's lane wall (5.4 mm³) and the lift (2.0 up) on
    the window's top edge (5.9 mm³). It never bears on the dash.
- **Full gate 128 pass, 0 fail.**
- §0 is held at 125 until the MX undo switch lands, so the count changes once (lead told).

## MX undo key + moved buzzer (2026-10-18)

**Gate:** the key steps were replaced. They are: the switch into its plate from the front; plate + switch up into
the slot; the keycap onto the stem; the cap locking the plate (moved 1 down it meets 9.6 mm³); the key's 4 of travel
(clear); and the buzzer down into its new sleeve. **All pass.**

A new check presses the key with a **Ø16 rigid fingertip pad**, straight in through the frame. The MX Blue clicks at
**2.2** of pre-travel (EST), measured from the cap face. **Full gate 129 pass, 4 fail.** §0 stays at 125 until green.

**S37. A fingertip can't click the key.** → mechanical.
- The cap face is **1 behind** the dash face, inside an **11 tunnel**. Where the pad gets to:
  - **e_L 10:** a centred pad gets only **1.5** past the cap face.
  - **e_L 15:** the key is at r 22, only 7 inside the opening, so a centred pad hits the frame's left edge. Shifted
    1 right it gets 0.9; 2 right, 0.2.
- Neither reaches the 2.2 click. A soft fingertip does somewhat better than the rigid pad, but not 0.7–1.3 better
  for certain.
- **Fix (both):**
  - Bring the cap face **flush** with the dash face, or ~0.5 proud: the frame tube ends at s ~35 (EST), L's face
    is at 36.
  - Move the key **≥ 1.5 right** (r ≥ 23.5), so a centred pad clears the frame at e_L 15.
  - That gives ~2.5 against the 2.2 click. A 1 × 45° chamfer on the tunnel's mouth adds margin.

**S38. The status LEDs no longer drop into their channels.** → mechanical.
- The buzzer's new sleeve starts at s 49.85, so the LED channels now end at **s 49**: 7.2 behind the flange step
  (s 41.8), against an LED body plus flange of 6.3.
- To drop in and slide forward, an LED has to start with its tip behind the bore (≥ 6.0 back). By then its legs
  have to turn up within **~0.9** of the flange. The dummy's legs run to s 48, so slid back they reach ~54.
- Datasheets want ≥ ~1.6–2 before a 3 mm LED's legs bend.
- **Gate:** green and red `LED into its channel` fail at the slid-back pose, even with that least slide.
- **Fix:** lengthen both channels to **≥ s 51.5**: the body, plus 2 straight leg, plus the leg's bend. Do that by
  moving the buzzer ≥ 2.5 back (s ≥ 58.5) or ~4 in y away from the red LED (y −44.6, sleeve at −45).

### Re-check (2026-10-18)

- **S37** ✅: the key is at r 23.5, the cap flush with the face, and the tunnel mouth has a 1 × 45° chamfer. A Ø16
  rigid pad gets **3.3** past the cap face at e_L 10 and 15, against the 2.2 click.
- **S38** ✅: the LED channels run to s 51.5, and the buzzer moved to s 58.5. The gate now sweeps a datasheet-correct
  LED, with **2 of straight leg** before the bend up rather than mechanical's 0–1 mm dummy, and both pass.
- **Full gate 133 pass, 0 fail.** §0 "assembly gate" 125 → 133.
