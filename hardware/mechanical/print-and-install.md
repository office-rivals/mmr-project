# Insert: BOM items and print + install guide

Written by mechanical for `hardware/ASSEMBLY.md`. The quantities are **per insert**; a table needs two
(one per goal). Files are in `mechanical/out/`.

## Purchasable items

| Item | Qty per insert | Notes |
|---|---|---|
| PETG filament, **black or dark matte** (e.g. Bambu PETG HF Black) | ≈ 200 g | Estimate: body 175 g, lid 15 g, hatch 6 g. Bambu Studio shows the exact figure. Dark walls keep IR reflections out of the beam |
| Double-sided foam mounting tape, **19 mm** wide (e.g. 3M VHB 5952 or a generic foam tape) | ≈ 0.6 m | Under both side regions, optionally on the outer faces too |
| Duct tape, **19 mm** wide (or cut down from 48 mm) | ≈ 0.4 m | One strap over the roof band, wall to wall |
| Ribbon or a strip of cloth tape, ~10 × 200 mm | 1 | Pull tab to slide the battery holder out of the end face |
| Hot glue | – | Holds the beam elements in place and anchors the battery lead |

The battery holder (DFRobot FIT0610, or Keystone 2487 as the alternate), the TSAL6200, the TEFT4300 and the perfboard parts are on electronics' list.

## 1. Print (Bambu Studio, A1 / P1S / X1C)

1. Open `body.3mf` on one plate, and `left_lid.3mf` plus `battery_hatch.3mf` together on a second plate.
   The parts are already oriented for printing:
   - body: upright, floor on the bed;
   - lid: top face down;
   - hatch: inner face down, pull lip up.
   Don't rotate them.
2. Filament: PETG (Bambu PETG HF or Generic PETG profile). Textured PEI plate. On a smooth plate, use
   glue stick as a release layer.
3. Process: **0.20 mm Standard**, **3 walls**, 4 top / 4 bottom layers, **15 % gyroid** infill.
4. **Supports: off.** The only bridges are the roof over the gate (40 mm), the battery tunnel (18 mm), the
   JST pocket (10 mm) and the USB opening (13 mm); PETG bridges all of them.
5. **Brim: on for the body** (outer brim only, 5 mm). The V-wall tips taper to a thin edge and lift
   without one.
6. Slice and check the preview: the wells for the beam elements must be open from the top, and the two Ø3
   holes must go through into the gate.

## 2. Post-process

1. Remove the brim. Trim the V-wall tips flush with a knife; a ball rolls along them.
2. Clear stringing from the beam wells, and from the two Ø3 holes between each well and the gate.
   A 3 mm drill turned by hand is enough. Look through one hole and you should see daylight through the
   other.
3. Test-fit the parts:
   - the battery holder should slide into its tunnel from the downstream face and out again, with only a
     light drag from the crush ribs;
   - the lid should press onto the electronics side;
   - the hatch should press into its recess in the downstream face with light force and stay put (the
     crush ribs). If it's loose, add a strip of tape on its edge; if it's too tight, scrape the ribs.

## 3. Beam elements

The elements go in the gate under the roof. The right side holds the emitter, the left side the receiver.
Splice each element's legs to its jumper (lengths in electronics' guide) **before** fitting it. The
splice sits in the 3.6 mm lead slot behind the flange.

1. **Emitter, TSAL6200** (right side). Bend its two leads so they sit **one above the other**. Lower it
   into the well on the right side of the gate: dome toward the gate, flange into the wider slot. Push it
   forward until the flange sits on its shoulder. The splice goes up the lead slot.
2. **Receiver, TEFT4300** (left side, in the solid block beside the gate). Fit it the same way.
3. Check the alignment by looking through one Ø3 hole at the other element; both must be centred. After
   calibration, put a dab of hot glue on top of each flange. Use a glue-gun needle tip: the flange is
   ~35 mm down.

## 4. Electronics board

