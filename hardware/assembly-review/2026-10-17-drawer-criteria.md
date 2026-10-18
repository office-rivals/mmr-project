# Battery drawer + 0.96" OLED: review criteria and the front-face budget (2026-10-17)

These are the criteria for mechanical's proposal (DECISIONS 2026-10-17: swap the cells with the sled in place, and
add a 0.96" OLED on L's front). I'm sending them before the proposal, together with the space budget from the
current `sled.py`. All values are EST (rule 11), and the coordinates are sled.py's:
- **r** = −y from L's left face;
- **z** from the tunnel floor;
- **s** inward from the frame's outer face.

## 1. What the opening leaves of L's front face (e_L 15, the worst end; 3 margin)

- **Sideways (r):** **18 to 80**. L's face ends at 81.4; left of r 18 is behind the frame.
- **Height (z):** from **13** (the bar is at 10) up to the lid's underside, which falls with the roof:
  - r 18: 48.7 roof, so ~47 under the lid, **~34 tall**;
  - r 45: ~42, **~29 tall**;
  - r 70: ~37.5, **~24 tall**.
- **The R10 corner** at the bottom left (centre r 25, z 20 at e_L 15) also takes the corner below z 20, left of
  r 25.
- **The drawer's whole cross-section has to pass through this window.** Its floor must sit on or above the bar
  (z ≥ 10.5), so it slides straight out without lifting.
- **The OLED only needs its active area (21.7 × 10.9) inside the window.** The rest of the 27.3 × 27.8 module can sit
  behind the frame, below the bar or left of r 15.

**The squeeze.** A FIT0610 drawer face is ~50 × 20: 47 × 17 plus walls and a rail. The OLED module is 27.8 tall.
- **Stacked:** 20 + 27.8 = 48, but the face is ≤ 34 tall anywhere.
- **Side by side:** 50 plus the active area's ~24 (window plus a margin) is 74, but only **62** is usable.
- **Before the drawer even fits,** the USB-C (r 27–41, z 16–24), the buzzer grille (r 56–69, z 11–23) and the
  receiver bay (r 55–70, z ≥ 26) all sit in the band it needs.

As drawn, then, the 47-wide flat holder and an upright OLED don't both fit on the face. Possible ways out (the choice
is the owners'):
- **(a) A narrower pack.** 3 × AAA flat is ~35 × 12, but has ~40 % of the capacity, so about half the months. A 2-over-1
  AA stack is ~32 × 30, but too tall right of r ~45.
- **(b) Li-ion charged in place over the USB-C** (electronics is costing it). There is no drawer at all, and the face
  keeps its current layout plus the OLED.
- **(c) The OLED's module mostly behind the frame or the bar,** with only the active area at the window's left or
  bottom edge (outside the R10 corner). Its active area would still overlap the drawer's band, so this only works if
  the drawer is ≤ ~38 wide.
- **(d) The OLED off the face:** on L's top at the front, tilted up toward the viewer. Check that it's visible
  through the 35-deep tube.

## 2. What I'll check (the gate sweeps it once it's CAD)

**Drawer path:**
- It comes straight out along −s through the frame tube and clears the bar.
- It comes far enough out for the holder's cover to slide off. The FIT0610's cover slides along its 68 length, so
  the holder must be fully outside the frame (s < 0), which means the drawer travels ≥ ~105.
- Or the cover comes off another way, or the drawer separates from L.

**Latch:**
- It holds the drawer against play (goal hits, table bumps), with no reliance on friction.
- It's released by feel, ~36 deep, with one finger, and it clicks when the drawer is home.
- There is nothing to align by eye.

**Insertion by feel:**
- Lead-ins on the rails.
- The drawer is keyed, so it can't go in upside down or rotated (the cells' polarity in the holder).
- It stops at a hard end stop, with its front flush with L's face.

**Lead or contacts (electronics):**
- A slack loop of ≥ ~110 must have its own chamber. Pushing the drawer back in by feel must not fold it into the
  board, the plugs, the JST pair or the drawer's rails. The gate will sweep the loop as a tube at full and short
  travel.
- Contacts that mate on insertion need a positive stop and keying, and must stay mated under the latch.
- What happens if the drawer is pulled while the counter is running: reverse polarity and brown-out (firmware).

**Balls:**
- The drawer's path and its open position stay out of the channel (r > 81.4) and the frame tube's lower right
  corner, where the queue rests (first ball front at s 33).
- A ball at the mouth must not be in the way of pulling the drawer, and the drawer must not push one.

**Everything else on the face** stays reachable or visible at e_L 10 and 15:
- the USB-C, with its 13 × 8 overmould;
- the undo button and its arrow;
- the buzzer grille;
- the receiver bay, with the fingertip and keyed plug;
- the pull cord (still needed for service).

**The board's new place:** if it moves, the gate re-checks its insertion (one pin, lips, back stop, overhangs) and
the 14 clear over the calibration sockets.

**Printability:** the drawer's rails, latch and cell box print supports-off, using mechanical's own checks.
