# Assembly review: hardware into the printed parts

Reviewer: `assembly-review`, 2026-10-14. Models: `mechanical/insert.py` (22:22) and `mechanical/scoreboard.py`
(22:54; its own `self_check()` currently fails with *"retainer frame collides with the shell"*, so mechanical is
mid-edit). Guides: `mechanical/print-and-install.md`, `ASSEMBLY.md` (22:55), `electronics/dimensions.md`,
`electronics/perfboard.py`.

**The gate (run before every hand-back):**

```sh
cd hardware/mechanical && uv run python ../assembly-review/check.py              # both devices, ~10 s
cd hardware/mechanical && uv run python ../assembly-review/check.py insert       # or scoreboard
```

It prints PASS/FAIL per step and exits 1 on any FAIL. Each part is moved, in guide order, along a real path from
outside to its final place. At every pose the part must stay clear of the shell and of the parts already fitted.
Snap clips and crush bumps are the only "flex zones" allowed to give way.

The main board is rebuilt from `electronics/perfboard.py` (XIAO, LIS3DH, C1, standing resistors, sockets, headers,
Dupont plugs, a 3 mm joint layer underneath), so a layout change is gated too. The script also checks that each
model places the board as a rotation, not a mirror. A renamed model parameter shows up as a FAIL ("model
contract"), and I update the script.

Round-1 images in `out/` came from the earlier probe scripts. Those were replaced by `check.py` and are kept as the
evidence for the findings below.

Assumed real-part sizes (not in the models): Dupont jumper OD 1.4 mm; soldered splice under heat-shrink Ø2.4;
Dupont female housing 14 mm, plus 2.5 mm header spacer, plus ~5 mm for the wire bend; standard male header with
a 6.1 mm long side; PETG strain for a repeated snap ≤ 2–3 %.

**Summary: 7 blockers, 10 should-fix, 6 nice.** Neither device can be assembled as drawn:
- **Insert:** the battery can't be swapped, the LED lead is too short, the beam-element splices don't fit their
  wells, and the perfboard sits on its own solder joints.
- **Scoreboard:** the key strip and the e-paper adapter have no way in, and one board clip is fused to a key rib.

Most fixes are a parameter or a single feature.

---

## 1. Goal insert: the physical sequence

| # | Step | Status |
|---|---|---|
| 1 | Print the body, the lid and the hatch. Clear the beam wells and the Ø3 apertures | OK |
| 2 | Bench-build the perfboard. Trim header pins and leads underneath | ✗ **B4**: the guide says "long pins down" and never says to trim them |
| 3 | Make the leads: LED and sensor legs cut to 10 mm and spliced to half-jumpers (~95 mm); holder leads 120 mm spliced to a half-jumper | ✗ **B2**: the LED lead is 79 mm short |
| 4 | Lower the emitter into the right well and the receiver into the left: leads bent up, flange on its shoulder | ✗ **B3**: the splices sit inside the 1.4 mm lead slot |
| 5 | Board into the bay: tilt it, slide the outer edge under the 2 lips, drop the far holes over the pins, press until the 2 clips click | ✗ **B4/S1/S2**: the board lands on joints and wires; 0.1 mm lip gap; clip strain 5.5 % |
| 6 | Holder: switch ON, ribbon looped under it, stood in the slot with the leads at the downstream end | ✗ **B1**: no path for the leads out of the slot (0.65 mm end gap) |
| 7 | Leads into the grooves: emitter and battery across the gate roof, receiver straight into the bay; plug onto J_PT, J_LED and J_BAT | ✗ **S4**: 6 wires in a 4 × 3 groove stand 1.2 mm proud |
| 8 | Calibrate with the lid off, then hot-glue the flanges | OK (the glue goes in blind, 35 mm down, see N2) |
| 9 | Lid on (lip, no ribs), hatch on (crush ribs) | ✗ **B1**: the hatch sits on the battery leads. **S3**: nothing holds the lid |
| 10 | Tape it into the drawer, then the duct-tape strap over the last 22 mm | OK |
| 11 | **Battery swap:** hatch off, pull the holder up ≥ 58 mm by its ribbon, open its cover | ✗ **B1**: only +23 mm of lead slack, and the leads are taped into grooves and under the strap |
| 12 | **Board out:** strap off, lid off, unplug, release the clips | ✗ **S7**: the clip at board x = 60 has 1.2 mm to the V-wall, so no tool fits |

## 2. Scoreboard: the physical sequence

| # | Step | Status |
|---|---|---|
| 1 | Bench: main board, key strip, ZIF FPC into the DESPI-C02 (ASSEMBLY S4), jumpers | ✗ **B6**: plugging the ZIF here makes step 6 impossible |
| 2 | Caps into the guides from inside, flange last | OK |
| 3 | Key strip into the gap between the plungers and the ribs | ✗ **B5**: 0.00 mm of clearance, no insertion path, and the ribs cross the bus wires |
| 4 | Glass into its recess, FPC edge up | OK |
| 5 | Frame pressed onto the 4 pins | ⚠ N4: zero-clearance pins, so the frame can't come off again |
| 6 | Adapter slid into the C-rails | ✗ **B6**: a 41 mm sideways slide with the FPC attached; the bottom rail lip covers the header edge |
| 7 | 8 jumpers from the adapter to J_EPD | ✗ **B6/S8**: straight plugs reach the battery top; 8 × 20 cm of jumper to stuff |
| 8 | Main board: back edge under the lips, holes over the pins, press the front edge until the clips click | ✗ **B7**: the right clip is fused to the K3 rib. **B4**: the rest pad is under the XIAO joints |
| 9 | Holder into its 6 mm fence (ON, ribbon), cover on | ✗ **S6**: the holder can lean and rattle; the fence may pinch the leads |
| 10 | **Battery swap:** cover off, lift the holder 6.5 mm out of the fence, take it out the back | OK (56 mm needed, 93 mm available) |
| 11 | USB through the left wall, reachable with the cover on | OK |

---

## 3. Findings

### Blockers

**B1. Insert: the battery can't be swapped, and the hatch sits on the battery leads.** *(mechanical + electronics)*
- **Evidence:**
  - **Lead exit:** the slot is 69.3 long for a 68 mm FIT0610, which leaves 0.65 mm at each end for Ø1.4 leads.
    There is no vertical channel; the lead groove exists only at the top (`bat_gu/bat_gy`).
  - **Hatch:** the groove floor and the hatch rebate floor are both at z = 52.0, so a lead under the hatch
    overlaps it by 52 mm³ (`out/insert_sec_hatch_groove.png`).
  - **Swap:** the holder has to rise ≥ 58 mm and then open its cover. Route length vs built lead is +23 mm, and
    the leads are taped into grooves and under the strap.
- **Fix:**
  - mechanical: a 4 × 4 vertical lead channel at the slot's downstream end. Run the groove ≥ 2 mm below the hatch
    rebate floor wherever the hatch covers it.
  - electronics + mechanical: a **polarised 2-pin disconnect parked in a pocket under the hatch**, so the holder
    lifts out and unplugs (a 2-pin Dupont housing or a JST-PH). Electronics picks the connector for contact
    reliability.
  - Alternative: a ~100 mm slack loop in the bay, with a groove deep enough that the strap never touches the
    leads. It's worse: pushing 100 mm of lead back through a 150 mm groove bunches it up.

**B2. Insert: the LED lead is about 79 mm too short.** *(electronics)*
- **Evidence** (probe [3]): Manhattan routes along the grooves and wells to each header.

  | Lead | Route | Built (ASSEMBLY §4) | Slack |
  |---|---|---|---|
  | Receiver | ≈ 101 mm | 10 + ~95 = 105 mm | +4 |
  | **Emitter** | ≈ 184 mm | 10 + ~95 = 105 mm | **−79** |
  | Battery | ≈ 192 mm | 215 mm | +23 (before B1) |

  The emitter route goes up 38 mm, across the right region, the 40 mm gate and the receiver block, then down into
  the bay and along to J_LED.
- **Fix (ASSEMBLY §4):** use a whole 20 cm jumper for the LED (cut one plug off), and give minimum lengths:
  receiver ≥ 130 mm, LED ≥ 210 mm (≥ 25 mm slack each).

**B3. Insert: the beam-element splices don't fit their wells.** *(mechanical)*
- **Evidence:** the lead slot behind each flange is **1.4 mm** wide in y (`beam_well`).
  - Legs cut to 10 mm and bent up put the splices at z ≈ 25, inside that slot (`out/insert_sec_z30_wells.png`,
    red circles = Ø2.4 splices).
  - Uncut legs (~25 mm) still don't reach the top at z = 55.
- **Fix:** widen the lead slot to ≥ 3.5 mm (y) × 5 mm (u) from z ≈ BEAM_Z + 3 up to the top, keeping the narrow
  part as the flange's back shoulder. Add a `LEAD_SLOT_W` parameter.

**B4. Insert and scoreboard: the perfboard sits on its own solder joints and wires.** *(mechanical + electronics)*
- **Evidence** (probe [6], `out/insert_board_supports.png`, hole and wire data taken from `perfboard.py`):
  - The **rest pad** (board x 4–22, y 3–27) is under **20 joints** (all 14 XIAO pins, R1, R2, C2) and **11 nets**
    of underside wire, including the BAT± wires.
  - The **bosses at x = 28.5** sit on wires: VPACK and BEAM_RX at y = 3.5, GND, ROLE and R_STRAP at y = 26.5.
  - **Header pins:** ASSEMBLY 3.2/3.5 say "long pins down", which leaves 6.1 − 1.6 = **4.5 mm below the board**,
    against bosses 4.0 mm tall.
  - **Result:** the board can't seat, the lips and clips don't engage, and the LIS3DH rocks.
  - The scoreboard cradle uses the same rest pad (`gx(4)..gx(22)`) and the same bosses.
- **Fix:**
  - mechanical (both models): replace the rest pad with an **end rail at board x 0.5–4.0**; column 0 is at
    x = 5.8, so that strip has no joints. Drop the x = 28.5 bosses, or move them to a wire-free spot that
    electronics marks.
  - electronics: in ASSEMBLY 3.1, 3.2 and 3.5, *"trim every pin and lead flush, ≤ 2 mm under the board"*. In
    `perfboard.py`, draw the support footprints as keep-outs and keep the underside wires off them.

**B5. Scoreboard: the key strip can't be installed.** *(mechanical)*
- **Evidence** (probe [1], `out/scoreboard_sec_keys.png`):
  - **Clearance:** from the plunger tip (w = −8.50) to the rib face (w = −17.40) is 8.90 mm, exactly switch 7.3 +
    strip 1.6, so **0.00 mm**. Any solder joint or wire on the back makes it negative.
  - **No way in:** the ribs are fused to the shell, so the strip can't come in along w. Sliding it in along u or v
    drags the actuators across plungers whose caps can't move outward (the flange stops them).
  - **Bus wires:** the ribs span strip v 1–19, and the underside KEYS bus (v = 17) and GND bus (v = 2.5) cross
    them (`keystrip.png`).
- **Fix:** make the ribs a **separate printed backer bar**:
  1. Press the strip straight onto the plungers, located by 2 pins on the end guide sleeves into 2 holes drilled
     in the strip's free ends (90 mm strip, switches use ~73 mm).
  2. Press the backer bar in behind it, held by 2 snap hooks or slots in the side walls.
  3. Notch the rib tips 2 mm where the buses cross, and give them a 0.2 mm crush bump so the keys have no
     pre-travel.

**B6. Scoreboard: the e-paper adapter has no assembly order that works.** *(mechanical; electronics to confirm the header)*
- **Evidence** (probe [2], [3], `out/scoreboard_sec_adapter.png`):
  - **Rails vs the FPC:** the C-rails take the 41 mm board only by a ≥ 41 mm slide along u. The FPC tail
    (12.5 × 18.5 mm) is fixed to the glass and can't bend in-plane. Plugging the ZIF first (ASSEMBLY S4, and
    print-and-install 5 → 6) makes the slide impossible. Plugging it after the slide means working the ZIF latch
    blind, behind the glass.
  - **Bottom rail lip:** it runs the full length at the header edge, and `adapter ∩ frame` = 46 mm³.
  - **Plugs:** with a straight header pointing into the box, the 8 Dupont plugs (≈ 22 mm) reach the battery top
    (34 mm³). `ADAPTER_ENV` = 12 doesn't include the plugs.
