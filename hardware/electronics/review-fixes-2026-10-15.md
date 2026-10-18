# Electronics review fixes (2026-10-15)

This answers lead's action on `electronics-review/CONSOLIDATED.md`: items A1–A4 and B2–B10, the
electronics rows. Evidence is in `ee-review-fable.md` and `ee-review-codex.md`. Values marked EST are
unmeasured (PROTOCOL rule 11).

## Blockers

**A1. Goal counter redrawn: beam RX on D8, USB sense on D2.** Done.
- `schematic.py`, schematic.svg:
  - D2 is VBUS_S, D8 is BEAM_RX, 5V is a pin.
  - New USB-sense block: 68 k / 100 k, both 1 %.
  - LIS3DH label: clone or SparkFun, 0x19 or 0x18.
  - The D2 ADC-fallback note is gone.
- `perfboard.py`, perfboard.png/svg:
  - R_VB1 sits at (1,9)–(2,9) and R_VB2 at (3,9)–(4,9), 0-based (ASSEMBLY (2,10)–(5,10)).
  - Nets: BEAM_RX goes to X:D8, 5V goes to R_VB1, VBUS_S goes to D2 and the divider middle.
  - The router assertion passes on both boards.
- `wiring.yml`, wiring.png/svg: U1 has D8 and 5V; BOARD has VBUS_S and 5V.
- `README.md`:
  - Block diagram and goal pin map updated (D2 USB sense; D8 beam RX, digital only; D9/D10/D6 free).
  - The optics text no longer promises an ADC fallback.
  - The calibration line now says D8.
- `ASSEMBLY.md`:
  - **Parts list:** 1 % resistors incl. 68 k/100 k.
  - **3.1 / 3.6:** R_VB1/R_VB2 rows; nets BEAM_RX = D8, 5V, VBUS_S, GND + R_VB2; "D8, not D2" warning.
  - **3.8 checks:** D8 beeps to J_PT RX, D2 doesn't; the divider; D1 diode mode.
  - **5.2 power-on:** 5V and D2 below 0.5 V on batteries, ≈ 3 V on USB.
  - **§6:** calibrate on D8 and record the fitted resistor pair on the device_id label.
  - **Troubleshooting:** D8 rows, plus a new "never sleeps / ball keeps it awake" row (beam on D2).
- `bom.md`: 68 k × 5 and 100 k × 8 in the counted cart.

