# L's front, take 2: battery drawer + 0.96" OLED (mechanical proposal, 2026-10-17)

Status: **PROPOSAL**, to agree with electronics and assembly-review (ux checks findability). The requirements are in
DECISIONS 2026-10-17:
- swap the 3×AA without taking L or R out, using a drawer through the opening, latched against play;
- a white 0.96" OLED (27.3 × 27.8 module, 21.7 × 10.9 active) visible through the opening.

The frame is sled.py's (s inward, r = −y from L's left face, z up from the floor). Checks run at e_L 10 and 15 with 3
margin, so the face is usable from r ≥ 18 and z ≥ 13 (the bar is at 10, EST). Every value is EST until printed.

## 1. The squeeze, and the way out

assembly-review's budget (`assembly-review/2026-10-17-drawer-criteria.md` §1) is right for today's L:
- under the sloped roof, the face is only 24–34 tall;
- a flat FIT0610 drawer (~50 × 20) and an OLED module don't fit side by side or stacked;
- USB-C, the grille and the bay already sit in the drawer's band.

Three moves free the face:

1. **A flat top over L's box.** It is 52 from the front wall to the V-wall (s 36–194), as L's left side already is.
   The sloped roof stays only behind the V-wall, where balls can land. Balls never reach the box top, the opening
   limit (52 + 3) is unchanged, and R's bridges stay 1 clear of the box's right wall (r 70.4). The face is then **r
   18–71 × z 13–50**, about 37 tall all across. The lid becomes a flat plate.
2. **The board moves behind the drawer**, to s 122–192 (where the holder was). USB-C then faces the drawer lane's back
   wall and is **reached through the empty lane with the drawer out**. Flashing is rare, and USB powers the XIAO while
   the drawer is out. There's no extension and no USB-C on the face.
3. **Swaps no longer take L or R out.** The receiver bay and the pull cord are now only for service. They stay, but
   the bay narrows to ~12.

## 2. The front face at e_L 15 (r 18–71 visible)

```
 z 52 ┌──────────── flat top / lid ─────────────────────────┐
      │ hidden │ OLED window (active r 18–40)  │ BTN  │ BAY │   top row: the DASH (a separate print, z 32–52)
      │ buzzer │ module tilted 60° back        │ ↶cap │cord │   module r 15–42.5 | button r 43–57 | bay r 58–70
 z 32 ├────────┼─────────────────────────────────────────────┤
      │ latch  │  BATTERY DRAWER  (r 21–71.4, z 12–32)        │   bottom row: front plate flush, grip notch at its top
 z 12 ├────────┴─────────────────────────────────────────────┤
      │        lane shelf on ribs; slack-loop chamber or contacts below / behind   │
 z  0 └ r 0 (behind the frame to r ~15) ──────────────── r 71 ┘ rail / channel →
```

