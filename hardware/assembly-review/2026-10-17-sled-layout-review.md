# Sled layout review 1 (2026-10-17)

This reviews the **agreed** layout: `mechanical/reports/2026-10-17-sled-layout.md` (mechanical, with its three
counters) on top of `electronics/sled-layout-2026-10-17.md` (part placement). I checked it against
`mechanical/roll_test.py`'s shared geometry and my criteria (`2026-10-17-sled-criteria.md`).

It's a paper check. There's no CAD yet, so the gate can't sweep anything. Every value is EST (rule 11). The
coordinates are roll_test's: s inward from the frame face, y = 0 at L's left face (the channel side at −81.4), z up
from the tunnel floor.

## Checked and fine

- **USB through the frame:**
  - The port centre is at z 20, 10 above the bar. The cut-out is 14 × 8.5 at z 15.75–24.25 with a 45° pointed top,
    so the overmould's bottom (z ≈ 16.5) is 6.5 above the bar.
  - At y −26.9 the cut-out is ~22 inside the opening's left edge (e_L 4.75), well past the R10 corner.
  - With the 2.9 face recess, a ≤ 13 × 8 overmould reaches the receptacle. It clears the perfboard under the XIAO's
    1.4 overhang (16.5 vs 14.3).
  - The pull goes into the front wall, the push into the back stop, and up/down into the edge-strip pads.
- **Lifting L over the bar:**
  - L's top is 52 + 10 = 62, under the opening's 65 (bar + 55), a margin of 3 as in the roll test.
  - The mouth joint is now recessed (bay floor z 26), so nothing on L stands above its roof plane.
- **R out first:** R's front bridge, 43 + 10 = 53, also passes. Hooking a finger under R's front bridge (s 52, open
  below once the balls are out) both pulls R and lifts it over the bar, and it pulls on R's structure.
- **Mouth joint:** in the bay (y −71 to −54) it can't be hit by R's bridges in the rail's funnel, which my first draft
  feared for a clip on top. Pins toward the mouth plus a back wall give a straight push and pull along s.
- **R's lead over the front bridge:** it climbs at y −132. A 36 ball against the skin reaches only z ≈ 25 there, so
  the lead is ≥ 9 clear at z 34. It then crosses in a groove on the bridge top, not loose over the queue.
- **Header plugs:** the plug tops are at z ≈ 31. The lid's underside is 41.2 at y −50 and 41.8 at the headers, so
  there's ≥ 10 for the wire bend.
- **Sockets:** they sit at s 91.5–99.5, y −26.3 / −23.7, inside the 14 × 14 lid hole (s 89–101, y −31 to −19).
- **Antenna:** ≥ 50 from the cells.
- **Battery pocket width:** 48 for the 47 holder, 0.5 a side. ✓
- **Emitter from above:** the bay (s 183–194) is under the lid, not under L's fixed roof (the lid runs to s 194), so
  the emitter and its clip go in from above with the lid off.
- **Lid held, not resting:** rear tongues plus a front spring finger that flexes along the layers.
- **Routing:** no wire rests on the rail or the V-wall.

## Should-fix

**S21. No room for the battery leads at the holder's front end.** → electronics (placement), mechanical (pocket).
- The holder's leads leave its front short end. The 69-long pocket for s 112–180 starts at s ≈ 111.5. The drawn cross
  wall at s 109 (to 110.2) leaves **~1.3** for the lead exit and its bend.
- **Budget:**
  - The board's back stop is at s 107.5 (to 108.7 at 1.2 thick), and the emitter cross wall is fixed at 181.8 by the
    beam. That leaves **73.1**.
  - With the back stop as the battery compartment's front wall, the 69 pocket pushed back to **s 112.8–181.8** leaves
    **4.1** for the lead exit.
- **Fix:**
  - Make that the layout: the back stop is the cross wall, and the pocket runs s 112.8–181.8.
  - Add a lead notch at the pocket's front corner on the channel side, so the leads turn into the JST pocket's
    direction.
  - When the holder arrives, measure where its leads leave (end face or top) and its real length.

**S22. The emitter's legs and its clip run into L's wall at the beam.** → mechanical (wall + clip), electronics (bend).
- The shared shell (`roll_test.py:157`) has a rib wall at **s 194–195.2, y −69.4 to 0**: the roof's front-edge rib.
  It starts exactly at the emitter's back (y −69.4), and the sled keeps that shell.
- The TSAL6200 is centred on s 194:
  - Legs along s sit at **192.7 and 195.3**, so one leg lands in the wall.
  - Turned 90°, both legs are at **s 194**, inside it.
- Vishay wants **≥ 2 straight behind the case before a bend** (dimensions.md; the same rule as the cartridge), so the
  legs need ~4 behind the well. The clip "dropped behind the flange" also straddles s 194.
- **Fix:**
  - Notch that wall around the legs and the clip (≈ y −69.4 to −62, z 10–24), or move the rib to s ≥ 198.
  - Bend both legs toward −s into the bay.
  - The gate will sweep the clip down onto its seat.

**S23. The mouth joint is unkeyed and plugged by feel.** → electronics.
- The 2-pin Dupont is mated **~40–50 deep** (s 38–52), through the ~35 frame tube, in a 17-wide bay. The green mark
  can't be seen there, and the bay doesn't guide the housing, so it goes on reversed or one pin over just as easily.
