# Goal-counter sled: layout proposal (mechanical, 2026-10-17)

Status: **AGREED** (electronics + lead, 2026-10-17; electronics: header pin row at z 27-28, the bay open on top for the plug loop, J_PT extension ~80). It adopts electronics' placement (`electronics/sled-layout-2026-10-17.md`) with the three
counters in §2, and answers assembly-review's checklist (`assembly-review/2026-10-17-sled-criteria.md`) in §4.
Coordinates are `roll_test.py`'s: s inward from the frame's outer face, y = 0 at L's left face (the channel side is
at −81.4), z up from the tunnel floor. Every number is EST (rule 11).

## 1. What stays, and how the code is shared

- **Baseline = roll test v2 with the 2026-10-17 fixes.** That covers the outline, the rail and tongues, R's skin, pod
  and cartridge, the V-wall and roof, and the beam at s 194.
- **`mechanical/sled.py` imports `roll_test.py`; nothing is copied.** It reuses the constants, the R parts, the
  helpers (`dovetail`, `tongue`, `yz_prism`) and the checks (`unbridged`, `check_plate`, `back_seams`).
- L's shell (walls, rail, V-wall, roof, ribs) moves into one function that both scripts call. The roll test adds its
  test-only parts (cross walls, emitter dummy, gauge marks). The roll test's STLs must stay byte-identical (cmp).
- **The sled's L is new; the roll-test L stays a test unit.** R gets one change (§2.4), so the final R is reprinted
  once on plate 1, as before.

## 2. Electronics' placement: agreed, with three counters

| Part | Where (from electronics) | Mechanical's part |
|---|---|---|
| Board 70 × 30 | s 37.5–107.5, y −50 to −20, underside z 12.7, components up, USB end at the front wall | **Supports in the keep-out zones only** (dimensions.md B4): edge strips, end rail, Ø7 pin bosses. Ø2.8 pins at s 104. A back stop at s 107.5. The 2 lips (socket edge) and 2 snap clips (header edge) flex **along s**, in the layer plane |
| USB-C | Port centre z 20, y −33.9. **14 × 8.5 straight cut-out** in the front wall, no extension | The cut-out has a 45° pointed top: it would otherwise bridge 14 in a 1.2 wall. Usable 14 × 8.5 |
| FIT0610 | s 112–180, y −48 to −1.2, flat, cover up, leads out of the front end | A pocket 69 × 48 with 10 mm walls, and a 32-wide finger gap on the channel side. **Counter 1:** no flexible hooks. Two posts on the lid's underside press the holder down. Hooks printed upright on L break at their root, across the layers. The posts are in compression, and the lid is snapped on (§3) |
| JST pair | Floor pocket s 86–108, y −66 to −57 | As drawn: 23 × 10 × 8, open top |
| Emitter | Well at s 194, legs out of the back (+y) into the bay s 183–194 | **It goes in from the box side along +y** into a horizontal teardrop bore. The flange sits against the bore's shoulder. A **printed clip** dropped behind the flange holds it (tool-free, removable). The lead runs through a notch in the s 181.8 cross wall |
| Mouth joint | Clip on L's top at s 38–50, y −70 to −60, ≤ 46 high | **Counter 2:** the joint is **recessed into a bay inside L's roof plane**, not on top. The bay is s 37.2–52, y −71 to −54, floor z 26, open at the top and through a notch in the front wall. L's top there is only ~40, the tunnel roof is ~46 EST, and R's bridges top out at 43. The 2-pin male header sits in a slot in the bay's back wall, **pins facing the mouth (−s)**. The J_PT extension comes in from behind. R's female plug pushes on along +s and pulls off along −s |
| Leads | LED ≈ 200 along the channel-side wall · J_PT extension ≈ 100 · battery 100 + 70–80 | Agreed. Every wire stays off the rail, the V-wall's face and the board's under-side keep-out |

**2.4 R's one change.** The receiver lead leaves R's U-channel at the front bridge's front face (s 52). It climbs that
face at y ≈ −132, z 34 → 43, which keeps it clear of a 36 ball by 5 or more. Then it runs across the bridge's top in
a 2 × 2 groove (vertical walls as R prints) to the bridge's L end at y −71.4, and drops into the bay. It stays above
the queue on R's own bridge, so no wire crosses the channel loose.

