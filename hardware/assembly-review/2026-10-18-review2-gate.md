# Review 2 fixes: assembly gate notes (2026-10-18)

Lead's FYI: the review 2 fixes (`electronics-review/2026-10-18-CONSOLIDATED.md`) are starting:
- drawer contacts: gold targets in pockets, 2 pins per pole;
- J_BAT and J_OLED keyed;
- the perfboard's parts moved;
- a deeper receiver shroud.

I re-run the gate as each one posts. One defect that's already in the current model matters right now, because the
contacts are being redone anyway.

## B16 (blocker for the battery contact). The latch lets the pogo pins push the drawer off its contacts. → mechanical (latch), electronics (pin's working compression)

- **The pins push the drawer outward, so in use it rests where the latch catches, not on its hard stop.**
- **The latch's slack along s is 0.95.** The bump's 45° front flank crosses the lane wall's face at s ≈ 50.6, and the
  notch's front edge is at s 49.7. That's measured: the bump first meets L 0.95 out.
- **The pins are compressed only 0.75 at the stop**, half their 1.5 stroke. At the catch they're **0.20 short of
  touching**: zero force, and the contact gap electronics showed resets the board (> 1 ms during a Wi-Fi burst).
- **Gate:** the new `drawer held on its contacts` check fails: −0.20 at the catch, against ≥ 0.5 of working
  compression (EST until electronics names the Mill-Max part).
- My earlier latch check only asked whether the bump meets the notch somewhere within 1 mm, so it missed this.
- **Fix:**
  - Make the latch hold the drawer **at** its stop: move the notch's front edge ~0.9 forward, to where the bump's flank
    bears with the stand-offs on the back wall.
  - Give it ~0.1 of preload, so the arm stays slightly deflected and pulls the drawer onto the stop.
  - Or set the stand-offs so that compression at the catch is ≥ the pin's working minimum.
  - With 2 pins per pole the outward push doubles, which makes a zero-slack latch more important.

## What I'll check as the review 2 parts post

- **4 pogo pins:**
  - Each plunger lands inside its target pocket (≥ 1 recess) across the drawer's lateral play in the lane. The
    pocket must be at least the plunger's diameter plus 2 × play.
  - The barrels and collars stay clear of the drawer's rear face, and clear of the USB funnel and cut-out.
- **Compression:** within the chosen pin's working range, both at the stop and at the latch's catch point
  (the B16 check above).
- **Target joint pockets and lead feed-through** on the drawer's rear: the holder must still lift out of the tray on
  its lead, which today needs ~27 of the ~30.
- **Keyed J_BAT and J_OLED (3-pin):** the plug columns are re-read from `perfboard.py`, along with the moved Q2 and
  R_BD and every board part's sweep.
- **The FIT0610's switch bridged:** nothing changes for assembly.
- **The U.FL antenna spot on the dash or lid:** clear of the snap bumps, the lid tab and the lid's tilt path.

## Re-check (2026-10-18): B16 + R1.4 built