**A2. One counted first-table cart.** Done. `bom.md` has a new *First-table cart: exact counts* table:
- **Resistors:** 1 % metal film in 16 values, with spares.
- **Calibration and attenuator alternatives:** 470 Ω, 1 k, 100 k, 470 k, and 680 Ω, 2 k, 2.2 k.
- **Capacitors:** 470 µF ×5 (now 10 V Ø6.3 × 11, 2.5 mm pitch), 100 nF ×5, 10 nF ×2, 1 nF ×2.
- **Other parts:**
  - 1N5817 ×5;
  - an optical spare pair;
  - 6 RGB LEDs;
  - **40 jumpers** (6 per goal counter, one per wire);
  - 10 two-pin housings;
  - a machined socket strip (plain female headers don't grip resistor leads);
  - ≥ 15 m of 30 AWG wire.
- **ASSEMBLY:** the per-device parts list and the section 4 lead table say two jumpers per lead.
- **Order A (DigiKey):** ≈ 576 → ≈ 755 kr. All of it stays in one DigiKey order, because the goal
  counters need it on day one.

**A3. Amp moved to VSYS, after D1.** Done.
- **Drawings:** schematic (tag VSYS, the note says it is muted on USB) and perfboard (J_AMP "+" is now
  on the VSYS net, wired from the BAT+ wire hole). The legend is updated.
- **`premium-sound.md`:** circuit, reasons, about −1 dB headroom, loudness now EST 75–77 dB SPL.
- **ASSEMBLY:** S2 table, nets and continuity check (J_AMP + beeps to VSYS, not to J_BAT +); S2b
  item 7 and S5 (option A plays on batteries only); the 5.1 pack-polarity meter check before the
  first plug-in.
- **INTERFACES §8:** sound row updated.
- **Firmware** has the mute-on-VBUS item (confirm below).

**A4. Provisional thresholds: warn 3600 / cutoff 3450 / resume 3800 mV.** Done in README (table,
reason, a bench scope procedure), INTERFACES §3 and README L280/L337. Firmware's `board.h` already
has 3600/3450.
- **Capacitor claim fixed:** the 470 µF only smooths µs edges; 350 mA for 1 ms would drop 0.75 V on
  it alone.
- **§0** is now a range (B7).

## Should-fix

- **B2 (1 % ladder).** In the cart and in S7. ASSEMBLY S2 adds an optional 100 nF across J_KEY (a
  10 ms filter with the 100 k, inside the 30 ms debounce). Firmware owns widening the K2/K3 windows.
- **B3 (DESPI D/C).** ASSEMBLY S4 step 1: meter D/C to GND and to 3V3 on arrival; both should read
  > 1 MΩ.
  - Firmware calls only (0,0) a goal counter, so a pull-down on the adapter would turn a scoreboard
    into "goal".
  - **Fix:** a 10 kΩ from D7 (14,10) to 3V3 (19,10). A spare 10 k is in the cart.
  - **Firmware:** if that pull-up is fitted, hold D7 HIGH in deep sleep (see the firmware message).
- **B4 (clone amp).**
  - **Buy requirements:** SD pin, input caps on A+/A−, a ceramic bypass and a printed pin order.
    These are in bom, premium-sound and ASSEMBLY S2b step 0.
  - **SD pull-up:** trace it and measure SD → VIN before and after removal.
  - **Gain:** start at minimum (pot at minimum, or R_A3 = 470 Ω across IN+ and GND). Set the ceiling
    on a 3.45 V supply by stepping R_A3 up through 680 Ω, 1 k, 2 k and 2.2 k. The R_A3 maths is in
    premium-sound: 1.1 k ≈ ÷ 11, and the C_A2 pole moves to ~150 kHz, ≈ −70 dB at 2.8 MHz.
  - **Speaker:** both terminals float (BTL); never to GND.
- **B5 (green/blue LED headroom).**
  - README *LEDs*: G/B current is ≈ 1–2 mA EST, with little headroom.
  - Buy 6 for the first table and check all 6 colours at 3.45 V before buying the other 10 (bom
    lean row, S20, the 3-table row).
  - ASSEMBLY S5: if green or blue is dim, a second 220 Ω on top of the PCA9685's resistor (≈ 110 Ω).
    Never a bridge.
  - The README's SLEEP claim is fixed: firmware writes the outputs off, then sets SLEEP.
- **B6 (optics).**
  - **README:** minimum margin 0.91× (a miss, stated), with the datasheet test conditions. The 56 mm
    path is explained as 40 + 12 + 4 (was "2 × 8"). The receiver view is ±20° (tip 4 mm behind the
    aperture), not ±10°. The bench tests with the room lights on.
  - **TEFT4300 polarity from the Vishay drawing (6.544-5269.01-4):** collector = the shorter lead, on
    the flange-flat side. It's in README, dimensions.md, ASSEMBLY section 4 step 3 (green on the
    collector) and wiring.yml.
  - **Calibration:** the resistor pair per sled is recorded on the label (§6).
  - **Spares:** an optical spare pair and the resistor alternatives are in the cart.
- **B7 (battery as a range).** README goal and scoreboard budgets are rewritten with typical and
  pessimistic columns. They now include:
  - the RF-switch pull-up (1.55 mAh/day);
  - firmware telemetry (goal 2.0, scoreboard 0.6 mAh/day);
  - 160 goals/day per counter and **320 goal updates/day on the scoreboard** (both goals);
  - capacitor leakage;
  - the 3.45 V cutoff (≈ 1630 mAh usable).

  Results:

  | | Typical | Pessimistic | Life (typical–pessimistic) |
  |---|---|---|---|
  | Goal counter | ≈ 14.6 mAh/day | ≈ 25 mAh/day | **≈ 3.6 / 2.1 months** |
  | Scoreboard, speaker (A) | ≈ 16.5 mAh/day | ≈ 21.5 mAh/day | **≈ 3.3 / 2.5 months** |
  | Scoreboard, buzzer (B) | ≈ 14.1 mAh/day | ≈ 19 mAh/day | ≈ 3.8 / 2.8 months |

  - **INTERFACES §0:** goal ≈ 2–3.5 months EST, scoreboard ≈ 2.5–3.3 (speaker) / 2.8–3.8 (buzzer).
  - **The 1-month target** (54 mAh/day) keeps ≥ 2× margin even pessimistic.
  - **Biggest new knob:** firmware's telemetry flush (2 mAh/day on the goal counter).
  - **470 µF:** specified as 10 V Ø6.3 × 11, 2.5 mm pitch (e.g. Nichicon UVR1A471MED), leakage
    ≤ 2 µA after 10 min (bench).
  - **Scoreboard sleep:** 35–55 µA EST; the ≤ 30 µA clone acceptance is measured on a goal counter.