**Counter 3: the pull feature.** It is a **finger cup in the free strip at L's left front**, not a hole above the USB.
- The front wall gets a notch at y −1.2 to −19.5, open from z 24 up to the lid. Behind it is a cup, s 37.2–52, with a
  solid base up to z 24. The lid closes the cup's top.
- The finger pulls on the cup's back wall (L's structure), never on the lid or the board.
- A hole above the USB would need a cup floor bridging 18 over the XIAO, or a finger curling down onto the USB end.

## 3. The lid

- The lid is **one flat print in the roof plane**. It covers s 37.2–194 minus the mouth bay, and has a 14 × 14 hole
  over the sockets (s 89–101, y −31 to −19).
- **It is held, not just resting** (L tilts over the bar):
  - At the back, two tongues slip into two ≤ 14-wide slots under the roof's front edge at s 194. The slots have 45°
    roofs.
  - At the front, one spring finger is cut in the lid's own plane. It flexes through its thickness, along the layers,
    which makes it strong. Its bump clicks under a 45° ledge on the front wall's inside.
- **To open it,** press the finger's tab with a thumb, lift the front and slide the lid forward out of the slots.
- Clearances: ≥ 10 over the header plugs (z 31 → lid ≈ 41.8), 17 over the sockets. The two battery posts are ~23–33
  tall.

## 4. Assembly-review's checklist

1. **Build order** (each step drops straight in; nothing is threaded):
   - Emitter and its lead into the well, then its clip.
   - Holder into its pocket.
   - Board onto its pins, under the lips, into the clips.
   - Plug J_LED, J_BAT and the J_PT extension. Seat the extension's header in the bay slot.
   - Lid last: rear tongues first, then snap the front.
   - On R: the cartridge goes into its pocket from the back, and its lead goes into the groove and over the front
     bridge. Electronics measures the length; it ends in the bay with ≥ 10 slack.
2. **Plugs:**
   - All three headers have ≥ 12 for fingers with the lid off. None is under the battery or a lid post.
   - The battery lead loops in the JST pocket.
   - The receiver joint unplugs at the mouth with the sled in place. It is 2–16 behind L's front face, at z 26–40,
     inside the opening.
3. **Battery swap without tools:**
   - Take the balls out and unplug the mouth joint.
   - Pull R out by hooking a finger under its front bridge (open below, at s 52).
   - Lift L over the bar by its finger cup. The lid is snapped, the joint is recessed and the USB plug is out, so
     nothing catches.
   - Thumb-release the lid. Unplug the JST, which is the off switch: the holder's own switch faces down and stays ON.
   - Lift the holder out by the 32 gap. Slide the cover off on the table, swap the cells, then reverse.
4. **USB:**
   - The port centre is 10 above the bar. Electronics assumes the opening is centred on the tunnel, so e_L ≈ 4.75.
   - The port stays ≥ 3 inside the opening's edge, R10 corner included, for e_L ≤ ~25.
   - The plug's push goes into the back stop and pins; its pull goes into the front wall; up and down go into the
     edge-strip pads.
   - The antenna is ≥ 50 from the cells and ≥ 25 from the joint's pins.
   - **Open:** at e_L 4.75 the finger cup shows **15.5 of its 19** past the frame's edge (≥ 18 only if e_L ≤ 1.5).
     If the measured e_L hides more, a ribbon loop through the cup is the fallback.
5. **Service:**
   - The sockets are reached through the lid hole or with the lid off.
   - The board comes out by unplugging 3 plugs and releasing 2 lips and 2 clips. The cartridge and the emitter clip
     come out by hand.
   - The board is pinned and stopped. The holder is boxed and pressed down by the lid posts, so nothing rattles.
6. **Printability:**
   - L prints upright, R on its skin, the lid flat on its outer face, and the clips flat.
   - Overhang, bridge, seam and plate checks as in `roll_test.py`, extended to the new parts.
   - Lips, clips and the lid finger all flex in the layer plane. The posts are in compression.

## 5. Deliverables after agreement

- `sled.py`: CAD and self-check, with every new assert mutation-tested.
- 3mfs: plate 1 is R + cartridge + emitter clip, plate 2 is L, plate 3 is the lid.
- Renders: as printed, assembled, and an exploded view.
- `mechanical/SLED-ASSEMBLY.md`, the assembly guide.
- INTERFACES §4/§5 updates, then a note to presenter and video once the CAD is final.

## Update 2026-10-17 (built: `sled.py`, guide `SLED-ASSEMBLY.md`)

