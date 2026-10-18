# Goal-counter sled: what the assembly review will check (2026-10-17)

These are the criteria I'll use on mechanical's layout proposal (DECISIONS 2026-10-17). I'm sending them now so the
proposal can answer them first time. The numbers come from `mechanical/roll_test.py` (W 135, L's box BLK = 81.4 wide,
front wall s 36, emitter dummy s 183–205, roof 52 at the left wall falling toward the gate, opening 130 × 55 R10, the
wooden floor ~10 below the frame's bar) and from `electronics/dimensions.md`. Every value is EST until it's measured
(rule 11).

The gate (`assembly-review/check.py`) will check the sled the same way it checks the scoreboard: every part on its
real path, sweeping against what's already placed, with soldered joints taken out of the moving set.

## 1. Build order (bench)

- Each part has a straight path into L's box: board, battery holder, emitter, harness, lid. Nothing is threaded
  past a part that's already fixed.
- The emitter (TSAL6200) goes into its well before the board covers its lead route, or it goes in from above
  after the board. Say which.
- The receiver cartridge drops into R's pocket from the back (already modelled). Its lead goes into R's groove and
  reaches the plug at R's front with ≥ 10 slack (electronics gives the length).
- The lid goes on last. It's held by something you can see and work (a snap, clip or magnet). It doesn't rely on
  gravity: L gets tilted when it's lifted over the frame's bar.

## 2. Wiring and plugs

- Each plug (J_PT for the receiver, J_BAT, the emitter) has ≥ 12 clear above its header so fingers can pull it.
  None is under the battery or the lid's ribs.
- No wire crosses the channel. No wire rests on the V-wall's ball face or on the rail.
- The battery lead (~150 on the FIT0610) has a place to coil that isn't under the board's under-side keep-out
  (3 mm) and isn't pinched by the lid.
- The receiver plug at R's front can be reached and unplugged at the mouth, by hand, with the sled in place
  (frame tube ~35 deep).

## 3. Battery swap without tools

- The whole sequence works by hand: unplug the receiver, pull R out, lift L over the bar, open the lid, slide the
  FIT0610's cover off, swap the cells, then reverse. That's no screwdriver and no hot-glue.
- L has a pull feature (a finger hole or tab at the front face, ≥ 18 × 12) that you can reach in the ~35 tube.
  Lifting L ~10 over the bar must not catch the lid, the USB plug or the receiver plug.
- The FIT0610's cover slides off along its long axis, so the holder needs ≥ 50 clear in that direction with the
  lid open, or it has to come out of its seat. Its on/off switch is on the back: it must be reachable without
  taking out the holder, or it isn't used (say which).
- The holder is held without tape that has to be peeled for every swap (clips or a pocket).

## 4. USB through the frame

- The USB-C port is on L's front face, inside the opening's projection with margin: ≥ 10 above the bar's top
  (the floor is ~10 below the bar), clear of the R10 corners, and ≥ 3 from the opening's edges. The opening's
  sideways position relative to L's left face (e_L) isn't measured. Say what's assumed.
- The plug overmould needs ~12 × 7 clear in front of the port. The XIAO's receptacle is ~1.4 inside the board's
  edge, so the front wall needs a hole that lets the overmould reach it, or the wall needs a recess.
- Push and pull forces go into the board's rest pad (x 4–22), not into the XIAO's headers.
- The antenna end (x 18–22) is ≥ 5 from metal: the cells, the holder's springs and the switch.

## 5. Service

- The calibration sockets (x 54–62, y 23.7 / 26.3) can be reached through the ≥ 12 × 12 opening in the lid with
  the board in place, and a resistor can be swapped with fingers or tweezers.
- The board comes out without desoldering: unplug, release the 2 lips and the 2 clips. The cartridge comes out
  of R by hand.
- Re-assembly ends with a rigid sled. The board doesn't rattle (the accelerometer is on it), and the battery
  doesn't slide in the box when a goal hits.

## 6. Printability

- L, R, the lid and any cartridge print supports-off, with mechanical's own checks: overhangs ≤ 45° or bridges
  ≤ 10/16 anchored at both ends, seam off the sliding faces, and each part fits a 256 × 256 plate.
- Pin, lip and clip features for the board and the holder print in an orientation where they're strong (not
  across layers at their root).