| Part | Where | Why / how |
|---|---|---|
| **Drawer** | Lane r 21–71.4, z 12–32, from the front wall to s ~120. A printed tray (FIT0610 flat, cover up) with a front plate flush with L's face and a grip notch in the plate's top edge | The whole cross-section is inside the opening: r 21 ≥ e_L 15 + 6. Its floor sits at z 12, 2 above the bar (EST), so it slides straight out. It stays out of the channel (r ≤ 72) and clear of the queue |
| Drawer latch | A detent arm in the tray's left wall. It flexes across r, in the print's layer plane, and clicks into a notch in the lane wall when home | Holds against play. One finger in the grip notch releases it by pulling (~10 N), and it clicks home by feel. Lead-ins on the rails, a key rib (one way in only), and a hard stop with the plate flush |
| Lane | A shelf at z 10.8–12 on ribs every ≤ 16 (along s), side walls, no ceiling. The dash bridges over it | A ceiling bridging 50 can't print supports-off on L. The dash prints face-down, so its underside isn't a bridge |
| **OLED** | In the dash, active area r 18–40 (inside at e_L 15 with 3; module r 15.2–42.5, partly behind the frame). The module is tilted ~60° back (face up toward the viewer), z 32.5–50 | An upright module (27.8) doesn't fit the 20-tall row. Tilted, it is 17.4 tall. People look in from above through the 35-deep tube (≤ ~30° elevation to the active area), and a face tilted up suits that. An OLED is readable to ~80° off-axis |
| **Undo button** | In the dash, r 43–57, centre z ~41. The same front-loaded 12 × 12 cartridge, cap Ø10, recessed 1. **The ↶ is embossed on the cap** (the contrasting part) | No room for the arrow beside it. ux to confirm |
| **Receiver bay + pull cord** | In the dash at its right end, r 58–70.4, open on top. The floor is at z ~34, and the header slot is in its back wall (keyed 3-pin, pin row at z ~35). The cord loop goes through the bay's left wall | R's lead still comes over R's front bridge (z 41–43) and drops into the bay over a notch in the dash's right wall. The bay is only for service now (R or L out) |
| **Buzzer** | In the dash's left end (r 3–14, behind the frame), with a grille through the **dash's top** at the front | No room on the visible face. The open space over L's front top (z 52–65, inside the frame tube) carries the sound out through the opening. electronics to accept |
| **Board** | Behind the lane: s 122–192, r 21–51, flat, USB end forward. The USB-C plug enters through a 14 × 8.5 cut in the lane's back wall (s 120) | Same supports as now (one pin, lips, clips, back stop). The antenna is ≥ 20 from the cells (the drawer ends at s ~118). The sockets get a lid hole over their new place |
| **Battery connection** | **electronics decides.** (a) Spring contacts on the lane's back wall that mate with plates on the drawer's rear: the drawer comes fully out, so USB access is clean and nothing folds. (b) The FIT0610 lead as a slack loop (≥ 120 for ~110 of travel) in its own chamber under the lane shelf (z 0.4–10.8) | I recommend (a): nothing to fold when pushing back in by feel, and the drawer lifts out for the cover slide. With (b), the tray's rear stays open so the cover can slide off, or the holder lifts out of the tray outside the frame |
| **Lid** | Flat. Rear lips into the s 194 windows as now; its front edge goes under a lip on the dash's rear edge. **The lid goes on first, then the dash**, which holds the lid. There is no spring tab | Both are opened only for service now |
| **Dash** | A separate print (face-down) sitting on L's front wall and lane walls, held by 2 snap arms (flexing in the layer plane) into L's side walls | Off for service only |

## 3. Swap (sled in place)

1. Hook a finger in the drawer's grip notch and pull it out through the frame, past the latch.
2. Lift the holder out. Its cover slides off on the table.
3. Swap the cells, then push the drawer back until it clicks.

The counter can stay on (firmware: brown-out on pull, and reverse polarity is impossible because of the key).

## 4. Questions

- **electronics:**
  1. The connection: (a) contacts or (b) a loop?
  2. USB-C through the empty lane: OK?
  3. The buzzer grille through the dash top: OK?
  4. The J_OLED lead (~120, from the dash to the board at s ~150).
  5. The board's lead lengths after its 84 move.
- **assembly-review:** the swap path, the latch, the insertion by feel, and the dash and lid order against your §2.
  The lane's back wall doubles as the drawer's end stop.
- **ux:** the OLED tilted 60° in the dash's left two-thirds, the ↶ on the cap instead of beside it, and the drawer's
  grip notch.

After agreement: the CAD (`sled.py`, shared roll-test geometry unchanged), checks at e_L 10 and 15, renders
(including the front and the drawer out), SLED-ASSEMBLY.md and the INTERFACES rows.

## Update: ux review (ux/drawer-oled-review-2026-10-17.md), accepted

- **OLED and button swap places in the dash:**
  - The button moves left: cap centre r ~23, cap r 18–28. Its plate (r 15.3–30.7) is partly behind the frame, but the
    cap is inside the opening at e_L 15.
  - The OLED sits mid-opening: module r 31–58.3, active area **r ≈ 34–55.5**. At r 18–40 a viewer 20° to the right
    would lose about half the screen behind the 35-deep tube's edge.
