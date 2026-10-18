# Goal-counter sled: part placement and wiring (electronics proposal for mechanical), 2026-10-17

> **Superseded for L's front, the battery and the board position** by the battery-drawer layout (user, DECISIONS 2026-10-18):
> mechanical's [drawer + OLED proposal](../mechanical/reports/2026-10-17-drawer-oled-proposal.md) and
> [battery-drawer-electrical-2026-10-17.md](battery-drawer-electrical-2026-10-17.md) §4–§5. Kept as the record of the 2026-10-17 layout.

Status: **AGREED with mechanical 2026-10-17**, with their 3 counters (below, and `mechanical/reports/2026-10-17-sled-layout.md` §2): the holder is pressed down by 2 lid posts (no hooks), the mouth joint sits in a bay in L's roof plane, and the pull was a finger cup in the free strip (since replaced by a cord loop in the mouth bay, mechanical 2026-10-17). Mechanical owns the CAD (lid, clips, walls, pull feature), and I own where the
electronics sit and how they're wired. Coordinates are `roll_test.py`'s: **s** inward from the frame's outer face,
**y = 0** at L's left outer face (the channel side is at y −81.4, BLK), **z** up from the tunnel floor. Every number is EST
(rule 11). The answers to assembly-review's checklist (`assembly-review/2026-10-17-sled-criteria.md`) are in §5.

## 1. Top view of L's box (s 37.2–181.8, y −80.2 to −1.2)

```
 s→  37   front wall (USB-C cut-out, button)                           109 cross wall            182  emitter bay  194
 y
 -1  ┌──────────────────────────────────────────────────────────┬──────────────────────────────┬───────────────┐
     │  free strip (18.8 wide)                                    │                              │               │
 -20 │ ┌──XIAO──┐                         sockets x 54-62 ▒      │  FIT0610 3xAA, flat,          │               │
     │ │USB│ ant│   board 70 x 30, comps UP                       │  cover up, leads out of the  │               │
     │ └───┴────┘   J_PT J_LED J_BAT (x 33-52, channel edge)      │  FRONT short end (s 112)      │               │
 -50 │ ─────────────────────────────────────────────────────────  │  (s 112-180, y -48 to -1.2)  │               │
     │ [mouth bay]  ← J_PT ext.               JST pair (pocket)  │  32-wide gap: LED lead +     │  TSAL6200 well │
 -71 │ ░░░ rail above (z 34-40), chamfer from z 25 at the wall ░░░│  fingers to lift the holder  │  (legs +y)     │
 -80 └──────────────────────────────────────────────────────────┴──────────────────────────────┴───────────────┘
                                         channel (40) → R
```

## 2. Placement

| Part | Where | Why |
|---|---|---|
| **Board** 70 × 30 | **x = 0 (USB end) at the front**, x → +s: board **s 37.5–107.5**, **y −50 to −20** (y_abs = −50 + y_board), components up. **Underside z 12.7** above the tunnel floor (bosses/pads ≈ 12.3 tall on L's floor skin) | With components up and USB at the front, the header edge (y_board 0) has to face the channel. At −50 the headers are where the lid is high enough (§3), and the USB port lands inside the opening for any e_L ≤ ~25 (§4). The z puts the port's centre **10 above the bar** |
| Board supports (unchanged keep-outs, dimensions.md B4) | one Ø2.8 pin at x 66.5, y_board 3.5 (s 104, y −46.5); the y_board 26.5 hole rests on a Ø7 boss, no pin (review B15); **rest pads only on the end rail x 0.5–4 and on the two 1.5-wide edge strips under x 4–22**; a **back stop** at the board's x = 70 edge (s 107.5); 2 lips + 2 clips as in dimensions.md | The USB plug's push goes into the back stop and pins, and its pull goes into the front wall (board edge 0.3 behind it). The rest pads take the plug's up/down force. (dimensions.md's old "rest pad under x 4–22" is fixed to the strips: the middle of that area has wires under it) |
| **USB-C** | Port centre **s 38.9 (receptacle face), y −33.9, z 20.0**. Front-wall cut-out **≥ 14 × 8.5 (y −40.9 to −26.9, z 15.75–24.25)**, straight through. Face recess 2.9 (1.2 wall + 0.3 gap + 1.4 inside the board edge) | No extension needed (it was option B in drawer-v4-concept: the board at the face, but the battery **behind** it, not stacked). A plug overmould ≤ 13 × 8 reaches the receptacle. Slim cables only; note it in the guide |
| **Antenna** (XIAO x 18–22) | s 55–59, y −43 to −25, z ≈ 15 | ≥ 50 from the cells (s ≥ 112) and ≥ 25 from the mouth joint's pins; the only nearby metal is the XIAO's own USB shell. ✓ ≥ 5 (target ≥ 10) |
| **FIT0610** 68 × 47 × 17 | Flat, cover up, **s 112.8–181.8, y −48 to −1.2** (review S21), in a 69 × 48 pocket, pressed down by **2 posts under the lid** (mechanical: hooks printed upright break at the root). Its leads leave the **front** short end (s 112) | Lift it out by hand (lid off) from the 32-wide gap on its channel side. The cover slides off **with the holder out of L** (no 50 mm slide room inside). Its switch (on the back, down) **stays ON and isn't used**; the JST is the off switch |
| **JST-PH pair** (18 × 7.5 × 5.5) | Floor pocket **≥ 22 × 9 × 7 at s 86–108, y −66 to −57**, beside the board's channel edge | Next to J_BAT, so no lead crosses the board. Reachable with the lid off, and the holder's 70–80 lead reaches it from s 112 |
| **TSAL6200** | Its well at s 194, as now (dummy s 183–205); legs out of the back (+y) into the bay s 183–194; leads through a notch in the s 181.8 cross wall, then along the channel-side wall (y −78 to −74, below the rail chamfer) to J_LED | The lead stays in the 32-wide gap beside the holder, never on the rail or the V-wall |
| **Mouth joint** (receiver) | A **bay in L's roof plane, s 37.2–52, y −71 to −54, floor z 26**, open on top and through the front wall (mechanical: a clip on top would hit the tunnel roof, ~46 EST). A **3-pin male header, pin 3 pulled** (cut from a strip, keyed: review S23) sits in a 7.6 slot in the bay's back wall, pins toward the mouth, row at z ≈ 27–28, at the end of a **J_PT extension** coming in from behind. R's sensor lead (3-pin female, cavity 3 plugged, green marked, pull tab) pushes on along +s; its wires loop up and back to R's front bridge | J_PT sits at s 71 under the lid, out of reach. The joint is ≈ 5–15 behind the frame tube's inner end (s 35), at the top of the opening: reachable by hand with the sled in place |
| **Lid** | Mechanical's design. Electronics needs **≥ 10 between the plug tops (z ≈ 31) and the lid's underside over y −50 to −44**, the mouth bay open on top, and a **≥ 14 × 14 hole over the sockets (s 89–101, y −31 to −19)** | §3 |