- A reversed plug means a dead beam until someone works it out. It does no damage: the phototransistor is only
  reverse-biased at 3.3 V.
- **Fix, with no new part:**
  - Key it: use a **3-pin male header with pin 3 pulled**, and **plug cavity 3** of a 3-pin female housing with a
    cut pin. The plug then fits only one way, and flipped it lands its plugged cavity on pin 1.
  - Make the bay's back-wall slot fit the 3-pin header (7.6 wide).
  - Put a **pull tab** on the female (a heat-shrink flag) so one finger hooks it out.

**S24. Lifting L by the finger cup lifts the lid.** → mechanical.
- "The lid closes the cup's top." Pulling L along −s goes into the cup's back wall, as intended. But **lifting L the
  10 over the bar** means the finger pushes **up** on the cup's ceiling, which is the lid. That puts L's weight
  (holder and cells ~90 g, plus the print) on the lid's front snap: it pops, or the lid takes the strain each swap.
- **Fix:** give the cup its **own ceiling as part of L**, and cut the lid back around it. The cup is 18.3 wide, over
  the bridge limit of 16 under L's roof, so use 45° fillets in its corners or a pointed roof.
- Or a hook lip on the cup's back wall, so the finger pulls back and up on L only.

**S25. The bridge-top groove fits one wire, and the lead is a pair.** → mechanical (R).
- The groove across the front bridge is **2 × 2**. The receiver lead is **two wires, Ø1.6 EST** (`LEADS`). R's own
  U-channel stacks the pair (`CH[3] ≥ 2 × OD + 0.2`).
- **Fix:** a **2 × 3.6** groove (stacked, as in the U-channel) or 3.6 × 2. Retain the pair with a 0.1 press fit or 2
  tape strips, so it can't lift out while R slides in or bulge into the drop toward the bay.
- The section loss is small: the bridge keeps ~93 % of its bending stiffness with a 2 × 3.4 slot along its 16 × 5 span.

**S26. Rigid lid posts on the holder either rattle or stop the snap.** → mechanical.
- Two posts 23–33 tall press the holder's top (z 17.4) when the lid snaps. Print and holder tolerances (FIT0610 17 EST;
  the Keystone alternative 18.5) make that contact a gap or an interference.
  - A gap lets the holder knock inside L on every goal, and the accelerometer is in the same body.
  - An interference stops the front snap.
- **Fix:** posts ~1.5 short, with a **3 mm foam pad** on each tip. It compresses to ~1.5 and takes ±1.5.

## Nice

**N16. The JST pocket is too full, and the PH can't be gripped in it.** → electronics.
- The board-side lead is 100 from s 87 to a pocket at s 86–108: about **80 of slack**. The holder side adds ~40.
  That's two loops plus the 18 × 7.5 × 5.5 pair in 23 × 10 × 8.
- **Fix:** cut the board side to ~40 at the dry fit. In the guide, say to lift the pair out of the pocket and pull
  the housings, not the wires.

**N17. The finger gap and the holder's switch.** → electronics, mechanical.
- Clip the LED lead (y −78 to −74) to the wall in 2–3 places, so fingers lifting the holder from the gap don't snag it.
- The FIT0610's switch faces the floor and stays ON. The guide should say: "check it's ON before the holder goes in".

**N18. Board supports.** → mechanical.
- The pads and Ø7 bosses are 12.3 tall. Tie them to the walls or to each other with ribs (in the keep-out zones),
  rather than leaving them as free columns: the accelerometer is on the board.

**N19. Make the ribbon loop standard.** → mechanical.
- At e_L 4.75 the cup shows 15.5 of 19, about a fingertip, and it's narrower if e_L comes out bigger. A ribbon or
  cord loop anchored to the cup's back wall costs nothing and works for any e_L.
- Keep the cup and add the loop by default, rather than holding it as a fallback.

## Next

When `sled.py` exists:
- I'll add the sled to `check.py`:
  - L's build: emitter + clip, holder, board (lips, pins and clips, swept as for insert v3), plugs, lid
    (tongues, then the snap);
  - R's cartridge and lead;
  - R through the funnel;
  - L and R through the 130 × 55 R10 opening, including the 10 lift over the bar.
- I'll re-check S21–S26.

## Re-check log

- **2026-10-17 13:10, electronics' side:**
  - S21 (pocket s 112.8–181.8 + lead notch), S22 (legs toward −s), S23 (keyed 3-pin, 7.6 slot, pull tab), N16 (lead
    ~40, lift the pair out) and N17 (LED clips, switch ON) are **verified** ✅ in ASSEMBLY §4/§6, `dimensions.md`,
    `wiring.yml` (0.04) and `bom.md`.
  - The four stale lines in `electronics/sled-layout-2026-10-17.md` (:55, :61, :73, :104) are fixed (13:09, grep clean). ✅
  - Mechanical's parts (S21 pocket, S22 rib notch, S23 slot, S24–S26, N17 clips, N18, N19) wait for `sled.py`.

- **2026-10-17 14:35, mechanical's CAD (gate):**
  - S21, S22, S23 (slot), S25, S26, N17 and N18 are verified ✅ by the gate.
  - **S24 and N19 are superseded:** the finger cup was removed for e_L 10–15. The pull is a cord loop through the
    mouth bay's left wall, on L's structure.
  - New findings (B15, S27, N20) are in [`2026-10-17-sled-cad-review.md`](2026-10-17-sled-cad-review.md).