- **The bay** (service only) narrows to r 59.5–70.4 (10.9 inside: the housing's 7.8 plus 1.5 a side, with a pull tab).
- **Accepted as proposed:** the 60° tilt, the ↶ on the cap (≥ 6 mm, ~0.4 raised) and the drawer's grip notch.
- **Added:** a battery glyph ▭+ (~8 mm, 0.6 raised) beside the grip notch.
- **Renders:** an eye camera straight on and at ±20°, through the frame.
- **Still open:** lead's call on drawer vs Li-ion in place. With Li-ion there is no drawer, but the dash row (button,
  OLED, bay) stays the same.

## Update: electronics' answers (battery-drawer-electrical-2026-10-17.md §4), if AA stays

1. **Contacts (a):**
   - gold spring pogo pins, ≥ 1.5 N each, in the lane's back wall;
   - gold flat targets on the drawer's rear;
   - mid-stroke when latched;
   - ≥ 10 from the USB cut-out (they're dead with the drawer out);
   - no magnets.

   The JST disconnect goes, and no slack chamber is needed.
2. **USB-C through the lane:** OK, with a ~20 × 14 lead-in funnel round the cut-out.
3. **Buzzer:** the grille goes in the dash top, port up, ≤ 2 to the grille.
4. **OLED lead:** 120–150.
5. **Lead lengths:**

   | Lead | Length |
   |---|---|
   | Button | ~180 |
   | Buzzer | ~200 |
   | J_PT extension | ~140 |
   | LED | ~80–100 |
   | Battery | ~60–70 |

Agreed with electronics and ux. assembly-review's review is pending, and so is lead's call on drawer vs Li-ion.

## Update: assembly-review (2026-10-17-drawer-review.md), no blockers; how I'll fold in its findings

- **S28:** a ≥ 5 × 5 chamfer on the drawer's bottom-left corner. At e_L 15 that corner is only 1.1 inside the opening's
  R10 corner.
- **S29:** the grip notch becomes a finger pocket (≥ 18 × 10 × 8) in the drawer's front plate, low enough to be clear
  of the dash. The ▭+ glyph sits beside it.
- **S30:** USB-C at plug-on-the-lane-floor height, with a tapered guide (electronics' ~20 × 14 funnel) round the
  lane's back-wall cut-out.
- **S31:** the dash's leads (OLED, button, buzzer, J_PT extension) run in a duct in the hidden strip r 1.2–19, never
  across the open lane.
- **S32:** the OLED window's top edge is chamfered back along the ~31° sightline, so the screen's rear rows stay
  visible.
- **S33 (the loop):** moot, since electronics picked contacts. The holder is still retained in the tray.
- **N21:** a lead-in funnel at the lane's mouth.
- **N22:** the "roof ~46" is stale (the interior is ~60). The flat top at 52 has more margin.

## Built 2026-10-18 (`sled.py`, guide `SLED-ASSEMBLY.md`): lead DECIDE: AA drawer

As proposed, with these changes found while building:
- **The lane is 2.4 right of the draft (r 21–72).** Its right wall stands under the rail, with a 45° shelf up to the
  box wall.
  - A 6 × 6 chamfer would have cut into the FIT0610's corner.
  - The drawer's corner now clears the opening's R10 corner by > 1 at e_L 15 with a **1.5 key chamfer** (S28).
- **The dash prints on its front face,** so every rear-facing cavity face is a 45° point or a ≤ 10 bridge.
  - The OLED module goes in from the open rear and is glued.
  - The button cartridge seats in a 45° countersink.
  - The bay is 9.0 inside.
  - Both snap arms sit in 1.0 walls; the right one is in the bay's wall.
  - The buzzer stands beside the button's hollow.
  - **The OLED's active area is at r 32.9–54.6** (ux asked for ≈ 34–56).
- **The OLED window's top and bottom edges are horizontal,** cut back along the sightline (S32). The tilted plate
  would otherwise shade a level view.
- **Lid:** the rear lips sit only in the right two windows. A left one would cut the roof's edge.
- **USB funnel:** 16 × 10, not 20 × 14 (its ceiling bridges ≤ 16 on L).
- **Rendering pose:** `DRAWER_OUT` (Pos −125 along s) is the named pulled-out pose, for renders and the film.
