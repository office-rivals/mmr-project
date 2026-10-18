# Goal-counter hardware review 2: consolidated fix list (lead, 2026-10-18)

Reviews (blind brief `team/briefs/ee-review-2.md`): `2026-10-18-ee2-codex.md` (GPT-6-Astra high),
`2026-10-18-ee2-fable.md` (Fable 5.1 xhigh), `2026-10-18-ee2-opus.md` (Opus 5.5 max),
`2026-10-18-ee2-astra-x.md` (GPT-6-Astra xhigh). Verdicts: all four "buy after fixes"; confidence first time
low / ≈ 90 % / ≈ 80–85 % / < 50 %. The user asked lead to decide and fix without asking, then re-review.

Tag = who found it (C codex, F fable, O opus, A astra-x). Owner in brackets. **Nothing is bought until round 2
passes.**

## R1. Blockers

1. **Wiring diagram nets shift** (C-B1, verified by lead): unquoted commas in `wiring.yml` flow lists split
   labels; the render maps GPIO16/D6 to 5 V and J_STAT to 4 pins. Quote every label, regenerate, and add a
   generation assert (BOARD has 18 labels, J_STAT 3, named endpoints match `perfboard.py` NETS). [electronics]
2. **The cart can't build two counters, and parts are unnamed** (C-B4/B5, F-B1/B2, O-B1/B2, A-B5). Issue one
   goal-only counted cart with exact MPNs/listings and spares:
   - resistors incl. 220 Ω (R_G), 680 Ω (R_R + R_LED_B), 150/330 Ω tuning, all 100 k / 1 k counts;
   - housings 2/3/4(5)-pin with spares (incl. the keyed J_BAT and J_OLED below), male header ×3 strips,
     machined socket ×3 strips, jumpers 3 × 20-packs, the XIAO **with headers** (or count its 28 pins);
   - **pogo pin: one exact Mill-Max part** whose drawing gives stroke ≥ 1.5 mm, working compression, collar-to-tip
     and barrel Ø (O names 0973-0-15-20-77-14-11-0; F names the 0906 family): pick, attach the drawing values to
     dimensions.md for mechanical;
   - exact status LEDs (InGaN 520–530 nm green, AlInGaP red, 3 mm diffused), exact OLED listing (SSD1306, pin
     order photo), exact MX blue variant (plate-mount), BC337-40 maker, current-production C1 (UVR1A471MED is EOL:
     pick a current low-leakage part or MLCC);
   - **LIS3DH: the SparkFun SEN-13963 for the first table** (A/C challenge; clone later, after a reference works);
   - **FIT0610 only** (the Keystone 2487 fallback doesn't fit the lane: A-B2);
   - 2 × U.FL 2.4 GHz FPC antennas (O-S4: decide after the in-table RSSI test);
   - the drop-in alternative for D1 (see R1.5) bought now, so the bench decides without a re-order;
   - tools: a current-limited bench supply and access to a scope (or a cheap USB scope) for R1.5/R1.6.
   Regenerate ASSEMBLY's parts checklist from the cart (F-S7, O-S9). [electronics]
3. **Buzzer driver inside the accelerometer footprint** (C-S1, F-S2, A-B2): move Q2 + R_BD out of the module
   outline (row 7), re-run `perfboard.py` with a body-keep-out assert, not just holes. [electronics]
4. **Drawer contacts can't be built as drawn and are unsafe when pulled** (A-B1, O-S2/S3, F-S5, C-S2):
   - **gold targets** (8 × 8 squares cut from ENIG PCB, lead soldered to the back), each **recessed ≥ 1 mm in its
     own pocket** only the plunger reaches, with a rear joint pocket, a lead feed-through and strain relief; no fuse
     (recess instead: a fuse eats the TX margin);
   - **2 pogo pins per pole** (redundancy against fretting), stand-offs set to the chosen pin's working
     compression; latch force re-checked for 4 pins;
   - a small **contact coupon** (pin wall + target pocket) printed before the full drawer;
   - bridge the FIT0610's slide switch (O-S10). [mechanical, electronics]
5. **Low-battery rail margin** (C-B2, F-S1, O-S5, A-B3): the full path drops ≈ 0.55–0.7 V at a TX burst, so the
   3.45 V cutoff can put the rail at ≈ 2.8–2.9 V. Decisions:
   - firmware: default cutoff **3650 mV** (warn/resume raised to match), server-tunable; never overlap the chirp
     with a POST (chirp first); no NVS write during TX near cutoff; brown-out detector ≥ 2.7 V; per-unit VBAT
     calibration against a meter (ASSEMBLY step). [firmware, electronics]
   - hardware: keep D1 for build 1, but buy and footprint a **low-loss reverse-blocking drop-in** (an
     LM66100-class ideal-diode module that never lets the charger charge the AAs: not a plain P-FET). Bench gate:
     ≥ 3.1 V on 3V3 at the cutoff with the real holder, pogo pins and lead, max sound + OLED + TX. If the gate
     needs a cutoff above ~3.7 V, fit the drop-in. [electronics]
6. **Daylight optical margin** (C-B3, A-B4; O challenge 5): mode `b` has ≈ 0.34× margin at min parts, mode `a`
   ≈ 0.91×. Decisions (DC beam kept: F and O agree it's right; TSSP40 documented as plan D, not bought):
   - electronics: re-size the boost (R_LED_B) so mode `b` meets the LOW threshold at min parts with margin; keep
     the sockets; **first-table default mode `a_boost`** (config);
   - mechanical: deeper receiver shroud/aperture to cut ambient; confirm the black filament is opaque at 940 nm;
   - firmware: plan C, an ambient-subtracting chopped read (LED on/off, ADC) when `ambient_high` persists (no new
     hardware); edge-time claim replaced by a bench measurement;
   - bench gate in the real table incl. worst daylight. [electronics, mechanical, firmware]

## R2. Should-fix (before the first unit, all cheap)

- **Key J_BAT** (O-S1, A-S5): 3-pin header, middle pin pulled; 3-cavity housing, middle plugged. **Key J_OLED**
  (F-B3): 5-pin, pin 5 pulled. Every other lead must be harmless on any header. [electronics]
- **Input protection** (C-S6, A-S5): 1 k series from the beam node to GPIO19/GPIO2 (check the optical margin), 100 nF
  across J_BTN (F-N3). [electronics]
- **Plug retention** (F-S4, O-S8, C-S6): hot-glue dab on every housing and socketed resistor after calibration; tie
  leads within 20 mm; hot-glue C1. ASSEMBLY + SLED-ASSEMBLY. [electronics, mechanical]
- **Sleep acceptance split** (all): base ≤ 25 µA with OLED unplugged and blinks off; full device measured as an
  average over several blink cycles. [electronics]
- **USB-only phantom pack** (O-S6, A-S4): firmware ignores VBAT while VBUS_S is HIGH. [firmware]
- **USB-sense divider 6.8 k / 10 k** (O-N1) and `rtc_gpio_pullup_dis(6)` before sleep. [electronics, firmware]
- **Delete the role strap** (F-C1): one image only now; drop R_STRAP and the boot check. [electronics, firmware, twin]
- **I²C 100 kHz default** (C-S5, A-S2), raise only after a rise-time measurement. [firmware]
- **Buzzer** (A-S3, F-S8, O-N3): R_B 1 k → 470 Ω; twist W_BZ and route it away from W_PTX; NiMH/alkaline only
  (or duty cap when VBAT > 5 V). [electronics, firmware]
- **Status-LED resistors inline in the lead** (F-C3/S6), away from the antenna end. [electronics]
- **Antenna**: leave a stick-on spot for a U.FL FPC antenna on the dash/lid; route J_OLED/J_PT leads away from the
  XIAO's far end (O-S4, F-S6). [mechanical, electronics]
- **Bring-up** (A-S6, F-S9): current-limited first power; TEFT4300 collector found with a meter before crimping;
  meter the J_OLED lead; phone camera only as a positive IR check; J_STAT in the plug list. [electronics]
- **Docs** (all): SLED-ASSEMBLY/board.h/dimensions stale rows (12 × 12 tactile, GPIO5 spare, old placements),
  ASSEMBLY's links to the old insert guide, README LED-on-D3, wiring.yml "grille". [owners]

## R3. Noted, not now

PCB carrier for units 3+ (all four); swapping the beam sides (O); a TSSP40 modulated receiver (plan D, C/A). Each
waits for the first unit's bench data.

## Outcome (lead, 2026-10-18, after rounds 2 and 3)

All four reviewers, final: **OK to buy the first-table parts** (codex, astra-x: "for staged qualification"; fable
≈ 92 % first time; opus ≈ 95 %). Round 2 added: LM66100 dropped (it would charge the AAs), JST-PH battery plug
(Adafruit 1131) + 2 A fuse, the drawer by a wired lead + stop cord (no pogo pins), the OLED wired to its holes, plan C
at 3 ms (+ OLED redraw in its own task: twin), TX 11 dBm below warn, R_R back on the board, harness/cord recipes.
Lead-verified: sled + roll test, gate 139/0, check_plugs, check_wiring, check_drift, perfboard, firmware 55/55 +
contract 30/30 + build, twin 19/19.

**Open by design (first-unit bench gates, before unit 2):** the low-battery rail ≥ 3.1 V at both TX powers (sets
the cutoff), daylight/optics in every mode incl. plan C timing, uplink at 11 dBm in the table, sleep current + C1
leakage, two-point VBAT calibration, USB + cells charge current and reversal, I²C rise time, drawer/plug endurance,
false goals. Measured part ESTs: OLED socket/offset, board heights.
