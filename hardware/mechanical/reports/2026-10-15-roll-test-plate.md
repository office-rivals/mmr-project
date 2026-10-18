# Roll test: the user's plate and support-free parts (2026-10-15)

The user's screenshot is `user-plate-2026-10-15.png`.

**From the screenshot:**
- **R** lies on its skin as designed: the pod's aperture faces up and the 3 bridges stand as walls. That's OK.
- The **tall part with the blade on top looks like L half B stood on its cut face**. That is NOT OK:
  - The wiper then grows along its length, so its layers run across its bend. A PLA wiper would snap.
  - The roof becomes a side overhang.
- The middle box (L half A) looks rotated off its floor edges.

**Why the user saw support trees:** our own plate-2 orientation (L upright) had real overhangs that I missed:
- the roof over the drop zone (~4200 mm² facing down)
- the 10 mm scale flange
- 2 cross-stays bridging 81 mm
- on R, lying flat, the hollow behind the 8° lead-in (~2300 mm²)

**Fixed in `roll_test.py`, re-exported 21:02:**
- **Roof:** ribs under it every 16 mm, so it bridges ≤ 16.
- **Chamfers:** 45° under the scale flange and under the rail.
- **Stays:** full height.
- **R's lead-in:** a solid wedge (lying flat, it prints as a ramp).
- **What faces down now:** only bridges ≤ 26 mm (the pod face over its hollow, 3 mm channel ceilings) or 45° chamfers. Scanned in the model.

**Print orientation (supports OFF; in the slicer, only move or rotate about Z):**

| Part | Face down |
|---|---|
| R | the skin's outer face (the side that goes against the wall) |
| L half A, L half B | the floor edges, open top up; the wiper vertical, so its layers run along its bend |
| Wedge | flat |
| Pins and pegs | horizontal as exported (layers along their length) |

- **Files:** `out/roll_test_oneplate.3mf` has all parts on one plate, as the user wants. `plate1` (R alone) and `plate2` (L + wedge) are still there.
- **Checks:** `roll_test.py --check` OK.