- **B8 (buzzer schematic).** R_BD now hangs off the BC337 base side, after the R_B socket, matching
  the layout. The 2N4401's E-B-C pinout ("turn it round") is noted in bom S17 and ASSEMBLY S2.
- **B9 (exact variants, delivery).**
  - **New bom *Suppliers* table:** what each clone must have, what to reject, and to record the URL,
    variant and both-side photos at checkout. The USB-C extension must power the XIAO and enumerate
    in both plug orientations.
  - I can't pin a stable AliExpress SKU from here (no listing schematics). The checkout record is the
    pin.
  - **OpenELAB:** now 5–10 working days from China.
  - **Fast plan:** re-dated for an order on Fri 16 Oct. Goal counters arrive by ≈ 21 Oct; the
    scoreboard by ≈ 6 Nov.
- **B10 (stale text).**
  - **ASSEMBLY:** "20 cm jumpers cut in half" is gone (6 × 30 cm). The S6 reader orientation is v5
    (behind the face, loop end up). "Read after ≥ 10 min" added to 7.2 and S2b. Sound test: cells
    in, USB unplugged.
  - **dimensions.md:** reader orientation is v5, and the v4 row is marked superseded.
  - **bom:** the superseded all-Danish list and its ≈ 2,000 kr row are deleted. The Ø2.5 mm drill
    bit is in both tools lists.

## Costs (INTERFACES §0)

| | Before | Now |
|---|---|---|
| Per goal counter | ≈ 125 kr | **≈ 140 kr** (USB divider, 6 jumpers, wire, socket) |
| Per scoreboard | ≈ 600 / 620 kr | **≈ 610 / 630 kr** |
| First table | fast ≈ 1,370–1,520, cheapest ≈ 1,220 | **fast ≈ 1,545–1,695, cheapest ≈ 1,300** (counted cart +≈ 175) |
| Three tables | ≈ 3,120–3,320 kr | **≈ 3,240–3,440 kr** |

The cheapest plan now buys the PCA9685 clone from AliExpress, because order A stays above DigiKey's
free-shipping line without it.

## Open / for others

- **Firmware:**
  - confirm option A is muted while VBUS is present;
  - hold D7 HIGH in deep sleep if the DESPI pull-up fix is fitted;
  - B1 (hold RST/CS, ROM log off) and the B2 windows are theirs.
- **Mechanical:** the TEFT4300 collector is the shorter lead on the flat side. Their cradle doesn't
  key the flat, so the builder goes by the lead length.
- **Bench (first table, section C):**
  - the loaded-rail scope at 3.45 V;
  - sleep current per device;
  - all 6 colours at 3.45 V;
  - optical calibration;
  - the amp ceiling and pop;
  - DESPI D/C;
  - the USB-C extension in both orientations;
  - the 470 µF leakage.
- **Presenter and video:** told about §0 (rule 10).

## Update after firmware's 300 s telemetry flush (lead approved)

Telemetry per day is now 0.6 typical / 2.4 pessimistic on both devices (firmware). Totals:
- **Goal counter:** ≈ 13.2 / 25.4 mAh/day, so **≈ 4.1 / 2.1 months**.
- **Scoreboard, speaker:** ≈ 16.5 / 23.3 mAh/day, so ≈ 3.3 / 2.3 months.
- **Scoreboard, buzzer:** ≈ 14.1 / 20.8 mAh/day, so ≈ 3.8 / 2.6 months.

§0 now reads: goal ≈ 2–4 months, scoreboard ≈ 2.3–3.3 (speaker) / 2.6–3.8 (buzzer), all EST. Firmware
also holds D7/EPD DC HIGH in deep sleep (the S4 pull-up draws nothing) and mutes option A on USB.