- **Fix:**
  - **Drop-in cradle:** the adapter goes on along w (toward the frame) into an open pocket with 2 small snap hooks
    on its long edges. Order: plug the FPC into the ZIF with the adapter held in hand, then press the adapter into
    its pocket (the FPC flexes out of plane).
  - Keep the header edge free of rails.
  - Electronics confirms the DESPI-C02 header orientation. If it's straight, use right-angle plugs, or put the
    adapter ≥ 25 mm clear of the battery top.

**B7. Scoreboard: the right main-board clip is fused to the K3 key rib.** *(mechanical)*
- **Evidence:** the clip at `MB_CLIP_X` = 63 spans x 62.7–68.7, with its beam at y 40.7–42.3. The K3 rib spans
  x 63.2–65.2 and ends at y = 40.5. That 0.2 mm gap fuses when printed, and probe points 0.3 mm in front of the
  beam are solid at x = 63.2 and 64.7. The clip can't flex, so the board can't snap in, or the clip breaks.
- **Fix:** `MB_CLIP_X` = (25, 67), or stop the ribs at y < `mb_yf` − 4. Add a self-check probe: the swept volume
  of each clip's 1.2 mm deflection must not hit `body`.

### Should-fix

**S1. Snap clips are over-strained and break across the layer lines (both devices).**
- **Evidence:** the beam is 1.6 thick with a ≈ 6.6 mm free length, and needs ≈ 1.0 mm of deflection (0.8 hook +
  0.2) → strain ≈ **5.5 %** (ε = 1.5·t·δ/L²). PETG manages ≲ 2–3 % repeatedly.
- **Layers:** the insert is printed upright, so the root is in tension across the layers. The board is clipped at
  least twice: the bench fit, then the final fit.
- **Fix:** free length ≥ 10 mm (start the beam in a pocket in the bay floor, or on a raised pad with a slot
  around it), t = 1.2, hook 0.6 → ε ≈ 1.5 %. Add an r 0.5 root fillet.

**S2. The board isn't preloaded; it rattles or doesn't fit (both devices).**
- **Evidence:** the lip and hook undersides are at board top **+0.1 mm** (`out/insert_sec_lip.png`). That's
  below one 0.2 mm layer, and perfboard is 1.6 ± 0.1. `print-vs-buy.md` claims *"preload 0.2 mm"*, but the model
  has +0.1 of play.
- **Fix:** lip undersides at +0.3, each with a 0.4 mm crush bump (the `RIB` idea), so the board is clamped
  whatever its real thickness. The accelerometer needs this.

**S3. Insert: nothing holds the left lid.**
- **Evidence:** the lid lip has 0.2 mm clearance per side and no ribs. The strap covers only y 152–174 of the
  lid's 74–174, so the upstream 78 mm can lift and buzz.
- **Fix:** crush ribs on the lid lip, as on the hatch.

**S4. Insert: the groove overflows over the receiver block.**
- **Evidence:** emitter 2 + battery 2 + receiver 2 = 6 wires of Ø1.4 in the 4 × 3 groove stack 3 high, 4.2 mm
  → 1.2 mm proud under the lid and strap, more at a splice.
- **Fix:** 6 × 4 mm wherever more than 4 wires share the groove.

**S5. Insert: the battery slot is sized for the part we don't buy.**
- **Evidence:** `BAT` = Keystone 2487 (18.5 × 68.5 × 48). The guide and BOM use the FIT0610 (17 × 68 × 47), so
  it has 2.3 / 1.3 / 2.0 mm of play and rattles under table knocks.
- **Fix:** size the slot for the FIT0610 with 2 crush ribs per long side and a 2 mm foam pad under the hatch. The
  2487 then needs ribs scraped, or its own parameter set.

**S6. Scoreboard: the holder is free to lean, and its leads may be pinched.**
- **Evidence:**
  - Only a 6 mm fence locates it, with 0.5 mm clearance. Its top is free: about 9° of lean, and 4.5 mm to the
    cover plate.
  - The fence is a closed ring, so leads leaving low on a short end get pinched.
  - There is 3 mm to the right wall.
- **Fix:**
  - A rib on the inside of the cover that touches the holder's top-back edge.
  - A 5 mm lead notch in the fence at the left end, toward J_BAT.
  - State in the guide which end the leads go (left).

**S7. Insert: the clip at board x = 60 can't be released.**
- **Evidence:** 1.2 mm from the clip's outer face to the V-wall, 45 mm down. Removing the board means breaking it.
- **Fix:** a release tab rising to ~10 mm below the lid on each clip, or move the clips to where the bay is wider.
  The S1 rework is the time to do it.

**S8. Scoreboard: 8 × 20 cm of jumper to stuff inside.**
- **Evidence:** the adapter-to-J_EPD route is ≈ 60 mm, which leaves about 1.1 m of slack to fold behind the cover
  lip, under the board and against the battery.
- **Fix (electronics, BOM S10):** 10 cm F–F jumpers.

**S9. Doc order conflict (scoreboard).**
- ASSEMBLY S4 plugs the FPC into the ZIF on the bench, then print-and-install 5–6 plugs it after the frame. Fix
  both once B6 is settled.

**S10. Scoreboard self-check fails right now** ("retainer frame collides with the shell"). For mechanical, just
so it isn't missed.