- **B16** ✅: the latch catches **0.25** out (CATCH 0.2 plus the flank's give). The pins are compressed **1.00** at the
  stop (stroke 1.5) and **0.75** at the catch, against POGO_MIN 0.65. The gate reads PIN, POGO_MIN and the target
  faces from sled.py.
- **4 pins / 2 targets, 1.0 recessed:** every plunger lands on its target. At the drawer's ±0.3 play in y and z, and
  at the catch, each one touches only its target, never the pocket's rim.
- **The pins' lead route (`lead_way`):** clear of L and the board.
- **Holder swap:** it needs ~28 of lead, and the guide gives ~30.
- **The board, 4 further back:** every board, plug and USB step still passes.
- **Full gate 135 pass, 0 fail.** §0 "assembly gate" 133 → 135.
- **N25 (watch):** at the catch the margin over the pin's working minimum is only **0.10** (0.75 against 0.65). That's
  inside FDM tolerance on the notch and stand-offs (±0.1–0.2), and PIN is still EST. When electronics names the
  Mill-Max part, re-set SO and CATCH for ≥ 0.25 margin. The contact coupon (R1.4) should be measured for exactly
  this.
- **N25, mechanical's answer:** with the EST pin, the 0.10 can't grow without cutting the 0.5 of stroke left at the
  stop. When electronics names the pin, mechanical re-sets SO and CATCH for ≥ 0.25, asserts it, and notes the coupon
  measurement in the guide.
  - **Then:** the gate's `drawer held on its contacts` threshold goes from POGO_MIN to POGO_MIN + 0.25.
- **Pin named (electronics):** Mill-Max 0973-0-15-20-77-14-11-0, with a 2.03 stroke and a hard stop. Its working
  window is **0.6–1.6** (nominal 1.0, ≈ 0.44 N per pin at 0.6).
  - The gate now checks **≥ POGO_MIN + 0.25 at the catch** and **≤ POGO_MAX − 0.25 at the stop**.
  - It's red until mechanical re-sets SO and CATCH. Target: stop compression 1.10–1.35, for example 1.2, giving 0.95
    at the catch.

## The wired battery lead (lead switched from pogo pins, 2026-10-18)

The gate's contact section was replaced. All pogo, target and PIN checks are gone.

**Passing:**
- **The lead keeps its length:** 251.6 at all 11 positions, from home to 125 out (the rolling U at half speed).
- **The lead is never pinched** at those 11 positions, by L, the board, the plugs, the dash, the lid, R, or the
  moving drawer and holder. The plug end at J_BAT and the joint in the tray are left out, since they're meant to touch.
- **Strain relief:** the zip-tie slots at s 158–161 are open either side of the lead, and the lead lies in the tab's
  groove (nothing passes through solid).
- **The drawer** goes in at e_L 10 and 15, the latch holds (pulled 1 it meets 1.9 mm³), and the hard stop works.
- **The keyed J_BAT plug** goes on.

**133 pass, 2 fail.** §0 stays at 135 until it's green.

**S40. The lead can't snake round the posts behind the holder.** → mechanical.
- Between the holder's rear end (s 113.5) and the tray's rear wall (s 119.5) there are 6.0. The two Ø2.4 posts at
  s 116.5 leave free gaps of **1.8 and 1.7**, measured by probing the drawer.
- The 2-core lead is **Ø2.8** and needs ≥ 3.2. The soldered, heat-shrunk joint (≈ Ø4) is also meant to lie there
  (guide §5.2).
- In the model the lead runs straight through a post, at s 115.3–117.3.
- **Fix:** room for the lead and joint behind the holder. Either make the space behind it ≥ ~9 (posts plus 2 × 3.2
  gaps), or put the posts in a corner bay beside the holder.
  - Or drop the posts and relieve the joint with a zip tie or glue, since the tab's groove already anchors the lead.

**S41. The holder's own lead length isn't specified any more.** → electronics (ASSEMBLY), mechanical (guide §5.2).
- To lift the holder out and slide its cover off, ~31 of its own lead is needed, from its rear end to the joint
  plus 5. The last specification was ~30, for the old targets.
- **Fix:** specify **≥ 36** from the holder's end to the joint in ASSEMBLY and SLED-ASSEMBLY, and add
  `HOLDER_LEAD = 36` to sled.py; the gate reads it.

### Re-check (2026-10-18)

- **S40** ✅: the posts are gone, and the tab's glue groove is the relief. Behind the holder there's one free gap of
  **6.0**, and the Ø4 joint needs 4.4. The check is renamed `room for lead + joint behind holder`.
- **S41** ✅: `HOLDER_LEAD = 40` is in sled.py, and electronics raised ASSEMBLY §4 and dimensions.md to ≥ 40, so the
  model and the docs agree. The lift-out needs ~31.
- **Full gate 135 pass, 0 fail**, the same count as §0 (135), so nothing changes in §0, the deck or the films.

## Round 3 (2026-10-18)

New gate steps; all of them pass:
- **The stop cord (tether):** 164.3 at every pose, and clear of the lead, L and the moving drawer (its tie at the
  tab's front is left out). At 125 out its U has **0.0** left while the lead's has **6.0** plus its bend, so the cord
  stops the drawer and the lead never takes the pull.
- **The lead at bend r 7:** its length is constant (247.2) and it's never pinched at any of the 11 positions.
- **J_BAT, now a soldered JST-PH pigtail:** its Dupont plug step is dropped, in the sled section only (the
  scoreboard's J_BAT is still a header). The mated PH pair goes **into its pocket and lifts out** past the board and
  plugs.
- **The OLED:** it drops into its slot with its unused PH socket on its back, and its 4-wire lead route from the left
  holes is clear of the dash.
- **Fuse F1:** its envelope is clear of the drawer, the holder and the lead.

**Full gate 139 pass, 0 fail.** §0 "assembly gate" 135 → 139.
- **R3-S2 (2026-10-18): the cord cut taut at 125.**
  - The stop-cord check now uses `tether_len`, `CORD_L` and `lead_slack`. The cord is 165.9 at every pose, against a
    cut length of 165.9. At 125 it's **taut** (no U), and the lead still has **33.4** of slack.
  - It's clear of the lead, L and the drawer everywhere except at the tab, where both are anchored. There the knot
    touches the lead's turn, and at the stop the taut cord bears on the tab's top edge. That's left out (the tab
    ±0.5), because nothing moves there.
  - `vol()` now returns 0 for an empty shape or intersection.
  - **Gate 139 pass, 0 fail**, the same as §0.
