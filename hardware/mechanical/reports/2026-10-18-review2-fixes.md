# Hardware review 2: mechanical fixes (2026-10-18)

Source: `electronics-review/2026-10-18-CONSOLIDATED.md` (items tagged [mechanical]) and assembly-review B16
(`assembly-review/2026-10-18-review2-gate.md`). Model: `sled.py`, `roll_test.py`. Guide: `SLED-ASSEMBLY.md`.

## Closed

| Item | What changed | Asserted (mutation-tested) |
|---|---|---|
| **R1.4 contacts** | 4 pogo pins (2 per pole, 3 apart; poles 10 apart at y −55/−65, z 20). Gold targets are 8 × 8 ENIG PCB squares in slots 1.0 behind the drawer's rear face, reached through Ø2.2 plunger-only holes. A joint pocket 3 deep sits in front of each target, with a 3 × 3 lead hole forward into the tray (hot glue = strain relief). Stand-offs = the pin's hard stop. No fuse | 2 per pole, ≥ 10 from the USB-C, barrels in their holes, plunger holes clear and plunger ≤ Ø1.4, target ≥ 1 deep and covered, joint pocket + lead way, block clear of the holder |
| **R1.4 coupon** | `sled_coupon_pins` (the lane wall's pin section) + `sled_coupon_targets` (the drawer's target block), both on plate 4. Guide §5.1: try them before printing the drawer | supports-off check for both |
| **R1.4 slide switch** | Guide §5.3: bridge the FIT0610's switch with a wire (electronics does the joint) | (guide) |
| **B16 latch** | The detent catches the drawer **0.2** from its stop (was 0.95). Bump 0.9 high, holding flank 60°, lead-in 45°. Arm 1.6 thick (was 1.2). The pins work at the catch: c_stop = 2.5 − 0.5 − 1.0 = 1.0, c_catch = 1.0 − 0.2 − 0.15 (flank give) = 0.65 ≥ working, and 0.5 of stroke is left at the stop. Latch hold ≈ 9.0 N ≥ 1.5 × 4 pins × 1.0 N | catch within 0.1–0.4 of the stop by geometry, hard stop, hold force from the arm's section ≥ 1.5 × the pins' push |
| **R1.6 daylight** | The receiver tip now sits 4.4 behind its Ø3 aperture (was 4.0): the cartridge only, 3.5 left behind the flange for the lead pair (that's the most without reworking the pod). Guide §2: a 1.2 black test square must block the beam, or use carbon-black filament | roll test: ≥ 3.5 behind the flange |
| **R2 antenna** | A 42 × 12 × 0.3 stick-on rebate under the lid's left edge (s 130–172), ≥ 10 from metal. The dash's leads cross the XIAO's **USB end** high (z ≥ 24), then run back along the plug row's right side, ≥ 10 from the antenna end. Guide §4.5 | spot ≥ 40 long, ≥ 10 from metal; lead way clear of L, lid, drawer and parts, ≥ 10 from the antenna |
| **R2 plug retention** | Guide §4.6: hot glue on every housing and socketed resistor after calibration, leads tied within 20, C1 glued | (guide) |
| **R2 docs** | SLED-ASSEMBLY: contacts, parts list, coupon, switch bridge, filament test, retention, lead route, asserts, EST table. INTERFACES §5 goal-counter row (was 52 high, 0.96" tilted, pull cord) | grep: no nickel / 2-pin / 0.75 rows left in my files |

## Knock-on effects

- **Board 4.0 rearward:** the lane grew to fit the target block (LANE s 116.7 → 120.7). The board is at s 126–196 (back
  wall 199), the XIAO antenna at s 144–148. Placement still lives in `sled.py` (INTERFACES §4).
- **Gate contract:** `STROKE` is gone. The new names are `PIN` (EST dict: barrel, plunger, protrude, stroke, work, force),
  `POGO_MIN`, `TGT`, `SO`, `CATCH`, `POLES` (2 targets), `POGO` (4 pins), `targets` (2, at t1 = DR[2] − TGT[2]),
  `pogo_l` (4, free length), `lead_way`, `FPC`, `coupon_pins`, `coupon_tgts`.
- **EST until electronics names the Mill-Max pin:** barrel 1.8, plunger 1.0, 2.5 protrusion, 1.5 stroke, 0.65 working,
  1.0 N. Changing `PIN` re-derives the stand-offs and the drawer's rear face, and the asserts re-check the latch.

## Testing

- `sled.py --check` green; mutations 21/21 (contacts + latch 15, arm 1, antenna/leads 5).
- `roll_test.py --check` green.
- Full build green; plates 1–4 and renders regenerated.
- Gate: 135/0 after assembly-review's update (B16 verified: catch 0.25 out, pins 1.00 at the stop, 0.75 at the catch).

## Open: N25 (assembly-review)

The catch leaves only 0.10 over `POGO_MIN` 0.65, which is within print tolerance. With the EST pin it can't grow without
eating the ≥ 0.5 of stroke left at the stop: 1.5 stroke = 1.0 at the stop + 0.5. When electronics names the pin, re-set
`SO`/`CATCH` for a margin ≥ 0.25, add that to the contact assert, and measure it on the contact coupon.

## Update: Mill-Max values, then lead's wired-lead decision (2026-10-18)

- The Mill-Max values (0973-0-15-20-77-14-11-0) went in first: press-fit web, stop 1.2 / catch 0.85. That N25 margin
  was green on the gate. It is superseded by the next point.
- **Lead DECIDE: a keyed wired lead with a slack loop, no pogo pins.** Gone: the pins, targets, stand-offs,
  coupons, the pin-force latch check, `PIN`/`POGO*`/`TGT`. The latch only holds the drawer (catch 0.2 kept).
- **The loop:** a rolling U in the channel under the rail, right of the lane (y −73..−80, on a ledge at z 10.5).
  - The lower strand lies still; the upper strand rides with the drawer from a tab on its rear-right corner, through a
    slit in the lane's right wall (45° top). The bend rolls at half speed.
  - Pushing in **pulls** the lead (tension), so it can't buckle into the drawer's path. Fully out, the bend is ~10
    in front of the frame, beside the drawer and above the bar.
  - Strain relief: zip-tie slots in the ledge at s 158–161 (J_BAT end); a glue groove in the tab plus two posts behind
    the holder (holder end). The lead reaches J_BAT through a notch in the wall at s 164–172.
  - Length: **252** from J_BAT's plug to the joint behind the holder (`LEAD_LEN`), the same at every pose.
- **Gate names:** `lead_tube(d)`, `lead_home`/`lead_half`/`lead_out` (d = 0 / 62.5 / 125), `lead_pts(d)`,
  `LEAD_LEN`, `LEAD`, `A_S`, `J_BAT`, `DRAWER_OUT`.
- **OLED:** Waveshare 14657 (36.0 × 12.5). Its pin end stays put and the left end moved 2 in, so the active area is
  now r 36.3–58.7.
- **Testing:** check green; lead mutations 11/11; the Mill-Max set 14/14 before it was dropped.
- **S40/S41 (assembly-review):** the posts are dropped; the tab's glue groove is the strain relief, and the ~Ø4 joint
  fits loose behind the holder (asserted). `HOLDER_LEAD` = 40 (≥ 36) lets the holder lift 20 clear of the tray
  (asserted). Mutations 5/5. Gate **135/0**.

## Round 3 (ee2-codex-r2 R2-S2/R2-B2, ee2-astra-x-r2 R2-S4, ee2-opus-r2)

- **Drawer stop (R2-S2):** a Ø1 nonconductive cord (`tether_tube(d)`) rolls in the same U beside the lead, tied to the
  ledge (holes at s 150/154) and to the tab's front. It runs out of U at 125 out, while the lead still has 6 + its bend.
  The lead never takes the pull. Asserted: equal length at every pose, clear of the lead and everything else.
- **Cable (R2-S2):** Adafruit 6181 24 AWG, a 2.8 × 1.4 flat pair. The loop's bend is now r 7 (`LEAD_R_MIN`, electronics:
  5 × 1.4); it was 5.6. Lead 247 in the model from the PH pair to the joint; electronics cuts ~260.
- **J_BAT:** a JST-PH 2-pin pair. The board pigtail is at holes (17,0)/(19,0). The mated pair (18 × 7.5 × 5.5) lies in
  a pocket beside the board's bottom edge (s ~171–179), open above (reach with the lid off). The lead reaches it through
  the wall notch.
- **OLED (R2-B2):** the Waveshare's PH2.0 is a side-entry socket on the back, right end, plugged along the module's
  axis. The dash has ~1 free at either end vs ~10 for the plug and bend, so it can't plug in. With electronics: 4 ×
  28 AWG soldered into its 2.54 holes at the left end, back to the channel. The socket sits unused in an open-top
  pocket, with a 0.9 rib behind it (`OPH` EST until a module arrives).
- **Board envelopes (R2-S4):** `parts3d` is built from `electronics/perfboard.py`'s own `PARTS` and `body()` (read from
  its source with `ast`; it plots on import), with heights in `BODY_H` (EST, incl. C1's can 13.5). They replace the
  old `tall`/`plugs` boxes. The lid, antenna and lead-way checks now use them, and the dash leads' way reaches J_OLED /
  J_STAT on the top edge and J_BZ.
- **Fuse (ee2-opus-r2):** room for F1 (Ø4.4 × 11 envelope; electronics' part is Ø2.4 × 7) next to the joint, asserted.
- **Guide:** "the lead is the tether" and the keyed Dupont J_BAT are gone; the cord, the PH pair, F1 and the OLED
  wiring are in.
- **Testing:** check green; round-3 mutations 16/16.
- **Heights from electronics:** a Dupont on a header is 21.5 incl. its wire's bend up, ceramics 7, J_BAT's pigtail + glue
  5 (C1 13.5, sockets 14, R 11, diode 10, TO-92 8 confirmed). The dash leads' way now runs at z 32–38, over the plugs'
  wires. Assembly-review verified round 3: gate **139/0**.
- **R3-S2 (astra-x-r3):** the cord used to keep its r-7 bend at 125, so it would only have gone taut at ~146. Now it is
  cut taut at 125 (`CORD_L` 165.9, from the ledge hole to the knot in the tab). Its slack stores as a U while it fits,
  then as a J. Asserted: the length holds at 7 poses, it's straight at 125, the lead keeps 33 of slack there (≥ 10),
  and it never touches the lead. Mutations 4/4. Splice A (electronics' harness) lands on the ledge's zip-tie slots
  at s 158–161: a stationary tie point.