## 3. Heights (L's roof falls from 52 at y 0 to 37 at y −81.4; lid underside ≈ roof − 1.6)

| Item | z top | Lid underside there | Clear |
|---|---|---|---|
| Board top | 14.3 | – | – |
| Header plugs (J_PT/J_LED/J_BAT, y −46.6) | ≈ 31 (header + 16.5 housing) | ≈ 41.8 | **≈ 11** for the wire bend; ≥ 12 for fingers with the lid off ✓ |
| Sockets + standing parts (14 keep-out, y −26 to −24) | 28.3 | ≈ 45.8 | 17.5 |
| XIAO + USB-C | ≈ 21.6 | ≈ 44 | ✓ |
| FIT0610 | 17.4 | ≥ 41.5 | lid off for the swap |
| Mouth joint (bay floor z 26) | ≈ 30 + the wire loop | tunnel roof ~46 | open on top: room for the loop and fingers |

## 4. Leads (EST: cut at the dry fit; colours as in ASSEMBLY §4)

| Lead | Route | Length | Ends |
|---|---|---|---|
| **LED** | J_LED (s 80, y −46.6) → down and across to the channel-side wall → along it to s 182 → notch → emitter legs | **≈ 200** (was ≥ 240: it no longer crosses the gate) | Dupont on J_LED; soldered to the legs |
| **Sensor, R side** | Cartridge exit → R's U-channel → up over R's **front bridge** (s 52–68) to L → the mouth joint | **Measure on R: cartridge exit → the front bridge's L end, + 40 to the joint + 20 slack** (≈ 230–270; wiring.yml keeps 0.27) | keyed 3-pin female housing (cavity 3 plugged), green marked, pull tab |
| **J_PT extension (new)** | J_PT (s 72, y −46.6) → forward beside the board → through the bay's back wall | **≈ 80** | Dupont on J_PT; pins 1–2 of a keyed 3-pin male header (pin 3 pulled) in the bay's slot, heat-shrunk. Made from the **leftover plug ends of the sensor jumpers** (no new part) |
| **Battery, board side** | J_BAT (s 87, y −46.6) → down beside the board → the JST pocket | **≈ 40** (was ≥ 360; review N16) | Dupont on J_BAT; JST female |
| **Battery, holder side** | Front short end (s 112) → the JST pocket | **70–80** (unchanged) | JST male |

**Polarity:** green = collector on the sensor lead's housing, and the male header in the mouth bay gets the same green mark.
The joint is keyed (3-pin, pin 3 pulled / cavity 3 plugged, review S23), so it mates one way only; the green mark is a second check. ASSEMBLY §6's meter check confirms it.

## 5. Assembly-review's checklist