Built as agreed, with assembly-review's S21–S26 and N17–N19 and lead's B4 (the undo button and buzzer). These
differ from §2–§3:
- **Lid:** flush with the roof plane, as in the roll test. Recessing it 1.4 for tongues left only 9.4 over the header
  plugs.
  - At the back, two tabs hang 3 below the lid. Their 0.9 lips go into windows in the roof's front wall.
  - At the front, a 1.2 spring tab hangs ~10 behind the front wall, at 0.5 % strain. Its lip clicks into a window
    there.
  - It comes off with the tab released, the front up 5° and then forward (asserted). The lid's tab over the emitter
    has no catch.
- **Emitter:** it drops into an open-top trough under a lid tab; the roof starts at s 199 there. The flange slot holds
  it along the beam, with a glue dot on top. There's no clip, and the s 194 wall is notched for the legs (S22).
- **Undo button:** not under the bay as I first told ux (it couldn't go in there). It is a front-loaded cartridge over
  the USB-C (y −34, z 35.5), with its cap 1 behind the face. It is inside the opening for **e_L ≤ ~22**, the same
  limit as the USB-C. The embossed ↶ is at y −48.6. The cap is printed in a contrasting filament.
- **Buzzer:** on a cradle in the cavity under the bay, loaded from behind, port on a 7-hole grille. It is ≥ 15 from
  the LIS3DH and ≥ 10 from the antenna.
- **USB-C cut-out:** a flat top (a 14 bridge, ≤ 16) instead of the pointed one. The button's window sits above it.
- **Finger cup:** it has its own 45° gable ceiling (S24), and the ribbon loop is standard (N19). 13.8 of its 17.3 show
  at e_L 4.75.
- **Holder:** pocket s 112.8–181.8, with the back stop as its front wall and a lead notch (S21). The posts stop 1.5
  short and carry 3 mm foam (S26). The left corbel stops before the pocket so the holder lifts straight out.
- **Board supports:** tied low to the back stop (N18), all within the keep-out zones. The edge strips run full
  length.
- **R:** a 3.4 × 2 rebate across the front bridge for the pair (S25). The climb up the bridge face is 2.5 clear of a
  36 ball.
- **Code:** `roll_test.py` now has `l_shell()` and `shared_checks()`, which the sled calls. The roll test still
  passes; its L is geometrically identical (0 volume difference) and only the mesh order changed.

## Update 2026-10-17: e_L measured (user: "around 1–1.5 cm" → e_L ≈ 10–15)

- **Checked at both ends.** Every "inside the opening" assert now runs at e_L 10 and 15: USB-C, the undo button, the
  mouth bay, the pull cord and the buzzer grille. All pass. USB-C and the button still work up to e_L ≈ 23.
- **The finger cup is gone.** At e_L 10–15 its window showed only 8.5 to 3.5 of 17.3, and no other patch on the front
  face is free and inside the opening.
- **The pull is now a cord loop in the mouth bay.** It runs through two Ø3 holes in the bay's left wall (s 41/47,
  z 33), and its knot sits in the bay. The bay is at r 55–70, inside the opening up to e_L ≈ 50. The cord pulls on L's
  wall (forward, then up over the bar) and stays clear of the plug.
- The left lid corbel now runs from the front wall to the holder pocket, replacing the cup's walls as the support for
  the lid's front-left.
- The new asserts were mutation-tested (6 of 6 fail as they should).

## Update 2026-10-17: assembly-review's CAD review 2 (B15, S27, N20)

- **B15:** the board has one locating pin, in the hole at y_board 3.5. The hole at 26.5 keeps its Ø7 boss as a pad
  but has no pin: 3.5 from the lipped edge, a pin can't clear the roll-in under the lips. This is asserted.
- **S27:** the guide fits the board before the undo button, because the board's USB end goes in under the button's
  ring. The button loads from the front.
- **N20:**
  - The lid comes off with its front up ~5 mm (≈ 2°), about its lips' line (which slopes with the roof), then forward
    and up. This is asserted.
  - The lid has a 0.5 rebate on its top rear edge and a 0.6 gap at the rail, so its right edge clears as it tips.
- **Testing:** the new asserts are mutation-tested 9/9.
- **Gate:** 96 pass, 2 fail. The 2 fails are in the gate's own sequence (button before board, lid tipped 5° about a
  horizontal axis), and assembly-review has been asked to update it.
