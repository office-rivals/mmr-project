# Sled CAD review 2: the gate on `sled.py` (2026-10-17)

The assembly gate now covers the sled: `uv run python ../assembly-review/check.py sled`, run from `mechanical/`.
Its 30 steps follow `mechanical/SLED-ASSEMBLY.md` §3–§6 against the current `sled.py` (the cord-loop version, e_L 10–15).

- **Parts:** the real 70 × 30 board, taken from `electronics/perfboard.py` with its parts and plug columns.
- **The frame:** modelled as a plate, s 0–35, with the 130 × 55 R10 opening on the bar. The reach checks run at
  e_L 10 and at 15.

**Result: 27 pass, 3 fail. The full gate is 95 pass, 3 fail.**

## Blocker

**B15. The board can't go in: the pin at y 26.5 holds it out from under the lips.** → mechanical (the pin),
electronics (dimensions.md says 2 pins).
- The two Ø2.8 pins (s 104, at board y 3.5 and 26.5) stand **2.0 above the board's top**, so 3.6 above its underside.
- The socket edge has to slide **0.6 under the lips**, which leave **0.1** over the board. To do that, the board comes
  in shifted 1.2 away from them and tilted with that edge low, then slides across and rolls flat.
- Each pin hole has to stay above its pin through that slide, because the hole has only 0.2 of clearance:
  - At y 3.5 that's fine: the hole is 26.5 from the edge, so an **8° roll lifts it 3.7**.
  - At y 26.5 it's impossible: the hole is **3.5 from the edge**, so it would need 3.6 of rise at 3.5 from the pivot.
    No rotation does that.
- **Gate:** `board vs L alone (pins, lips)` fails at pose 20 with 2.5 mm³ in the pin.
- **Probes** (scratchpad, L without the button):
  - Both pins fail at rolls of 8, 10, 20 and 35°.
  - The **y 3.5 pin alone passes at 8, 10 and 12°**.
  - No pins passes.
- **Fix:** drop the pin at y 26.5 and keep its Ø7 boss as a rest pad. The board is still located by:
  - the y 3.5 pin;
  - the front wall and the back stop (0.3 each);
  - the lips' side walls and the clip arms (0.3);
  - the pads, lips and clips (in z).
- The second Ø3.2 hole in the perfboard stays, unused. dimensions.md's "2 pins" becomes 1.

## Should-fix

**S27. The guide fits the undo button before the board, but the board's USB end has to go in under the button's
cartridge.** → mechanical (SLED-ASSEMBLY §3).
- The cartridge (s 37.2–47.8, from z 28.5) and its ring (s 37.2–38.4, y −43.2 to −24.8, z 28.3–44.7) sit over the
  board's front end.
- The back stop leaves the board only **0.3** of play along s, so it can't be lowered straight past them.
- **With the cartridge already in:** no path was found. That includes a 40° far-end-up tilt that starts 16 behind the
  seat; the far end then hits the back stop. **Gate:** `board pitch + roll-in`, pose 4, 155 mm³ into the button.
- **With only the ring there:** there is one narrow path, which passes.
  1. Hold the board far end up ~12°, with its USB end ~1.3 behind its seat. That keeps the far end inside the back
     stop and the USB receptacle's top behind the ring.
  2. Lower it, slide it forward under the ring, and lower the far end.
  3. Roll the socket edge under the lips at ≥ 8°.
- **Fix:** in §3, move the undo button after the board. The cartridge loads from the front anyway. Feed its wires in
  through the window, plug J_BTN, then push the cartridge in. The gate's button step passes from the front with the
  board in place, since every board part is under z 22 there.
- Add the board's tilt to step 5: "far end up a little, USB end first under the ring behind the front wall, then
  lower it, and tuck the socket edge under the lips".

## Nice

**N20. The guide's 5° lid tilt jams.** → mechanical (SLED-ASSEMBLY §3.9 and §7).
- The lid turns about its rear lips' tops in their windows. At 5°, its top rear edge (3.4 above that pivot) swings
  **0.3** into the roof's front wall at s 194, which is only **0.2** away. **Gate:** `lid at 5 deg`, 10.6 mm³.
- **2° passes**, and it already lifts the front ~5, enough to clear the front wall.
- **Fix:** "lift the front ~5 mm (≈ 2°)", or chamfer the lid's top rear edge by 0.5.

## Verified ✅ (layout review 1)

- **S21:** the pocket is at s 112.8–181.8, the back stop is its front wall, and the corner notch is there. The holder
  goes in and lifts out with the board in.
- **S22:** the rib is notched and the roof starts at s 199 there. The emitter, with its legs bent toward −s, drops into
  its trough.
- **S23:** the 3-pin header drops into the 7.62 slot. The keyed plug comes straight out of the mouth through the
  frame at e_L 10 and 15, and a Ø14 fingertip reaches it from above.
- **S25:** the pair fits the 3.4 × 2 bridge rebate.
- **S26:** the posts end 1.5 over the holder, and the 3 mm foam squeezes to 1.5.
- **N17:** the LED-lead clips are there. **N18:** the bosses are tied to the back stop.
- **The lid:** held when L tilts. Lifted 1 mm, the front tab hits 1.8 mm³ of L and the rear lips 15.7 mm³.
- **Others:**
  - The USB-C plug reaches through the frame at e_L 10 and 15.
  - The calibration sockets are open under the lid hole.
  - The JST pair lifts out.
  - The buzzer slides onto its cradle.
  - The button's crush ribs grip.
- **S24 and N19 are superseded:** the finger cup is gone. The pull is a cord loop through two holes in the mouth bay's
  left wall (s 41 and 47, z 33), inside the opening up to e_L ~50.
  - It pulls on L's structure, not the lid.
  - Its knot sits beside the mouth plug, and the fingertip and plug paths still pass with it there.

## Re-check log

- **2026-10-17 14:45, mechanical's fixes:**
  - **B15** ✅: the pin by the lipped edge is gone, and `dimensions.md` now says 1 pin.
  - **S27** ✅: the guide fits the board before the button.
  - **N20** ✅: the guide says to lift the front ~5 mm (≈ 2°), and the lid has a 0.5 rebate.
  - The gate follows the new order and tilts the lid about the lips' line, which slopes with the roof:
    **sled 29/0, full gate 97/0**.
  - The 5° run was dropped because the guide no longer says 5°.
  - The wording slip at SLED-ASSEMBLY.md:63 is fixed ✅ (14:41): "header edge rolled up ~8° (the socket edge … stays low)".