1. **Build order:**
   - The emitter and its lead go into the well first. The well is beyond the battery, so it can also go in from
     above later.
   - Then the holder clips into its pocket, then the board goes on its pins/lips/clips.
   - Plug in J_LED, J_BAT and the J_PT extension, and seat the extension's header in the mouth bay's back wall. The lid goes on last.
   - Each part has a straight drop-in path; nothing is threaded.
2. **Plugs:** all three headers have ≥ 12 for fingers with the lid off and ≈ 11 under the lid. None is under the battery.
   No wire crosses the channel: R's lead crosses on R's own front bridge. No wire rests on the rail or the V-wall.
   The battery lead is ≈ 40 + 70–80 with a short loop in the JST pocket, outside the board's under-side keep-out.
   The receiver joint is at the mouth.
3. **Battery swap by hand:**
   - Unplug the mouth joint, pull R, lift L over the bar, and take the lid off (mechanical: a visible snap/clip, not
     gravity, because L tilts).
   - Unplug the JST (that's the off switch), lift the holder out of its pocket, slide the cover off on the table, swap the cells.
   - Reverse to put it back.
   - **Pull feature (mechanical, updated 2026-10-17):** a **cord loop** through 2 Ø3 holes in the mouth bay's left wall
     (s 41/47, z 33), its knot in the bay's left side, clear of the receiver plug. It pulls on L's structure, never the
     lid or the board. The finger cup is gone, and the front-left strip (y −1.2 to −18.5) is free. The USB plug is out during the swap, and
     the joint's header sits under L's 52 envelope, so lifting L over the bar doesn't catch either.
4. **USB through the frame:**
   - The port centre is 10 above the bar (z 20, bar ≈ 10 EST).
   - Its edge is ≥ 3 inside the opening's left edge, R10 corner included, for **e_L ≤ ~25**, allowing for L's 2.5 sideways
     float. **Measured (mechanical, 2026-10-17): e_L ≈ 10–15**, so the margin is ≈ 13–18 ✓ (was assumed 4.75). The board stays put.
   - The plug's push and pull loads go to the stops and pads (§2), not to the headers.
5. **Service:**
   - The sockets are reachable through the 14 × 14 lid hole (L and R mated on the table) or with the lid off.
   - The board comes out by unplugging 3 plugs and releasing 2 lips and 2 clips.
   - The holder is fixed by its pocket and the lid posts, so it doesn't slide.
   - The board is pinned, padded and back-stopped, so it doesn't rattle (the accelerometer is on it).
6. **Printability:** this is mechanical's (bosses, pads, lid posts, the emitter clip and the mouth bay print upright, roots along the layers).

## 6. Electronics' files updated (2026-10-17)

- **dimensions.md:**
  - board placement in L;
  - the rest-pad wording fixed to the strips, plus the back stop;
  - the USB-C height and cut-out (no extension for the goal counter);
  - the FIT0610 swap (holder lifts out, switch unused);
  - the JST pocket position;
  - the mouth joint clip.
- **wiring.yml:** the lengths (LED 0.20, battery 0.04) and the new J_PT extension (0.08) + mouth joint X_MJ.
- **ASSEMBLY §4:** the lead table + the J_PT extension step.
- **bom.md:** 3-pin housings added (S23). The male header comes from the strip already in the cart, and the extension reuses the
  sensor jumpers' leftover ends.
- **Beam-health parts:** no change outside the board. D2/D6/D9/D10, C_RX and the two-row sockets are all on the 70 × 30 board.
  The MTCK wire stays under the XIAO.

## 7. Assembly-review fixes (assembly-review/2026-10-17-sled-layout-review.md), applied 2026-10-17

| Item | Fix | Files |
|---|---|---|
| S21 holder lead exit | Pocket s 112.8–181.8: the board's back stop is its front wall, giving 4.1 for the lead exit. A lead notch at the pocket's front corner on the channel side. Measure the real lead exit on arrival | dimensions.md, ASSEMBLY §4 step 4 |
| S22 emitter legs | Bend 90° **toward −s**, ≥ 2 behind the flange, cut 6 past the bend, lap joints. Mechanical notches the s 194 rib | ASSEMBLY §4 step 2, dimensions.md, wiring.yml |
| S23 mouth joint keying | **3-pin male header with pin 3 pulled** in a **7.6 slot**; the sensor's **3-pin housing with cavity 3 plugged** (a cut pin + superglue) and a heat-shrink **pull tab**. A flipped plug lands its plugged cavity on pin 1 | ASSEMBLY §4 step 3, wiring.yml, bom.md (3-pin housings) |
| N16 JST pocket | Board-side battery lead ≈ 40. To unplug: lift the pair out, then pull the housings | ASSEMBLY §4 step 4, wiring.yml, bom.md |
| N17 finger gap + switch | The LED lead goes in 2–3 clips on the channel-side wall (mechanical prints them). "Check the holder's switch is ON before it goes in" | ASSEMBLY §4 steps 4–5 |