### Nice

- **N1.** The insert's USB port is 4.6 mm inside the face through a 13 × 8 opening, with 40 mm to the end wall.
  Recommend a right-angle USB-C cable, or say "overmould ≤ 12.5 × 7.5".
- **N2.** The hot glue goes blind into the flange slot 35 mm down. Suggest a glue-gun needle tip, or a drop of
  CA through the aperture side.
- **N3.** The glass has 0.2 mm of play under the frame and can buzz on table knocks. A 0.5 mm foam strip on the
  frame border fixes it.
- **N4.** The frame pins are Ø2.6 in Ø2.6 holes and printed vertical (face down): a one-way press fit. Use
  Ø2.8 holes with 3 crush ribs if the panel ever needs re-seating.
- **N5.** Doc drift:
  - ASSEMBLY tools list says "3.2 mm bit for the **4** mounting holes"; there are 2.
  - INTERFACES §4 still says "60×30 perfboard, 4×M3 on 53×23".
  - `dimensions.md` names the Keystone 2487 as *the* holder.
  - mechanical README says "Five ribs" (the model has 4).
  - `insert.py` still has the comment "under a magnet hatch".
- **N6.** The calibration sockets are reached through a 12 × 12 hole, 31 mm deep: long-nose pliers or tweezers
  needed. Fine, but say so in ASSEMBLY §6.

### Checked and OK

- **Printability:** at 55° there are no unsupported faces except the expected ones: the 40 mm gate-roof bridge,
  the Ø3 apertures, ~1 mm lip overhangs, and the frame's 1 mm rail lips. The scoreboard cradle prints at ≤ 50°
  face-down.
- **Insert, other checks:**
  - 15 mm of Dupont headroom: 46 mm available.
  - The Dupont plugs on the header row clear the V-wall.
  - The calibration hole lines up over the socket.
  - The hatch stays out of the strap band and the ramps.
  - The tape bases are flat.
- **Scoreboard battery swap:** the lift path is clear (needs 56, has 93), and USB is reachable with the cover on.

---

## Re-check log

### Electronics, round 1 (2026-10-14)

| Item | Status |
|---|---|
| B2 lead lengths | ✅ The LED uses a whole 30 cm jumper (≥ 210 mm against a ≈ 184 mm route). The sensor gets a ½-jumper of ~150 mm (≥ 130 mm against ≈ 101 mm) |
| B1 battery disconnect | ✅ Connector: JST-PH 2-pin cable-to-cable. Holder side ≥ 80 mm; to verify against mechanical's pocket |
| B4 trim | ✅ ASSEMBLY 3.1, 3.2 and 3.5 now say "trim ≤ 2 mm" |
| B4 support zones | ✅ Central spots dropped. Supports are now only the end rail (x 0.5–4), the 1.5 mm long-edge strips and the 2 pin bosses, all without joints or wires (verified against `perfboard.py`) |
| B6 adapter wiring | ✅ Wires are soldered straight onto the cut-down header, so no plugs stick into the box. The FPC is plugged in by hand first (S4) |
| S8 | ✅ ~10 cm display leads |
| N5 / N6 | ✅ Fixed: "2 holes"; the FIT0610 is the primary holder; tweezers mentioned. INTERFACES §4 is lead's |

### Mechanical, insert v3 (2026-10-14)

`insert.py --check` passes. `probe_insert.py` has been updated for v3 and re-run.

| Item | Status |
|---|---|
| B1 battery | ✅ 4 × 4 lead channel from the slot floor; JST-PH pocket 26 × 9 × 9 under the hatch; battery groove floor at 49.5, 2.5 below the rebate. A lead under the hatch now overlaps it by 0 mm³ |
| B3 lead slot | ✅ 3.6 (y) × 5 (u) from BEAM_Z + 3 up; a Ø2.4 splice fits |
| B4 supports | ✅ End rail, edge ledges under the lips and clips, 2 pin bosses: 0 joints or wires on any of them. BOSS_H 6 |
| S1 clip strain | ✅ t 1.2, L 10.3, hook 0.6 → 1.4 %. **New:** each beam is rooted on a **0.6 mm floor skin** (pocket floor z = 0.6), which the root moment (~40 N·mm) cracks or peels → raise the pocket floor to ≈ 1.5 (L 9.4, ε ≈ 1.6 %) |
| S2 preload | ⚠ Lip and hook undersides at +0.3 with crush bumps, but the bump bottom is at board top − 0.1, so **0.1 mm nominal** interference, which is zero with a −0.1 board → make it ~0.25 |
| S3 lid | ✅ Crush ribs on the lid lip |
| S4 groove | ✅ 6 × 4: 6 wires lie 2 high (2.8 mm) |
| S5 slot | ✅ Sized for the FIT0610 (0.8 / 0.8 / 1.0 play) with 4 crush ribs (0.15 interference) |
| S7 release | ❌ **x = 57 clip:** 1.6 mm from the beam to the V-wall at every height (`out/insert_v3_sec_clip57.png`). With the load at the tab top (z 45), the hook moves ~0.075 × the tab, so a 0.8 mm release needs ~11 mm of tab travel. x = 24 has 13.6 mm and is OK. Fix: a 45° hook underside on the x = 57 clip (a lift-off detent, ~7 N) or move it |
| B2 lead routes with the new ASSEMBLY §4 lengths | ✅ RX +56, LED +118 mm slack |
| Docs | ⚠ print-and-install §4 still says "push the 2 clips outward"; §5–6 don't describe the JST pocket and channel |

Side effects checked: STRAP_W is now 19 (= the tape width) and BALL_STORE 38 (3 mm spare for the 35 mm ball). The
beam is 9.5 mm inside the downstream face, so a ball at the end wall clears it by ~12.5 mm. The USB gap is now 38 mm
(N1 still applies).

### Mechanical, insert v4 + scoreboard v2 (2026-10-14)

Both self-checks pass.

| Item | Status |
|---|---|
| Insert S7 | ✅ The x = 57 clip is a detent: 45° underside through the board's top corner, 0.1 preload, pops off when you lift the header edge. x = 24 keeps its tab (13.6 mm of travel) |
| Insert clip root | ✅ `CLIP_ROOT` 1.5 (free 9.4, 1.63 %, asserted) |
| Insert S2 | ✅ Bumps at board top − 0.25 |
| Insert docs | ✅ print-and-install §3–6 rewritten (splices, trim, detent removal, JST pocket and channel, swap order) |
| Scoreboard B5 | ✅ No fused ribs. The strip slides 2 mm onto 2 end-post pins; a separate backer bar is heat-staked on 2 outboard posts, with crush pads clear of the pins and bus wires. Insertion paths for the strip and the bar are asserted |
| Scoreboard B6 | ✅ No rails. The adapter drops onto 2 taped pads + 2 locators after the ZIF is plugged in by hand; the header edge is free; the wire bundle is checked |
| Scoreboard B7 | ✅ The ribs are gone, and the clip sweeps are asserted |
| Scoreboard B4/S1/S2/S6/N4 | ✅ As on the insert. Cover rib, fence lead notch, frame holes 2.75 |
| Scoreboard J_EPD plugs | ✅ A 22 mm plug column on the front edge is clear of the shell, backer, strip, battery, adapter and wires |

**New blockers**

**B8. Both devices: the board can't reach its final position.** *(mechanical)*
- **Evidence:** the locating pin on the **lip side** is 3.5 mm from the edge that goes under the lips.
  - Insert: pin at board y = 26.5; lips on the y = 30 edge.
  - Scoreboard: pin at y = 3.5; lips on the y = 0 edge.
- **Why it can't go in:**
  - **The last 1.0 mm:** the edge has to slide the last 1.0 mm under the lips with its bottom ≤ 0.3 above the
    ledge. Meanwhile the pin (1.2 tall, hole play 0.2 radial) is still under solid board, 1.1–1.9 mm from the
    edge.
  - **Rolling the board:** clearing the pin needs ~40° of roll, and the 0.2 mm wall gap limits the roll to ~7°.
  - **Pitching the far end up:** this clears the pin at x = 66.5 only if the board's bottom drops ~2 mm below
    the ledge under the other lip.
  - So "slide under the lips, then drop the holes over the pins" is impossible in any order without bending the
    populated board about 2 mm.
- **Fix:** delete the lip-side pin and keep the clip-side one (insert y = 3.5, scoreboard y = 26.5); the boss stays
  as a support. One pin 26.5 mm from the roll axis drops in during the roll-down: the hole reaches pin height at
  ~2.6°, and both hole walls clear. Electronics can keep drilling both holes.

**B9. Scoreboard: the J_KEY/J_BAT plugs sit under the battery shelf.** *(mechanical)*
- **Evidence:** headroom is 14.5 mm (shelf underside z 25.1, board top 10.6). A Dupont plug needs ~22 mm (spacer
  2.5 + housing 14 + wire bend); electronics' own spec says ≥ 15. The plug column hits the shelf and fence by
  133 mm³ and the holder by 239 mm³.