Trim every pin and lead underneath to ≤ 2 mm first. The board only touches the plastic on its joint-free
zones: the end rail under the USB-C end, the 1.5 mm strips along both long edges, and the 2 pin bosses.

1. Lay the 70 × 30 perfboard in the left (electronics) bay:
   - **XIAO USB-C end toward the downstream wall**, header edge (J_PT/J_LED/J_BAT) toward the outer wall;
   - the USB-C port must be centred in the opening in the downstream wall.
   No screws. Hold it level over the bay, with the far hole on the gate side over the printed pin, and press
   it **straight down**. It snaps past the 2 small detents on the outer wall and the 2 clips on the gate
   side. Crush bumps under the lips and hooks clamp it, so it can't rattle. The
   accelerometer needs that.
2. **To remove it:** push the tab of the clip nearer the USB end outward (toward the gate). The other clip,
   near the V-wall, is a detent: lift the header edge and it pops (~7 N).
3. Check that a USB-C cable plugs in from outside the downstream face. The plug's overmould must be
   ≤ 12.5 × 7.5 mm to fit the 13 × 8 opening. A straight cable (plug up to 40 mm long) and a right-angle
   cable both fit in the free floor in front of the face, so firmware can be flashed with the insert taped in
   and the drawer in the table.

## 5. Battery holder

The holder sits in a tunnel in the right side of the insert and comes out of the **downstream face** (the
collection end, where you take the balls out). Cells can be swapped with the insert taped in and the drawer
in the table, without going near the top.

1. Set the holder's slide switch (on the back of the FIT0610) to **ON** and leave it there. Leave the
   cover screw out.