- **Fix:** shelf at `mb_top` + 23. The holder's lift then tops out at ~89 against a 96.5 ceiling. Add a Dupont
  column to the scoreboard self-check, as on the insert.

Nice:
- **N7.** The heat-staked backer makes opening the key stack destructive: the stakes must be cut, and the bar is
  then re-fixed with 2 M2 self-tappers. Fine for a part that's rarely serviced; say so in the guide.

### Mechanical, B8 + B9 round (2026-10-14)

| Item | Status |
|---|---|
| B8 | ✅ Both models: one locating pin, on the clip side (insert y = 3.5, scoreboard y = 26.5); the lip-side bosses stay as plain supports |
| B9 | ⚠ The plug column is asserted. The model assumes J_KEY/J_BAT move to board x 4–28 (beside the battery, not under it), so the shelf stays at 14.5 mm headroom. This depends on electronics: row 0 there has only cols 6–8 free (R2/C2/R1 take 0–5), so 4 pins need row 1 or moved parts |
| B10 (new) | ❌ See below |

**B10. Scoreboard: no install path for the main board under the battery shelf.** *(mechanical)*
- **Layout:** the lips (x 38 and 60) are on the back edge, under the shelf (underside z 25.1, 14.5 above the board
  top), and the board's back 16.5 mm lies under the shelf.
- **Why it can't go in:**
  - **From the front:** the board has to slide back under the shelf with C1 (13 tall, 13.6 mm from the back
    edge) no more than 1.5 mm above its final height. Meanwhile the board spans the front clips, so it has to ride
    over them.
  - **Roll to clear the clip tabs** (top at `mb_top` + 5): needs ~14°, which puts C1 1.4 mm into the shelf.
  - **Roll to clear only the hooks** (+2.3): needs ~8°, still 0.3 mm into the shelf.
  - **From the back:** the lip walls block at board height.
- **Fix:** make the shelf a separate drop-in part: it rests on 2 ledges (right wall and post), and the holder plus
  the cover rib keep it down. The board then rolls in from above, as in the insert, and the shelf goes on
  afterwards. It also makes the board serviceable. Alternatively, add a main-board insertion-path assert and show
  a path that passes.

### B11 + gate round (2026-10-14)

**B11. Both models placed the board as a mirror image.** *(mechanical, fixed)*
- **Evidence:** the board's x̂ and ŷ, mapped into the device, gave cross-z = −1, so the parts side would face
  down. Real board, parts up, USB at the stated wall: in the insert the header edge faces the outer wall; in the
  scoreboard it faces the front.
- **Effects:** both USB openings were 2.2 mm off, and the cal hole sat over the wrong edge.
- **Fixed:** both models are now rotations, with an assert in both self-checks. ✅ (gate: "board placement")

`check.py` results on the current models: **31 pass, 5 fail**.

| Gate step | Finding | Severity | Fix |
|---|---|---|---|
| insert: board roll-in | **B12.** To get under the outer-wall lips, the board must start ≥ 1.0 mm toward the gate. At its upstream gate-side corner it is already 0.6 mm into the V-wall (relieved only up to `board_top` + 14.5), so there is no room. Extending the relief to the top doesn't fix it: the 1.0 mm shift needs 1.6 mm of relief, which leaves 1.4 mm of V-wall | blocker | Make the 2 outer-wall lips snap/detent hooks too, so the board drops straight down with no sideways travel (flex pockets for them in the outer wall), **and** run the V-wall relief to the top. Checked with the gate's snap-in mode: passes |
| insert: left lid | One lid-lip crush rib (at about u 38.9, y 168) lands entirely inside the receiver block (3.1 mm³, the whole rib), so the lid can't seat | should-fix | Skip ribs where the lip is cut away for the receiver block |
| scoreboard: backer bar | **B13.** The 101 mm bar can't pass the NFC locating rings: they cut the inner width to 99.4 over y 39–66, z 23–51. Below them, the shelf post blocks the way from the back. Yaw doesn't help, because the bar's 11 mm depth widens it again. A 99 mm bar passes cleanly | blocker | A bar ≤ 99 with the stake posts at ±47 (keeps 1.25 mm beyond the hole and clears the strip end), or move the rings |
| scoreboard: NFC tags | The tag's ring is 1.8 deep, but a frame pin (Ø2.6, the face's pin at v = GL_B + 12) sits 0.7 mm inboard of the tag's inner face at y ≈ 40.5, z ≈ 40. A rigid tag can't drop into its ring past it | should-fix | Move the tag down/back or that pin. Moving the tag back is limited by NFC_METAL_CLR (≥ 10 mm to the cells) |
| scoreboard: battery swap | The guide says "lift the holder out", but lifting it 3 mm reaches the adapter (7 mm³), and the 6.5 mm needed to clear the fence is 126 mm³ into the adapter and 15 mm³ into the frame. The fence is open at the back, so **sliding it out backwards** works (gate: passes) | should-fix (docs) | print-and-install + ASSEMBLY: "slide the holder out backwards" |

### Gate round 2 (2026-10-14): `check.py` 36 pass, 0 fail

| Item | Status |
|---|---|
| B12 insert board | ✅ The wall-side lips are now 0.4 mm detents with a 45° lead-in, and the board drops straight in. The V-wall relief runs to the top. Hooks 0.4, BOSS_H 7, clip strain (including the board shift) asserted ≤ 2 % |
| Insert lid rib | ✅ The rib inside the receiver block is skipped |
| B13 backer bar | ✅ 99 mm with posts at ±47. Gate: in from the back, down the slope, onto its pins. Its 4 crush pads (6 × 3, 0.2 interference = 14.4 mm³) are checked as a crush feature, ≤ 30 mm³ |
| NFC tags | ✅ Now fitted first (guide step 1); the frame's lower pins moved to GL_B + 4 |
| Lead lengths (B11 routes) | ✅ The header row moved ~23 mm across the bay. RX ≈ 122 < 165 and LED ≈ 205 < 240 (electronics' new minimums); the battery board side ≥ 230 has margin |
| Swap wording (scoreboard) | ⚠ The guide says "lift the holder **just out of its fence** and slide it out backwards". Clearing the 6 mm fence needs a 6+ mm lift, and the holder reaches the adapter at 4 mm (32 mm³; 141 at 6.5). The fence is open at the back, so the holder slides straight back with no lift (gate: passes). Say "slide it straight out backwards; don't lift it" |

Gate changes this round: the NFC tags moved first to follow the guide, and the backer's crush pads are classified
as crush features, with the strip slab excluded from the backer path.

### Insert v3, end-face battery (2026-10-15): `check.py` 43 pass, 2 fail

The user moved battery and USB-C service to the drawer opening (DECISIONS 2026-10-15). The holder now slides out
of a tunnel in the downstream face, behind a friction-fit hatch, and the JST-PH pair parks in a pocket beside it.
I took mechanical's proposed step 4, then added the drawer's end wall (73 mm in front of the face), 2 balls on the
free floor, the full travel until the holder clears the face, the holder's tip when it's half out, the JST lead
turn and both lead reaches, and the ramp ends. Lead asked for the last two checks.

**Battery swap from the drawer opening (insert taped in, 2 balls on the floor):**

| # | Step | Status |
|---|---|---|
| 1 | Push the balls aside (or take them out) | OK. They sit against the end wall; pushed to the left, they're out of the holder's lane (gate: 2 balls at the left corner) |
| 2 | Hatch off by its lip, one hand | OK. The lip is 46–52 mm up, above a ball at the face. Path along +y is clear |
| 3 | JST out by the housing, then unplug | ⚠ The pair must come 36 mm out to put the board-side housing 10 mm past the face; the 40 mm loop allows it (gate). **Unplugging takes two hands**, one per housing. With one hand you can only pull the holder half until the loop goes taut, and then the force lands on the board-side crimps (**S11**) |
| 4 | Holder out by the ribbon | ✗ **S12** below. Pulled level, it clears the face after 75.5 mm, 4.5 mm short of the end wall (gate). Pulled by the ribbon alone, it tips and jams |
| 5 | Lift it out, swap the cells | Depends on the room above the free floor: open question Q1 |
| 6 | Holder back in, lead end last | ⚠ The tunnel floor is 3 mm above the drawer floor, with no lead-in. You lift the holder 3 mm and line it up with 0.4 mm play (N8) |
| 7 | Plug the JST back in, tuck it and the loop into the pocket, hatch home | ✗ **S11 + S13** |

| Gate step / check | Finding | Severity | Fix |
|---|---|---|---|
| insert: holder half out, front sags | **S12.** The tunnel floor (z 3) ends at the hatch rebate, and the drawer floor is 3 mm lower. Once the holder's centre passes that edge, the front drops onto the drawer floor (4.5°). The back top corner then rises into the tunnel roof: 205 mm³, 1.4 mm deep, at y 142–160. It jams when pulled by the ribbon alone | should-fix | Best: drop the tunnel floor to the drawer floor (open-bottom tunnel, `SLOT_Z0 = 0`). That removes the edge, and the 3 mm climb on re-insertion with it. The right side region keeps ~33 mm of tape width. Doc-only alternative: "once it's half out, hold it level by its front end" (then the gate step changes to a level pull) |
| insert: holder lead turns at JST | **S13.** A mated JST-PH pair has a lead out of each end, so the holder lead leaves its front end toward the hatch and must turn 180° back to the holder. The pair's front sits 0.5 mm behind the hatch's inner face. A 2-wire lead can't turn there, so the hatch presses on the bend or pushes the pair back | should-fix | Park the pair with its front ≥ 4 mm behind the hatch (in line with the 4 mm lead gap). Expose it as `JST_Y1`, which the gate reads. That moves the pull to 40 mm, the whole 40 mm loop. Make the loop ≥ 45 (`JST_LOOP`, board-side minimum +5 → ≥ 365) |
| — | **S11.** One-handed unplug and re-plug is impossible while both halves are loose: the board half hangs on a 58 mm loop | should-fix | Capture the board-side (female) housing in a slot at the pocket mouth, its mating face toward the hatch. Then the holder plug pulls off and pushes on one-handed, with no loop and no strain on the board crimps. Otherwise the guide must say "two hands" |
| insert: holder lead reaches JST out | Needs ~58 mm (the pair 36 mm out, 14 mm across, plus 5 for the bend). Electronics raised the minimum from 60 to 70 (ASSEMBLY §4, dimensions.md, wiring.yml: checked) | ✅ 12 mm margin | — |
| insert: ramps run to Y_R / no rest on flat top | **Ramps (lead's question 1).** For a ball dropping straight down through the opening, the furthest centre (entrance edge 200 + 10 − 17.5) stays 5.0 mm short of the flat top. A sphere rests on that edge only within r·sin 3.3° = 1.0 mm of it, so it rolls back onto the ramp. The ramps really run to `Y_R` across the full width (gate). Next to the step, a ball on the ramp rolls along the step face toward the V-wall (0.40 g along it against ~0.08 g of friction) and over the 24 mm edge. There are no other horizontal surfaces under the opening. The V-wall top is a 3 mm land, and a ball can't rest on it | OK, with Q2 | — |
| — | **Q2.** That result assumes the ball comes down vertically through the opening. A ball still moving downstream can carry past the opening edge if there is headroom above the insert. With the underside of the table ≤ 83 mm above the drawer floor, a ball on the flat top (top at 90) can't fit past the edge: safe. Above that, a ball can land on the flat top, and the 1.6–3.3° tilt rolls it downstream, where it wedges against the edge or drops off the face onto the free floor without passing the gate. That would be a missed goal | open (user measurement) | If the headroom is > 83 mm: slope the side-region tops toward the funnel, or extend the ramps |
| — | **Q1.** Step 5 needs ≥ 47 mm + the end-wall lip height of open space above the free floor with the drawer in the table (mechanical's README lists the same open item). For example, a lip ≤ ~30 mm under an 80 mm opening | open (user measurement) | Ask the user: the height of the collection-end wall (lip), and how high the opening above the free floor is with the drawer in the table |
| — | N8. The tunnel mouth has no lead-in, and the holder has to climb 3 mm (gone if S12 drops the floor) | nice | 1 × 45° chamfer on the tunnel edges at `REBATE_Y` |

Also checked: USB-C straight (40) and right-angle (25) plug envelopes go into the opening and clear the end wall.
The hatch path along −y is clear of the holder, the parked JST, the end wall and the balls. The Dupont plugs and
the lid are unchanged. Mechanical's self-check prints "holder slides 71 mm". It needs 75.5 to clear the face, which
still fits (4.5 mm to the end wall), so only the text is off. Mechanical's `print-and-install.md` §5 and the
board-side ≥ 360 (their route sum) are consistent with the above, apart from S11–S13.

Gate changes this round: step 4 is now the end-face battery. It covers the holder's level pull to the end wall,
the holder tip when half out, the JST pull by the needed distance, the JST lead turn, the holder and board lead
reaches, USB straight and right-angle, and the hatch along −y. Added the ramp checks. It reads optional
`m.JST_Y1` / `m.JST_LOOP` (defaults: the current park position and 40).

**Superseded (2026-10-15, lead):** the user's drawer photos (`team/drawings/drawer-photos`) show a closed tunnel of
about 12 × 5 cm inside, so insert v3 is being redesigned. S11–S13, N8, Q1 and Q2 above are closed without action.
The gate's insert step 4 will be rewritten for mechanical's new concept.
Before the pause, mechanical had already put S12 (open-bottom tunnel), S13 (`JST_Y1 = REBATE_Y - 4`, `JST_LOOP` 45,
pocket 50) and N8 into `insert.py`. Gate re-run: **45 pass, 0 fail**. S11 was not done. Not reviewed further.

### Scoreboard buzzer (2026-10-15): `check.py` 46 pass, 0 fail (with the order fixed)

The CMT-1209-390T (Ø12 × 9) sits on the inside of the left wall at y 85 / z 55, sealed into a ring over a grille.
Gate step: the buzzer comes in through the open back, then moves −x onto its ring. I assumed a Ø9 × 6 mm envelope
behind it for the pins and soldered wires, and every later part is checked against that.

| Gate step | Finding | Severity | Fix |
|---|---|---|---|
| scoreboard: glass / retainer frame | **B14.** The guide fits the buzzer in step 1, with the NFC tags. But the glass (x 8.5–99.5) and the frame (x 4.5–103.5) come in from the open back, past y 79–91, and the buzzer body stands at x 3–12, z 49–61 in that lane. The glass hits it with 72 mm³ and the frame with 143 mm³. The buzzer body alone blocks them, not just my pin envelope | blocker (guide order) | Fit the buzzer **after the adapter** (guide step 7), before the main board. Gate with that order: buzzer path clear, and the board, plugs, shelf, holder and cover all clear it. The back is open, so the seal can still be pressed and checked |
| board model | The new driver parts are now in the gate's board: R_SND socketed (14 mm), J_SND soldered wires (6 mm, no Dupont column), D3/Q2/R_B/R_BD at the default 10 mm. All clear the shelf | OK | — |

Note for electronics: as far as I know, the CMT-1209-390T has PCB pins, not flying leads (mechanical's model note
says "2 flying leads"). If that's right, wires get soldered to the pins **before** it's sealed in. The route from
the wall at z 55 down to J_SND, about 55 mm in from the left wall, needs a length in the ASSEMBLY table.

**Re-check:**
- **B14:** ✅ `print-and-install` now fits the buzzer between step 7 (adapter) and step 8 (main board).
  `m.buzzer` now carries the pins/joints envelope (Ø9 × 6) behind a max-tolerance body (Ø12.5 × 9.5), so the gate
  uses it as-is. Gate: **46 pass, 0 fail**.
- **Electronics' buzzer wiring:** I checked it against `perfboard-scoreboard.png` and `perfboard.py`. ASSEMBLY
  holes are 1-based (`perfboard.py` + 1).
  - **Parts (S2):** R_SND (21,3)–(22,3), D3 K (21,4) / A (21,5), J_SND + (22,4) / − (22,6), R_B (22,7)–(23,7),
    Q2 C/B/E (22,8)/(23,8)/(24,8), R_BD (22,9)–(23,9), MTDO wire at (4,5).
  - **Nets (S2):** SND, BZ+, BZ−, BASE and the VSYS/GND additions all match the picture.
  - **Circuit:** the flyback diode points the right way (K on BZ+), and the low-side switch is right.
  - **Q2:** "flat side to the D0–D6 edge" gives C at the USB end, which is right for a BC337.
  - **Nice:** `perfboard.py` lists an extra BZ− node at (20,6) = ASSEMBLY (21,7). No part is there; it's only a
    bend in the wire. Drop it from NETS, or name it in the BZ− row.
- **S2 continuity, should-fix (doc):** "SND to GND reads about 101 kΩ" only holds in one probe direction, if at
  all. The Q2 base-emitter junction sits across R_BD, and the XIAO's GPIO protection diodes sit on SND. Depending
  on the meter's test voltage and the probe direction, the reading can be well under 101 kΩ, which is a false
  alarm. Fix: check R_B and R_BD by colour before soldering, and for the nets use beep checks only (MTDO wire ↔
  R_B (22,7), BASE nodes, Q2 C ↔ J_SND −).
- **S6 step 1, should-fix (doc):** "trim it only once the board is in" contradicts soldering both ends for the S5
  test. Once the board is clipped in, J_SND's underside can't be reached. The route is about 105–115 mm: buzzer
  back (12, 85, 55) down the left wall, then along the board to J_SND (62, 71–76, 10.6), under the shelf (z 25+).
  The 15 cm pair leaves 35–45 mm of slack, and with the board out behind the case it still reaches (about 90 mm).
  Fix: don't trim. Tuck the slack along the left wall below the buzzer.
- **S5 sound test:** OK (buzzer soldered, still loose, bench build plays Low/Medium/High).
- **Troubleshooting rows:**
  - **No sound:** OK.
  - **D3 backwards:** OK. It's actually a hard short of VSYS through D3 and Q2 whenever Q2 is on, so the battery
    drains fast too. Worth saying "pull the batteries now".
  - **Active buzzer:** OK.
- **Electronics' fixes:** ✅ all four verified.
  - **Continuity checks:** the 101 kΩ value is replaced by beep checks: SND, BASE, Q2 C ↔ J_SND −, and VSYS ↔
    J_SND +. R_B and R_BD are checked by their colour bands.
  - **S6:** now says "~110 mm, don't trim, tuck the slack".
  - **BZ− net:** (21,5) → (20,4) → (21,7) in `perfboard.py`. There's no bare waypoint any more, and the picture
    is re-rendered.
  - **D3 row:** now says "pull the batteries first". Electronics is right that it shorts only while Q2 conducts.
  - **Gate:** 46 pass, 0 fail.

### Scoreboard v3, LEDs + PCA9685 + RC522 (2026-10-15): `check.py` 52 pass, 0 fail

New gate steps, in the guide's order:
- **Light pipes ×4:** after the caps, in along the face normal from inside.
- **Key strip:** carries its switches and LEDs as one part (90 × 28).
- **Backer bar:** now raised 35 mm on the way in, up from 30. DEPTH grew 3 mm, so at 30 it hit the battery-shelf
  post's pin (1.5 mm³). Mechanical checked that 33 mm or more clears it, and a hand lifts the bar over a 2 mm pin.
- **PCA9685:** in from the back, then down into its channel (crush rib, tol 1 mm³). It must be held about 30 mm up
  on the way in, because at 15 mm it hits the shelf post (x 74–77, y 79–85). Mechanical's check covered only the
  column straight above the channel.
- **RC522:** after the buzzer, before the main board. In from the back 10 mm off the wing face, then pressed onto
  its pads. On the tighter 5 mm approach it catches the top rim of the back opening.

Also, in electronics' new board layout, J_RFID and J_LEDS are solder points with wires straight in, like J_EPD and
J_SND. The gate first gave them a 22 mm Dupont plug column, which hit the shelf; it now treats them as solder
points.

| Item | Finding | Severity | Fix |
|---|---|---|---|
| `print-and-install` step 3 | Still says "90 × 20 strip". The strip is 90 × 28 now. Its 2 holes sit 10 mm from the switch edge, in line with the switch centres, not on the strip's centreline (the `STRIP_HOLE` comment in `scoreboard.py` says the same old thing) | should-fix (doc) | "90 × 28 strip; Ø2.5 holes 3.5 mm from each end, 10 mm up from the bottom edge, in line with the switches" |
| `print-and-install` PCA9685 | "Stand the board … push it down": lowered from straight above it's fine, but from the back it has to come in high | nice | "bring it in high over the shelf post, then lower it into the channel" |

**Re-check:** ✅ Mechanical's fixes are in.
- **Guide step 3:** 90 × 28 strip with its switches and LEDs; holes in line with the switches.
- **`STRIP_HOLE` comment:** fixed.
- **PCA9685 step:** "about 30 mm above the floor … then lower it".
- **RC522 step:** "about 10 mm clear of the face".
- **Right NTAG:** dropped (lead), so 1 tag.

Gate: **51 pass, 0 fail**.

### Electronics, scoreboard Part 2 (2026-10-15)

I checked ASSEMBLY S2–S6 and the scoreboard troubleshooting table against `perfboard.py` (SB block) and the two
pictures. A script ran the board data looking for clashes. Then I checked `keystrip.png`, `scoreboard.py`,
`dimensions.md` and `bom.md`.

**OK:**
- **Holes and nets:** every hole in S2's parts and net tables matches `perfboard.py` + 1, including the new parts,
  pads and nets.
- **Clashes:** no hole is shared between two parts, no node sits in two nets, and no node is in a keep-out.
- **USB sense:** 2.98 V on USB (3.13 V at 5.25 V), 0 V on battery, and GPIO6 can wake the board.
- **Boot:** the pad wires (GPIO4–7) are safe at boot.
- **Shared SPI:** the DESPI has no MISO pin, and the reader has its own CS.
- **I²C:** the addresses 0x40 and 0x19 don't clash.
- **Key strip:** the key-ladder voltages and the strip geometry match the model.
- **S3b/S3c, buzzer order:** match.
- **RC522 wires:** now ≥ 25 cm, matching `dimensions.md`.

| Item | Finding | Severity | Fix |
|---|---|---|---|
| Underside picture, row 1 | VPACK `(3,0)→(16,0)` is drawn as one straight wire along the bottom row, through J_BAT −, all 6 J_RFID points, R2, C2 and R1. The GND runs `(1,0)→(4,0)→…` and `[(4,0),(6,0)]` follow the same row. S2 says to wire "following the picture", so a builder could bridge J_RFID 3V3/SCK/MOSI/MISO/CS to VPACK or GND. The GND run from X:GND to (1,0) is also drawn through XIAO D1 (INT1) | should-fix | Route VPACK and that GND run along row 2, with waypoints; keep GND off D1. Add one line to S2 |
| ASSEMBLY S3 step 8 / S3b step 4 | 12 LED wires are made, but no wire from the LED GND bus. S3b step 4 then solders "the LED GND bus wire" | should-fix | "…(12 wires), plus one ~15 cm wire from the LED GND bus (13)" (matches `bom.md` S10) |
| Troubleshooting: USB sense | No row. If R_VB1 and R_VB2 are swapped, the pin sees 5 × 68/168 = 2.0 V, which reads LOW, so the board never wakes on USB | should-fix | Row: "Doesn't wake on USB (no `usb: awake`) → R_VB1/R_VB2 swapped or the MTCK wire is in the wrong hole; (3,10) ≈ 2.9 V on USB" |
| Troubleshooting: "No LEDs at all, `pca9685` error" | OE not bridged can't cause an I²C error; the outputs just stay off | should-fix | Split it. Log error → SDA/SCL swapped, or VCC/GND missing at J_LEDS. No error but dark → OE floating, or the LED GND bus not on a PCA9685 GND pin |
| `bom.md` S8, `electronics/README.md:295`, `mechanical/README.md:106` | Still say "90 × 20" key strip | should-fix (doc) | 90 × 28 |
| Troubleshooting: `rfid` row | A MISO/CS swap is likelier at the unlabelled pad wires | nice | Also point at MTMS (3,7) / MTDI (3,6) |
| Pictures | In the underside view, the "BAT− / BAT+ pad" labels sit over the MTMS/MTDI dots, and the "MTDO pad" label runs into the keep-out. In the top view, the J_RFID / J_LEDS holes have no PIN_NOTES | nice | Move the labels; add PIN_NOTES |
| Intro quantities | "~1.5 m hook-up wire" is short: 13 × 15 cm LED wires + 6 × 25 cm reader wires is about 3.5 m. "~11 F–F jumpers" disagrees with `bom.md` S10 (7–8) | nice | Align them |
| S2 continuity | "XIAO 5V to GND ≥ 160 kΩ" runs in parallel with the XIAO's own VBUS circuit, so a good board may read lower or drift | nice | Measure R_VB1/R_VB2 before the XIAO goes on, or say "once it settles" |
| S6 step 2 | Parts listed in a different order from mechanical's guide. The PCA9685, adapter, buzzer and RC522 are all wired to the main board, so it hangs off that harness from mechanical step 4 to step 8 | nice | Use mechanical's order; warn about the harness |
| J_RFID / J_LEDS wires | The board's lips and clips at x = 25 sit over both spans. The gate passes wires that go straight up, but a wire bent toward the edge goes under a lip | nice | "wires leave straight up / inward" |
| 3V3 budget | The MFRC522 transmitter can draw about 100 mA with the field on, against the seller's 13–26 mA. The peak is about 480 mA with Wi-Fi, which is fine on a full pack | nice | Firmware: don't poll the reader during Wi-Fi bursts near cutoff |
| `electronics/README.md:312` | On the C6, MTMS/MTDI strap the SDIO edge, not the JTAG source (that's GPIO15). The conclusion (harmless) stands. Not checked against the datasheet this session | nice | Fix the reason |

**Re-check:** ✅ `mechanical/README.md:106` now says 90 × 28. The badge font change is cosmetic and not an assembly item. Gate: **51 pass, 0 fail**.

**Re-check (electronics):** ✅ All five should-fixes are done, and most of the nice items.
- **Pictures:** `perfboard.py` now routes every wire with half-grid bends round other joints and out of the
  supports, and asserts that no segment passes within 0.45 pitch of another joint (line 252, both boards). In the
  re-rendered scoreboard picture, VPACK runs on the half-row below row 1, clear of J_RFID, and nothing crosses D1.
  S2 says "a wire connects only where it has a dot" and "leave straight up or inward".
- **13th wire:** the LED GND bus wire is now in S3 step 8.
- **USB-sense row:** added.
- **LED row:** split into "log error" and "dark with no error".
- **90 × 28:** fixed in `bom.md`, `electronics/README.md` and `mechanical/README.md`.
- **Nice items:** the `rfid` row now points at the pad wires; the quantities are ~3.5 m of wire and ~8 jumpers; the
  5V–GND reading is replaced; S6 step 2 follows mechanical's order with a harness warning; the RC522 TX note and the
  README:312 reason are fixed. PIN_NOTES for J_RFID/J_LEDS were left out, which is fine: the pin order is in the
  picture's note line.
- **Watch item:** VPACK on that half-row sits about 2.1 mm from the board edge, so a Ø1 wire clears the 1.5 mm edge
  support strip by only ~0.1 mm. That's OK, but press the wire flat toward the board, not toward the edge.

Gate: **51 pass, 0 fail**.

**Re-check:** ✅ The watch item is removed. The router keep-out margin is now 0.8 mm in board mm (`in_keepout`, `perfboard.py:138`): half a Ø1 wire plus 0.3. VPACK now runs on the half-row above row 1, ~4.7 mm from the edge, still clear of J_RFID. Both pictures are re-rendered. Gate: **51 pass, 0 fail**.

### Scoreboard v4: reader on top, opal LED bar, lit badge (2026-10-15)

I took mechanical's gate diff as-is. The light-pipe loop is now one diffuser-bar step (in from the inside, slope 10
past the shelf post). The RC522 step along the face is now two steps: the badge insert with LED5 glued in (12 mm low,
then up), then the RC522 (2 mm low under the insert's shoulder, then up onto its pads). The order matches
`print-and-install.md` §7 and ASSEMBLY S6 step 2. Gate: **49 pass, 1 fail** (the insert 23/0; the scoreboard 26 pass, plus the new S16 check, which fails).

I also checked by hand (probe, model numbers):
- **Re-opening:** with only the cover off, the RC522 and the insert + LED5 both come back out the open back (0 mm³
  into the shelf and the battery holder). Servicing the reader doesn't need the board or battery out. ✅
- **LED5:** it sits about 12.5 mm past the loop end (≥ 10 asserted in the model). Its leads point straight down,
  away from the loop, and electronics' 4 twisted wires of ≥ 25 cm reach the PCA9685. ✅

| # | Finding | Severity | Fix |
|---|---|---|---|
| S16 | The badge insert isn't held flush. Its shoulder bottom is at Z_IN − 1.0, but the reader's back sits at Z_IN − 1.5 (0.5 pads + 1 mm tape). Upright, the insert drops **0.5 mm** onto the reader, so it sits 0.5 below the top surface and rattles when a badge taps it. The guide's "it holds the insert in place" isn't true yet. New gate step: `badge insert held flush` | should-fix | `TILE[2]` = `RC_AIR` (1.5), so the insert's back meets the reader's back. *(I first wrote `RC_AIR − 0.2` here. That was wrong: it leaves a 0.2 mm drop. The foam can't preload the insert either, because the pads and the insert both sit above the reader.)* |
| N9 | The guide doesn't say what holds the insert up while the reader slides in. A hand under the insert is in the reader's path | nice | One line: "hold the insert up by pressing LED5 with a finger. It's to the right of the reader's path" (LED5 is at x ≈ 85, the reader ends at x 73) |

**Re-check (v4 final: face 46°, 109 × 148 × 100):** ✅ S16: the insert's shoulder is now `RC_AIR`, so the gap is 0.
✅ N9: `print-and-install.md` and ASSEMBLY S6 step 2 both say to hold the insert up by LED5 while the reader slides in.
The PCA9685 now lies flat on 4 taped floor pads. The gate step is renamed "onto its pads" and runs at the default
0.5 mm³ tolerance, since there's no crush rib any more. It passes the same way: held 30 up, then down. The frame's
3 baffles and roof fin pass its path.

I tightened the S16 gate step to a band, −0.05 ≤ gap ≤ 0.15. Too thick is the worse case: an insert 0.1 mm over
`RC_AIR` stops the reader 0.1 short of its foam tape, so the reader doesn't stick. Watch on the first print: if the
reader won't take the tape, sand the insert's back. Gate: **50 pass, 0 fail**.

### Scoreboard v4 with MX keys (2026-10-15): `check.py` 49 pass, 0 fail

I took mechanical's gate diff as-is. The key strip, backer bar and backer pads steps are gone. New steps: the MX plate
+ switches + wiring (face_path, engage `PLATE_TRAVEL` + 0.5, slope 35), the LED-only strip (engage `STRIP[2]` + 0.9,
slope 30), and the caps last, pushed on from outside (15 mm along the face normal). The diffuser engage goes from 22
to 12. The order matches `print-and-install.md` §2–4.

Probed by hand: I moved each part along the face normal against everything else in the model.

| # | Finding | Severity | Fix |
|---|---|---|---|
| S17 | Nothing holds the LED strip on its pins. The pins are Ø2.1 in Ø2.5 holes and stand 0.4 past the strip. With the 46° face, gravity pulls along the pin axis at 0.72 g toward the inside, and nothing behind the strip stops it for at least 8 mm (frame, glass, PCA, adapter, plate: 0 mm³). The old backer bar used to hold the key strip; this strip has nothing. A knock or a tug on the PCA wires moves the LEDs off the bar | should-fix | A dot of hot glue over each pin tip, as on the diffuser bar ends (guide §4, one line), or longer pins (`STRIP[2]` + 1.0) heat-staked like the plate's |
| S18 | Only the 3 heat-stake heads hold the key plate against a press. The plate's front rests on the posts (it hits them at 0.1 mm outward), so a press pushes it **away** from them: 2 mm inward meets nothing. The cap stops on the switch housing at 3.3 mm, so a slammed key goes cap → housing → plate → the nearest stake head, in pull-off: PETG heads on Ø2.3 pins, at 10 mm from an outer key. A heat-staked plate also can't come out to replace a switch without cutting the stakes | should-fix | M2 self-tapping screws into the 3 posts (Ø1.6 pilot) instead of stakes: much more pull-out, and the plate comes out for a switch swap. Or keep the stakes and add a bearing behind the plate (it's open-backed there, so screws are the lazy option) |
| N10 | The caps come off only from outside, and only 3 mm stands proud. The skirt sits 0.5 inside the face, so a wire keycap puller can't hook under it | nice | Guide line: "pull a cap straight out with taped flat pliers on its sides" |

### Electronics, S3 for MX + the LED-only strip (2026-10-15)

I checked this against `scoreboard.py`.

✅ The strip is 98 × 8. Its pin holes are Ø2.5 at ±46.5, 1 below the LED row (`STRIP_HOLE`). The LEDs sit at ±10.16 and ±30.48 (`KEY_PITCH` 20.32).

✅ Both views of the switches agree with the MX pin positions (−3.81, +2.54) and (+2.54, +5.08). From the back, K1 is on the right, pin 2 is upper-left and pin 1 lower-right.

✅ The wiring zone is ±40.5 × v −2…+7, with ≤ 3 behind the pins (`WIRING` 3.0). That's the same as the model's `wiring`.

✅ The ladder is K1 direct, then 4.7 k, 10 k and 22 k, the same in the text and the picture. The LED order is R K B G with R toward K1's side, seen from the front.

✅ The cross-references are right: S5 step 2 and troubleshooting point to S3 steps 2–3, 3 and 6–7, and S3b step 4 points to S3 step 7 (the 12 + 1 wires). BOM S8 (9 × 15 cm, ≥ 100 mm long) and the shopping-list line match.

| # | Finding | Severity | Fix |
|---|---|---|---|
| S19 | `print-and-install.md:191` says to clip the switches in "pins toward the rail side". The model has them the other way. The wiring zone is v −2…+7, above the key centre, and the rail is below at v −11.5…−8.5. ASSEMBLY S3 and `keystrip.png` follow the model: pin 2 is the upper pin, and the GND bus runs below. Following the guide puts the buses and resistors against the rail and flips which pin is "upper" | should-fix (mechanical) | "pins up, away from the bottom rail (toward the LED strip)" |
| N11 | S3 step 6 slots each LED through "the 2 holes either side of the LED's centre", so each LED centre must sit **between** two holes. That only works if the strip's middle is between two holes too, since 10.16 and 30.48 are whole pitches. If the middle sits on a hole, those two holes are 5.08 apart and won't merge | nice (electronics) | Step 5: "cut it so the middle falls between two holes" |
| N12 | S3 step 4 only beep-tests K1. K2–K4 go untested until S5 | nice (electronics) | "…and reads ~4.7 / 10 / 22 kΩ while K2 / K3 / K4 is held" |

**Re-check (electronics):** ✅ N11 is done: S3 step 5 says to cut the strip so its middle falls between two holes (`ASSEMBLY.md:506`). ✅ N12 is done: step 4 reads ~4.7 / 10 / 22 kΩ for K2 / K3 / K4 and open otherwise (`ASSEMBLY.md:501`), which is right with J_KEY unplugged. Waiting on mechanical for S17, S18, S19 and N10.

**Re-check (mechanical, S17–S19, N10):**
- ✅ **S17:** the LED-strip pins now stand 1.0 proud, with a hot-glue dot over each tip (guide step 4).
- ✅ **S18:** keyhole retention replaces the heat stakes. Each post ends in a Ø2.4 neck with a Ø4.2 × 1.2 head, and the plate has keyholes whose big ends sit 3 mm lower. The plate goes on held 3 up, then slides 3 down. A press pulls on the heads, which is fine. I adopted mechanical's plate path: 3 up the slope, along the normal, 32 up, then in from the back.
  - It's **locked**, not only held by gravity. Probed sliding up the slope: the caps hit the face from 0.6 mm (88 mm³ at 1 mm), and the LED strip blocks it from 1 mm. The 3 mm release needs both off.
  - New gate step: `key plate locked by the caps`.
- ✅ **S19:** "pins up, away from the bottom rail (toward the LED strip)".
- ✅ **N10:** a line on pulling caps with taped flat pliers.

| # | Finding | Severity | Fix |
|---|---|---|---|
| N13 | `print-and-install.md:197` says "to take it out, slide it up and lift it off", but it won't slide until the 4 caps and the LED strip are off | nice | "pull the 4 caps (from outside) and take the LED strip off its pins first, then slide it up and lift it off" |

Gate: **50 pass, 0 fail**.

### Scoreboard: J_AMP + speaker option A (2026-10-15)

- ✅ **J_AMP is in `SOLDERED`.** It has 3 wires soldered straight in, no header (ASSEMBLY S2, `perfboard.py:135`), so the gate stops modelling a Dupont plug there. The scoreboard now has 2 Dupont plugs, J_KEY and J_BAT. Mechanical's shelf notch over J_AMP is now spare room, which is harmless.
- **The gate was missing the speaker build (option A, now the default).** I added 2 steps in the guide's order: after the reader, before the main board.
  - **Amp + 470 µF:** slides in low from the back, then goes 3 mm down onto its tape.
  - **Speaker pressed into its cup:** in from the back, then 5 mm sideways (+x) into the right wall's lip.
  - Both pass. The speaker step isn't empty: going straight in from the back without the sideways leg hits the lip (34 mm³). The later steps (board, plugs, shelf, holder, cover) all pass with the speaker and amp in.
- The buzzer step stays as option B. It's an extra obstacle for option A, which makes the check stricter.

Gate: **52 pass, 0 fail** (insert 23, scoreboard 29).

### Scoreboard v5 (2026-10-15): `check.py` 64 pass, 2 fail

I rewrote the scoreboard tail from mechanical's ACTION, in the guide's order:
- **PCA9685:** goes in after the frame and adapter, 10 up, then down into its 2 floor slots.
- **Badge insert + LED5:** 12 off the face along its normal, then out into the right wing's window.
- **RC522:** 6 off the face, then onto its pads.
- **S16 held-flush:** now measured along the face normal. The band is: the reader doesn't overlap the insert (< 0.5 mm³), and it touches it within 0.15.
- **Sound:** the two options are alternatives in one lip, so the rest of the build now runs **once per option**. **A** is the amp, then the speaker in its cup (5 inboard, then +x). **B** is the buzzer in its disc (4 inboard, then +x). Each is followed by the board, plugs, shelf, holder, USB and cover.
- **USB:** this is new: the male end, the cable route, the female end and the cover.

The model contract had one typo in the ACTION: the object is `buzz_disc`.

Gate decisions and probes:
- **The male end goes in with the board.** Between the plug's overmould and the left wall there's **5.4 mm**, less than the ~6.5 mm a USB-C plug needs to come out of the port. Backing off 6.5 hits the wall (86 mm³). So it's plugged in by hand and rolls in with the board.
  - Held 12 up, the plug hits a post at x 18–21, y 78–81, z 26–27 (2.8 mm³). At 16 up, nothing collides.
  - The gate now uses 16, which is a choice of path, not a model problem.
- **The cable route** leaves the male end's back, so the gate doesn't count the plug as an obstacle for it.

| # | Finding | Severity | Fix |
|---|---|---|---|
| S20 | The USB female end can't drop into the cover's clip from above. The clip's lips stand 1.5 over each 9 mm flange edge, so they're **6.0 apart**. The receptacle body behind the flange is **7.0 wide** (`USB_EXT[7]`, EST). It jams on the lips 15 mm before it seats (6 mm³, both options) | should-fix | Lips 0.8 over the flange (inner edges at ±(uw − 0.8), 7.4 apart), or a slot in each lip for the body. **Measure the real extension first** (rule 11): the flange and body sizes are EST |
| N14 | `print-and-install.md` should say: plug the extension into the XIAO **before** the board goes in, and to unplug it, lift the board out. The plug can't come out in place (5.4 < 6.5) | nice | One line in the main-board step |
| N15 | Taking the cover off for a battery swap leaves it tethered by the extension cable | nice | "pull the cover back, lift the USB socket up out of its clip, set the cover aside". Or say how much slack the cable needs |

**Re-check (mechanical):**
- ✅ **S20:** the lips are now 0.8 over the flange, 7.4 apart (`scoreboard.py:348`). The female end drops in from above in both sound options. The flange is still held by 0.8 per side, and mechanical's self-check covers it.
- ✅ **N14:** `print-and-install.md:273`.
- ✅ **N15:** `print-and-install.md:304`.

Gate: **66 pass, 0 fail**.

## Goal-counter sled: layout review 1 (2026-10-17)

This is a paper review of the agreed layout (`mechanical/reports/2026-10-17-sled-layout.md` +
`electronics/sled-layout-2026-10-17.md`). The details are in
[`2026-10-17-sled-layout-review.md`](2026-10-17-sled-layout-review.md), and the criteria in
[`2026-10-17-sled-criteria.md`](2026-10-17-sled-criteria.md). There are no blockers.

| | Finding | To |
|---|---|---|
| S21 | The holder's front-end leads have ~1.3 to exit. Fix: the pocket at s 112.8–181.8, with the back stop as the cross wall | mechanical, electronics |
| S22 | The emitter's legs and clip land in the shell's rib wall at s 194–195.2. Fix: notch it, or move the rib to s ≥ 198 | mechanical, electronics |
| S23 | The mouth joint is unkeyed and mated by feel ~45 deep. Fix: a 3-pin with one pin pulled and that cavity plugged, plus a pull tab | electronics |
| S24 | Lifting L by the cup pushes up on the lid's snap. Fix: give the cup L's own ceiling | mechanical |
| S25 | The bridge-top groove is 2 × 2, but the lead is a pair. Fix: 2 × 3.6 | mechanical |
| S26 | The rigid lid posts on the holder either rattle or stop the snap. Fix: posts 1.5 short + 3 mm foam | mechanical |
| N16–N19 | JST slack and grip; LED lead clips and the switch-ON line; ribs for the 12.3 board supports; ribbon loop as standard | both |

The gate sweep follows once `sled.py` exists.

## Goal-counter sled: CAD review 2, the gate (2026-10-17)

`check.py sled` follows SLED-ASSEMBLY §3–§6 against `sled.py`, with the real board and the frame at e_L 10 and 15.
**27 pass, 3 fail; after mechanical's fixes, sled 29/0 and full gate 97/0** (re-checked 14:45). Details are in [`2026-10-17-sled-cad-review.md`](2026-10-17-sled-cad-review.md).

| | Finding | To |
|---|---|---|
| **B15** | The pin at y 26.5 (3.5 from the lipped edge, 2.0 proud) can never clear while the edge slides under the lips. Fix: drop it, keep its boss | mechanical, electronics |
| S27 | The guide fits the undo button before the board, which then can't get under the cartridge. Fix: fit the button after the board, and describe the board's tilt-in | mechanical |
| N20 | The guide's 5° lid tilt jams at the roof's front wall. Fix: lift the front ~5 mm (≈ 2°) | mechanical |

S21–S23, S25, S26, N17 and N18 are verified ✅. S24 and N19 are superseded: the finger cup became a cord loop in the
mouth bay.