2. Fit the JST-PH disconnect in its lead (electronics' guide).
3. Pull tab: lay the ribbon lengthwise around the holder (under it, round the end without leads and back
   over the top) so both ends stick out at the lead end. Tape the ends together into a loop.
4. Stand the holder on its long edge (47 mm tall) and push it into the right-hand tunnel in the downstream
   face, **lead end last**, until it stops against the back wall. Its crush ribs hold it.
5. The board-side battery lead comes down the channel at the back of the pocket beside the tunnel mouth
   (it gets routed in step 6). Plug the JST together, push the mated pair straight into the pocket, and
   tuck in about 40 mm of board-side lead loop behind it. The holder's own leads fold into the 4 mm gap in
   front of the holder.
6. Press the hatch into the face, pull lip at the top, until it sits flush. Balls can only push it further
   onto its ledge, and the lip is above the height a ball can reach.

**To swap cells** (from the collection end; nothing else comes apart):
1. Take the balls out. Pull the hatch off by its lip.
2. Pull the JST pair out of its pocket by the **plastic housing**, not the wires. It comes about 40 mm past
   the face. Unplug it.
3. Pull the holder straight out by the ribbon loop. It needs about 70 mm of floor, which is free in front of
   the insert. Once it's clear of the face, lift it out.
4. Slide the cover off (FIT0610) or snap it off (2487), swap the 3 × AA and refit the cover.
5. Slide the holder back in until it stops. Plug the JST in, push it and the lead loop back into the pocket,
   and press the hatch home.

## 6. Wires

1. All wires run in the 6 × 4 mm grooves on top:
   - the emitter leads run across the roof over the gate into the electronics bay;
   - the board-side battery lead runs from J_BAT the same way, then along the groove on the right side's top
     and down the channel into the JST pocket. Put a dab of hot glue where it enters the channel: that's
     the anchor, so pulling the JST out at a swap never pulls on the board;
   - the receiver leads go straight into the bay.
2. Plug them onto the board headers (electronics' guide has the pinout).
3. Press the wires flush into the grooves. A strip of tape over each groove keeps them in until the strap
   goes on.
4. Press the lid onto the electronics side; its lip has crush ribs. The hole in the lid sits over the
   calibration resistors: reach them with tweezers or long-nose pliers.

## 7. Fix into the drawer

1. Pull the drawer out. Clean the floor where the insert sits with isopropyl alcohol.
2. Apply double-sided tape along the full length of the underside of both side regions. They are flat,
   about 55 mm wide. Optionally, add a strip on each flat outer face against the drawer walls.
3. Position the insert:
   - **downstream end 73 mm from the collection end wall**. That floor is where the battery holder slides
     out and the USB cable plugs in, so keep it free;
   - centred, which happens by itself because the insert spans wall to wall;
   - ramped tips pointing toward the goal entrance.
   Press down firmly for 30 s.
4. Strap the duct tape across the **roof band**, the last 22 mm of the insert: start low on the left
   drawer wall, go over the top, and finish low on the right drawer wall. Do not cover the hole in the lid
   or anything on the downstream face (battery hatch, USB opening).

## 8. Ball test

1. Slide the drawer back in. Drop a ball through the goal 10 times, aiming at the left, centre and right
   of the goal mouth. Every ball must roll through the gate and come to rest downstream of it.
2. **Slow-ball test:** pull the drawer out a little, put a ball by hand at the tip of each V-wall and at
   the far corners under the entrance, and let go from rest. It must roll along the wall into the gate
   every time. A ball that stops on a V-wall or a ramp is a stall. Report it with the drawer's real slope,
   because the V-wall angle can be made shallower (`FUNNEL_DEG` in `insert.py`).
3. With the firmware running, every ball through the gate must register exactly one goal (see
   electronics' test step).

---

# Scoreboard

The files are in `mechanical/out/`, made by `scoreboard.py`. You need one scoreboard per table.

## Scoreboard: print

v5, for the right end of the end shelf (`README.md`, Scoreboard).

1. Use the same filament and process as the insert: PETG, 0.20 mm, 3 walls, 15 % gyroid, on a **textured PEI** plate.
   Print the shell, cover and rim in the **same colour** (black looks best: the window's mask matches it).
2. `scoreboard_shell.3mf` is already oriented **face down**: the window and key openings print clean and the face comes
   out matte. Supports off. The top's underside and the front wall rise at about 40° from the bed; PETG prints that, but
   if yours sags there, add supports for those two faces only.
3. **First, the stem-fit test** (`scoreboard_stemtest.3mf`, 10 min): 4 key-cap sockets, numbered 1–4 (0.05 / 0.10 /
   0.15 / 0.20 mm clearance). Push each onto one of your MX switches. Pick the lowest number that goes on by hand and
   comes off without lifting the switch, set `STEM_CLR` in `scoreboard.py` to it, and re-run the script. The default
   is 2 (0.10). Printed in PLA it's only indicative (PLA prints tighter): re-check in PETG before printing the caps.
4. On a second plate: `scoreboard_cover.3mf`, `scoreboard_frame.3mf` (the panel's backing plate),
   `scoreboard_keyplate.3mf`, `scoreboard_shelf.3mf`, `scoreboard_rim.3mf` (the window's rim) and
   **4 × `scoreboard_key.3mf`** (caps, top face down). The key plate must come out **1.5 mm thick** where the
   switches clip in; measure it.
5. **`scoreboard_badge.3mf` in natural (or white) PETG**, back down, face up, as it is oriented. It's the badge target
   in the face's right wing and has to let LED5's light through. Turn **ironing on** for its top so it comes out smooth.
   On a single-colour printer, print it as a separate job.
6. **Sound, option A (the speaker, default):** `scoreboard_speaker_cup.3mf` (the speaker's back cup), bottom down and
   open end up, as it is oriented. Any colour; it's inside. Option B (the buzzer) uses a printed disc instead:
   electronics' guide.
7. **Cut the LED bar:** a **2 mm opal (white translucent) POLYCARBONATE** strip, **84 × 6.5 mm**. Polycarbonate, not
   acrylic: acrylic can crack when a ball hits it. Cut it with a fine saw or score it deeply and snap it, then sand
   the cut edges flat. Keep the protective film on until it's fitted.
8. **Cut the protective window** (user/ux): **3 mm low-haze anti-glare hard-coated polycarbonate** (satin on one side;
   glossy hard-coated PC is the fallback).
   - **Size:** **97.0 × 80.6 mm**, corners rounded to **R 2.5** (file them). The self-check prints these numbers; use
     the current ones.
   - Score deeply, snap or saw, then sand the edges smooth and slightly chamfered.
   - **Mask the back:** matte black self-adhesive vinyl (or black paint over masking tape) on the **back** (the
     non-satin side), leaving a clear aperture of **90.4 × 69.2 mm**. The mask widths from the window's edges are
     left **3.3**, right **3.3**, top **10.5**, bottom **0.9**; top is the long edge that goes up the face. The
     aperture is the e-paper's active area + 2.8 mm all round, so the image is framed evenly. Unmasked, the panel's
     wider border on its ribbon edge would show at the top. If you measured `ACTIVE_DX` / `ACTIVE_BOTTOM` on your
     panel, re-run the script and use its numbers.
   - Keep the film on the satin side until the end.

## Scoreboard: fit the parts

Order matters: work from the face outward, then the PCA9685, the wing, the main board and the battery.

1. **Phone NFC tag, first:** clean the inside of the LEFT side wall inside its printed ring, upper back (isopropyl
   alcohol), and press an on-metal NTAG213 (Ø25) in, **printed/front side against the wall** (ferrite side facing in).
   A phone held flat on that wall reads it through the 2.5 mm wall, above the bead counter. The raised wave mark
   outside shows where to tap. Before writing it, see `hardware/ASSEMBLY.md` (the table's permanent link goes on it).
2. **LED bar:** peel the film and lay the opal strip into its pocket above the keys **from inside**, glossy face out.
   Small ledges stop it at the outside. Put a dot of hot glue at each end. It has to go in before the LED strip (the
   LEDs would be in the way).
3. **Keys (MX switches):** clip the 4 switches into the key plate (`scoreboard_keyplate`) from its front, **pins up,
   away from the bottom rail** (toward the LED strip).
   - Hand-wire them behind it (electronics' guide: the KEYS and GND buses, the 3 ladder resistors, 2 wires to J_KEY).
     Joints and resistors stay within ~3 mm behind the pins.
   - The face has 3 posts with mushroom heads (2 beside the outer keys, 1 under the middle). Hold the plate **3 mm
     higher** than its place, switches toward the face, so the heads go through the big round ends of its 3 keyholes.
     Push it onto the posts, then **slide it 3 mm down the face** until the necks sit in the slots' ends.
   - The heads hold it, and the slope keeps it down. Once the caps and the LED strip are on, they lock it in place.
   - To take it out (to swap a switch), first pull the 4 caps (from outside) and take the LED strip off its pins,
     then slide the plate up and lift it off.
4. **LED strip:** the 4 RGB LEDs are soldered flush on the 98 × 8 LED strip, with the PCA9685 already wired to it.
   - The LEDs' lead joints may hang up to 10 mm behind the strip; there's room for them.
   - Press the strip straight onto its 2 pins (outboard of the bar, above the key plate), LEDs toward the face, and put
     **a dot of hot glue over each pin tip** so it can't slide back off.
   - **Let the PCA9685 hang out of the open back on its wires** until step 8: the panel and its backing plate have to
     pass its place first.
5. **Panel:** lay the GDEY042T81 face down into its recess in the face, **ribbon-cable edge up**, and check that the
   visible area is centred in the face's view opening. Don't touch the visible area.
6. **Foam + backing plate:** stick a 1 mm foam sheet (~89 × 74 mm, kept 1.5 mm in from the panel's bottom edge) on the
   back of the panel.
   - Then press the backing plate (`scoreboard_frame`) over the 4 pins on the inside of the face, panel side first.
     It bottoms on the face; the foam holds the panel lightly against the skin over its border.
   - If a hard shot ever pushes the window onto the panel, the panel is pressed flat onto the backing, not bent.
   - The plate's fin roofs over the LEDs, and its 3 thin baffles reach down to the bar at the key boundaries, so
     neighbouring keys' colours stay apart (ux).
7. **Adapter:** plug the ribbon cable into the DESPI-C02's ZIF connector **in hand**, then fold the cable
   180° over the plate's top edge through the slot (bend radius ≥ 1 mm, no crease). Press the adapter onto the 2 pads
   on the plate's back with foam tape, ZIF edge up against the 2 locators. Its 8 soldered wires leave the bottom edge.
8. **LED driver (PCA9685):** now bring it in through the open back, **held about 10 mm up**, and lower it **on its long
   edge** into the 2 floor slots between the key plate and the main board's place. Parts face the front, wires go up
   off the top edge.
9. **Badge insert + LED5 (right wing):** put a dot of hot glue in the round socket on the back of the insert's tongue
   end and press LED5's dome into it, leads pointing back, then sideways toward the screen side (4 twisted wires to the
   PCA9685, electronics' guide; never across the reader).
   - Reach in through the open back into the right wing, hold the insert about 12 mm off the face, and push it **out
     into the badge-shaped window in the face**.
   - The card goes into the window, the tongue into its recess running down the face. It sits flush; its shoulder
     stops it.
10. **RFID reader (RC522), right wing:** put a 1 mm foam-tape square on each of the 4 printed pads on the inside of the
    wing's face.
    - Bring the module in through the open back, **flat back toward the face**, header end down, its loop end up.
    - Set its bottom edge on the 2 small ledges, then press it out onto the pads. It holds the insert flush.
    - If it won't sit down on its tape (the insert's back is a little thick), sand the back of the insert's shoulder.
    - Its wires leave the header end, downward, toward the main board.
11. **Amp (option A):** a PAM8302 clone with its 470 µF capacitor soldered on, lying flat beside the board.
    - Put 1 mm foam tape under the board and press it onto the floor of the right wing, near the face. Components up,
      the capacitor toward the back.
    - The bay takes a board up to 27 × 21 mm and the capacitor up to Ø10.5 × 14. It sits ≥ 30 mm from the reader.
    - Its wires go to J_AMP on the main board and to the PCA9685 ch15 (SD), along the floor, away from the reader.
12. **Speaker (option A), on the right (outer) wall, back-low:**
    1. **Outside the case:** thread the speaker's two leads out through the small hole near the **back cup's** bottom
       edge.
    2. Press the speaker into the cup's mouth, cone outward, until its rim sits on the cup's shoulder and its front is
       flush with the cup's rim. The 4 ribs grip it, so it can't rattle.
    3. Seal the wire hole with a dot of hot glue. The cup is the speaker's sealed back volume (24 cm³).
    4. Stick a **1 mm double-sided foam ring** (outside ≈ Ø44, inside ≈ Ø32, cut from foam tape) on the unit's flush
       front.
    5. Clean the inside of the right wall inside its low round lip (isopropyl alcohol). Reach in through the open back,
       wire hole down, hold the unit a few mm off the wall, slide it sideways into the lip over the grille, and press.
       Hold it for 30 s.
    6. Twist the leads (≤ 15 cm) and solder them to the amp's speaker pads, routed away from the reader.
    7. **Option B instead:** the buzzer push-fits in its printed disc; tape the disc into the same lip with the same
       foam ring.
13. **Main board:** it lies flat on the floor **under the battery shelf**, header edge toward the back, its USB-C end
    toward the left wall, 29 mm from it.
    - Plug the **USB-C extension's male end** into the XIAO **before the board goes in**: once it's in its cradle there
      isn't room to plug it in (review N14). To unplug it later, lift the board out first.
    - The male end is the **right-angle, in-plane type** (the cable leaves sideways, in the plug's flat plane; electronics
      bom S25). There isn't room for a straight one: only ~13 mm to the left wall. Turn it so **the cable points toward
      the face**.
    - Slide the header edge under the 2 lips, lower the board so the hole at the far end of the front edge drops over
      the printed pin, and press the front edge down until both snap clips click.
    - No screws. Crush bumps clamp it so the accelerometer doesn't rattle. To remove it, push the 2 short clip tabs
      forward.
    - Route the extension's cable forward along the floor beside the plug, up in front of the battery shelf, then
      across in front of the battery's place, above the board's plugs. Coil any excess at the left, away from the reader.
14. **Battery shelf + battery:** drop the shelf onto its 2 posts (the pin locates it). Set the FIT0610 to ON and loop
    a ribbon under it as a pull tab. Stand it on its long edge in the fence on the shelf, leads out through the notch
    at the left end.
15. **Back cover:** drop the extension's **female end** into the clip on the inside of the cover (flange down between
    the 2 rails, socket out through the cutout). Then press the cover in (lip + crush ribs); a rib on the cover keeps
    the holder upright.
16. **Key caps, from outside:** push each printed cap through its opening onto its switch's stem, the long side
    across, until it stops. It sits 3 mm proud.
    - Check every key: it clicks about 1 mm before the cap is flush with the face, from each corner too, and the cap
      doesn't rub the opening.
    - If a cap is loose or too tight on the stem, change `STEM_CLR` (stem-fit test) and reprint it.
    - To pull a cap off, grip its sides with flat pliers with tape on the jaws and pull straight out; a keycap puller
      won't fit.
17. **Window:**
    - First tape the **rim** (`scoreboard_rim`) onto the face: its 3 sides go round the view opening, the open side
      down (above the LED bar), dropped into its 0.3 mm pocket in the face, which locates it.
    - Stick thin double-sided tape (≤ 0.2 mm, clear) along the window's border on its masked back, **outside the
      aperture**.
    - Lay the window into the rim, masked side down, and press it down. It sits flush with the rim.
    - Peel the window's front film.
18. **Bench checks (ux, electronics):**
    - 'Won' at High must not rattle the case, the caps, the window or the badge insert.
    - LED bar (opal PC diffuses differently from acrylic): a lit key's colour may leak into its neighbour by ≤ ~15 %.
    - Badge glow (LED5 is below the reader now): no hot spot outside the mark, the brightest glow inside it, and the far
      end ≥ 30 % of the near end. If not, LED5 moves up beside the loop (≥ 10 mm from the copper).
    - Card read with the case closed, at ~2 cm (the speaker's steel pot is the nearest metal to the loop).

**To swap cells:** pull the back cover off by its finger grip. The USB extension's cable tethers it: lift the USB
socket up out of its clip and set the cover aside (review N15). **Slide the holder straight out backwards; don't lift it.** Slide its cover off, swap the 3 × AA, slide it back into
the fence and press the cover in.

**To flash the firmware:** plug a USB-C cable into the socket in the back cover. Nothing has to come off.

## Scoreboard: mount on the table

1. **Where:** the **right end** of the end shelf (as seen from the playfield), against the side panel (≈ 2 mm gap), beside
   the bead counter, with the face looking **along the table**, square to the rail. Footprint: INTERFACES §0; it
   fits the shelf's flat top, and nothing overhangs the playfield.
2. Clean the shelf there with isopropyl alcohol.
3. Put **3 strips of 19 mm double-sided foam tape** across the full width of the base: at the front edge, in the middle,
   and ~66 mm back, all on the flat. Press down firmly for 30 s.
4. The battery sits low at the back (centre of mass ~61 mm back of 91, 41 up), over the middle of the flat, so jabbing
   the keys (≥ 20 N, ux) doesn't tip or creep it.
