# Electronics review (ee-review-fable, 2026-10-15)

Independent one-time review before parts are ordered. Read: INTERFACES §0/§2–4/§8–9, DECISIONS, electronics/*,
ASSEMBLY.md, firmware/include/*/board.h, firmware/lib/device/device.cpp, firmware/src/*/main.cpp, panel.cpp,
speaker.cpp, io.cpp. Checked against the Seeed XIAO ESP32-C6 schematic v1.0 (fetched; it confirms the README's
power path), the Kingbright / Vishay / NXP distributor data and the ESP-IDF 5.5 C6 docs.

## Verdict

1. **Buy after these fixes.** The circuits are sound; the problem is that the *drawings and the build guide for
   the goal counter still describe the pin map from before the 2026-10-15 D2/D8 change*, so a builder following
   ASSEMBLY.md gets a counter that never sees the beam and thinks a ball is a USB plug.
2. Fix before ordering because it changes the BOM: 2 × 68 k + 2 × 100 k more (goal VBUS dividers), and the lean
   resistor list is short on 2.2 k, 220 k, 10 k and 100 k anyway. Cheapest fix: order the resistor kit.
3. The lean first-table list is missing hook-up wire for the underside and the ~4.5 m the scoreboard needs.
4. Everything else is bench-verify or cheap hardening: hold the e-paper RST/CS through deep sleep and disable
   ROM logging on GPIO16, measure the DESPI-C02 D/C pin before trusting the role strap, 1 % ladder resistors.
5. Power budget and battery-life claims are plausible (arithmetic checked, ~5× margin to the 1-month target).

## Blockers

### B1. Goal counter: drawings, perfboard, wiring and ASSEMBLY still put the beam on D2 and have no VBUS divider

- Truth (approved): INTERFACES §2 `team/INTERFACES.md:74-75` and DECISIONS `team/DECISIONS.md:175`: beam RX on
  **D8/GPIO19**, USB VBUS sense on **D2/GPIO2** via 68 k / 100 k. Firmware implements it:
  `firmware/include/goal/board.h:16-18`, `firmware/src/goal/main.cpp:37-45`, `firmware/lib/device/device.cpp:420-423,448-449`.
- Stale: `electronics/README.md:213` (D2 = Beam RX), `:220` (D8 "free"), `:29` block diagram;
  `electronics/schematic.py:287-288` (goal left nets `D2 → BEAM_RX`, no VBUS block) and therefore `schematic.svg`;
  `electronics/perfboard.py:58` (`"BEAM_RX": ["X:D2", …]`, no R_VB1/R_VB2 in the goal PARTS) and therefore
  `perfboard.png/svg`; `electronics/wiring.yml:40` (U1 pin list has no D8, no 5V); `ASSEMBLY.md:235` (BEAM_RX =
  XIAO D2), `:243` ("5V, D6, D8–D10 stay free"), `:355` (calibrate by measuring D2), `:416-417` (troubleshooting
  "D2 is always…"); `electronics/bom.md:32` (one 68 k, "for USB sense", scoreboard only).
- Failure as built from ASSEMBLY.md with the current firmware: GPIO19 floats (no pull, high impedance) → random
  edges → phantom goals or none; the phototransistor drives D2 = VBUS sense, so every blocked beam (3.3 V) reads
  "USB plugged in" → the device refuses to sleep while a ball sits in the gate, and ext1 wakes on it.
- Fix (electronics, before ordering): in `perfboard.py` goal layout move `BEAM_RX` to `"X:D8"` and add
  `R_VB1 68k`/`R_VB2 100k` + nets `5V: ["X:5V", …]`, `VBUS_S: ["X:D2", …]` (row 9, cols 1–4 are free on the goal
  board, same place as the scoreboard uses); regenerate; update schematic.py (goal: D2 → VBUS_S, D8 → BEAM_RX,
  add the USB-sense block), wiring.yml, README pin map + block diagram, ASSEMBLY 3.1/3.6/6.5/troubleshooting, and
  bom.md (68 k × 3, 100 k × 5, see B2). Note in README that GPIO19 is not an ADC pin, so the "analog threshold
  fallback" sentence at `README.md:60-61` no longer holds (the socketed R_LED/R_PU knobs remain the fallback).

### B2. Lean first-table resistor quantities are short (and the kit is the cheaper fix)

`electronics/bom.md:28` orders "6 × 1 M, 2.2 k, 220 k, 3 × 10 k, 2 × 100 k, 4.7 k, 22 k, 1 k + spare 470 k".
Needed for 2 goal + 1 scoreboard (after B1):

| Value | Needed | Where |
|---|---|---|
| 1 M | 6 | 2 per device ✓ |
| 2.2 k | **2** (+2 spare 1 k, 2 × 470 Ω calibration) | R_LED per goal |
| 220 k | **2** (+2 × 470 k, 2 × 100 k calibration) | R_PU per goal |
| 10 k | **4** | 2 × R_STRAP, K3, R_A2 |
| 100 k | **5** (+2 calibration) | R_KEY, R_VB2, R_BD, 2 × goal R_VB2 |
| 68 k | **3** | R_VB1 on all three boards |
| 4.7 k, 22 k, 1 k | 1 each ✓ (no spare for the 1 k selector) | |

Fix: either buy the eBits 600-piece kit (39 kr, `bom.md:141`, covers all of it incl. calibration spares) or
raise the DigiKey quantities to 10 per value (~1 kr each). Prefer **1 % metal film** for R_KEY and the ladder
(see S4).

## Should-fix (before or while ordering)

### S1. No hook-up wire in the lean first-table list
`bom.md:21-48` has Dupont jumpers + heat-shrink only. ASSEMBLY needs "thin insulated wire for the underside"
(`ASSEMBLY.md:80-81`, ~30 joints per board) and **~4.5 m** for the scoreboard (`ASSEMBLY.md:454`: 13 LED wires,
6 × 25 cm RC522, 4 × 25 cm LED5, PCA9685 link). The per-device table has it (`bom.md:146`, eBits 24 AWG) but
no lean order includes it. 24 AWG silicone (1.6 mm OD) is thick for 2.54 mm underside runs; add a 28–30 AWG
silicone wire kit (AliExpress, order G, ~30 kr; or DigiKey 30 AWG Kynar wire-wrap wire) and keep the 24 AWG for the
battery/amp runs.

### S2. Option A amp hangs on VPACK with no reverse protection
`premium-sound.md:38-40`, `schematic.py:146-149`: the PAM8302 VIN and C_AMP (polar) sit **before D1**.
ASSEMBLY 5.1 (`ASSEMBLY.md:318-319`) promises "reversed battery plug? nothing is damaged" — true for the XIAO,
false for the amp and C_AMP on the scoreboard. The JST plug is keyed, but the splices (ASSEMBLY 4.4) are
hand-soldered red-to-red; a swapped splice kills the amp (−4 V on a 2–5.5 V part). Cheap fixes, pick one:
(a) keep VPACK feed but add to ASSEMBLY S2b/S5 "measure the pack plug + / − with the meter **before** the first
plug-in", (b) move the amp to VSYS (after D1): at 0.3 A audio peaks plus 0.25 A Wi-Fi the 1N5817 drops ~0.5 V,
the buck still regulates down to a pack of ~3.9 V and below that the rail just follows a little lower; you lose
~0.3 V of clipping headroom on the amp (≈ −1 dB), not a real loss. I'd do (a) now and keep (b) as the bench option.

### S3. Hold the e-paper RST/CS through deep sleep and silence ROM logging on GPIO16 (firmware, zero parts)
- D6 = GPIO16 = **U0TXD** (XIAO schematic "D6/TX"). The ROM bootloader prints on U0TXD at **every** reset and
  deep-sleep wake unless `esp_deep_sleep_disable_rom_logging()` is called (or the eFuse is burned). On the
  scoreboard GPIO16 is EPD RST (`board.h:18`), so each wake (incl. the 24 h heartbeat and motion wakes that draw
  nothing) toggles the SSD1683 reset with serial data, pulling the panel out of hibernate (5 µA) into normal
  idle. `panel.cpp:24` hibernates only when the app decides to sleep; if a wake path never touches the panel it
  stays awake until the next sleep. Also, in deep sleep GPIO16/18/19/20 float (no `gpio_hold_en` anywhere in
  `device.cpp:430-455`): a floating RST/CS for 19 h/day can let noise reset the panel or clock garbage into it
  and the RC522 (soft power-down exits on a register write; NSS = GPIO5 also floats).
- Fix: in `DeviceHal::deepSleep` (scoreboard only) drive RST, EPD CS and RFID CS HIGH, then `gpio_hold_en()` each
  and `gpio_deep_sleep_hold_en()`; call `esp_deep_sleep_disable_rom_logging()` once at boot; release the holds
  after wake. Then the "≤ 30 µA" acceptance (ASSEMBLY 7.2) actually measures what you think.
- README `electronics/README.md:324` already knows UART0 drives D6 ("off D6/D7: UART0 would hold D6 high") but
  only applied it to BUSY.

### S4. Key ladder windows vs 5 % resistors
`README.md:297-300`: 0 / 0.148 / 0.300 / 0.595 V. Firmware windows (`firmware/README.md:245`): K2 133–163 mV,
K3 270–330, K4 535–655, i.e. ±10 %. With 5 % resistors on both R_KEY and the ladder the ratio error alone is up
to ±10 %, leaving nothing for the ADC (±10–20 mV after calibration at 0 dB). A K2 press then logs "ignored: two
keys or noise". Fix: 1 % metal film for R_KEY, 4.7 k, 10 k, 22 k (the DigiKey singles are 1 %; the eBits kit:
check it says 1 %), and widen the firmware windows a little (K2 125–170, K3 260–340) — K1 < 40 mV and K4 ≥ 535
already have margin. Optional: 100 nF from KEYS to GND at J_KEY (RC with 100 k = 10 ms, fine for a 30 ms
debounce) to keep RF pickup off a 15 cm high-impedance lead next to the Wi-Fi antenna.

### S5. Verify the DESPI-C02 D/C pin before trusting the role strap on the scoreboard
The wrong-board guard (`README.md:230-233`, `device.cpp:70-81`) reads D7 with pull-up then pull-down and
expects the scoreboard to read (1, 0) because "D/C is a high-Z input at the panel". If the adapter has a pull-down
or pull-up on D/C the scoreboard reads (0,0)/(1,1) and **the scoreboard image refuses to boot** on a correctly built
board (and ASSEMBLY 5's "nothing breaks" note sends the builder hunting a solder bridge, `ASSEMBLY.md:410`).
I could not get the DESPI-C02 schematic (the only mirror I found is down). Fix: on arrival, meter D/C → GND and
D/C → 3.3 V on the adapter with the panel plugged in; anything under ~1 MΩ means add a 10 k pull-up on the
scoreboard's D7 (or invert the convention). 30 seconds, zero cost, and it should be a line in ASSEMBLY S4.

### S6. ASSEMBLY/BOM small inconsistencies that cost a builder time
- `ASSEMBLY.md:80` says "6 F–F Dupont jumpers, 20 cm, cut in half"; `ASSEMBLY.md:271-279` and `bom.md:29,144`
  say 3 **whole 30 cm** jumpers. Keep the 30 cm version.
- `ASSEMBLY.md:288`: the sensor's two plugs go "into one 2-pin housing" — no 2-pin Dupont housing is in any
  list; say "tape the two plugs together" or add a 10-pack of 2-pin housings (order G).
- `ASSEMBLY.md:607,611`: Ø2.5 mm drill for the LED strip; the tools list (`bom.md:103`) only has the 3.2 mm bit.
- `bom.md:139`, `perfboard.py:43`: a 470 µF 16 V in Ø8 × 12 has **3.5 mm** lead pitch; the layout puts the leads
  one hole (2.54) apart. Works with bent leads, but say so, or spec a 470 µF 10 V Ø6.3 × 11 (2.5 mm pitch) which
  also fits the 14 mm keep-out better.
- `ASSEMBLY.md:691-693` (S5 sound test): with option A the amp is fed from the pack, so a USB-only bench gives
  **no sound**. Add "cells in" to that step.
- `ASSEMBLY.md:376`: the ≤ 30 µA gate right after power-up will see the 470 µF's re-forming leakage (can be
  5–10 µA for minutes). Say "read after ≥ 10 min".

## Nice (verify on the bench, or small hardening)

- **Rail at cutoff.** `README.md:167`: at a 3.3 V pack a 250 mA TX burst (15 dBm, `board.h:45`) gives
  VSYS ≈ 3.3 − 0.05 − 0.35 ≈ 2.9 V, below the C6's 3.0 V VDD minimum; BOD (2.5 V) keeps it reset-safe, but between
  3.5 and 3.3 V the radio runs out of spec. Firmware already turns Wi-Fi off below cutoff. If the bench shows
  brown-out resets or failed POSTs near 3.4 V, raising CUTOFF to 3400 / WARN to 3600 costs ~3 % of NiMH capacity.
- **PCA9685 source drive.** Totem-pole outputs source only ~10 mA with a few hundred mV drop; the InGaN
  green/blue (Vf 3.3 V typ at 20 mA, ~2.6–2.8 V at 1–2 mA) through 220 Ω from 3.3 V will land around 1–2 mA, which
  is the ~1 mA plan (`README.md:359-360`) but leaves little headroom for "High" feedback flashes. Bench: measure
  one LED's current at full PWM; if blue is < 1 mA, drop the board's 220 Ω on the G/B channels to 100 Ω.
  (DECISIONS `team/DECISIONS.md:193` justifies common-cathode by Vf; polarity doesn't change Vf. The outcome is
  fine: common cathode is right for "off = LOW" with the library defaults.)
- **Beam timing margin is better than stated.** TEFT4300 tr/tf are ~2 µs at the datasheet load; scaling to
  220 k gives ~0.5 ms, so the README's "≤ 2 ms" is conservative. OK.
- **Option A pop.** The amp's 1 µF input cap through R_A1+R_A2 = 11 k settles with τ ≈ 11 ms; the 20 ms lead-in
  (`speaker.cpp:16`) is ~2τ. If it pops, use 40 ms.
- **R_A1/C_A1 at (8,8)/(9,7)** sit ~2 mm past the XIAO's antenna end (`perfboard.py:87`, antenna at the far
  end per `dimensions.md:18`, "metal ≥ 5 mm"). Small parts, probably fine; if RSSI is poor on the scoreboard,
  that is the first thing to move one column right.
- **DESPI-C02 RESE.** Good Display's GDEY042T81 page doesn't state the RESE value; the adapter offers 0.47 Ω /
  3 Ω. 3 Ω is the usual SSD168x setting and matches what GxEPD2 users report; confirm against the panel spec PDF
  on arrival (a wrong RESE shows as faint/uneven refresh, not damage).
- **ADC fallback gone.** With the beam on GPIO19 there is no analog read of the receiver; the two socketed
  resistors are the whole calibration path. Fine, just stop promising the fallback (B1).
- **Sleep extras.** Scoreboard sleep adds C_AMP leakage (~2 µA) and the PAM8302 clone's own leakage if its SD
  pull-up is missed (0.5 mA → the ASSEMBLY S2b check catches it). Expect ~35–45 µA, not 27+12; immaterial
  (< 1 mAh/day).
- **Lithium L91 (5.4 V fresh):** 5.2 V on the BAT pad is within the SGM6029C's 5.5 V max and the PAM8302's 5.5 V;
  OK but with no margin for a 6th-cell mistake. README already says it.

## Verified OK (so lead knows what was checked)

- **XIAO power path** (schematic v1.0 2024-03-28, fetched): U1 **SGM6029C** buck (L1 0.47 µH), U3 **SGM40567-4.2**
  charger (I_chg 120 mA via 200 k), Q2 LN237 PMOS on the BAT path, D1 LMBR4010 Schottky from VBUS to the buck,
  R22 10 k on GPIO3 (RF switch), R24 5.1 k on GPIO14, R18 1.5 k + yellow LED on GPIO15, U0TXD = GPIO16 (D6),
  U0RXD = GPIO17 (D7). Matches `README.md:113-147`. 1N5817 in series blocks the charger from the AAs ✓; VBAT
  divider before the diode ✓; "5V" pin is VBUS (0 V on battery) ✓ so the 68 k/100 k sense is valid.
- **Pin conflicts / straps:** C6 straps are GPIO4/5 (SDIO edge only), 8, 9, 15; none used except 4/5 as RC522
  MISO/CS, harmless. LP GPIOs 0–7 ✓ for every ext1 wake (D0 ADC, D1 INT1 HIGH, D2 keys LOW / VBUS HIGH, GPIO6
  VBUS HIGH); per-pin ext1 levels are a C6 feature and the firmware uses `esp_sleep_enable_ext1_wakeup_io` ✓.
  GPIO19 beam RX: light-sleep GPIO wake on any pin ✓ (`main.cpp:43`).
- **Role strap polarity is on the safe board** (goal has the 10 k): a missing strap makes a goal board boot as a
  scoreboard, which only reads D3 ✓. Goal firmware leaves D7 floating after the read ✓ (`device.cpp:80`).
- **I²C:** LIS3DH 0x18/0x19 + PCA9685 0x40, no clash; pull-ups 4.7–10 k on both boards in parallel (~3 k) draw only
  while a line is low ✓. SDO_PU_DISC write (CTRL_REG0 = 0x90) is the right register ✓ (`device.cpp:141`).
- **SPI sharing:** e-paper uses no MISO; RC522 gets its own (GPIO4); one `SPI.begin(19, 4, 18, 20)` ✓
  (`panel.cpp:14`), mode 0, 4 MHz ✓, CS idle HIGH.
- **Beam optics:** 0.72 mW/sr per mA × 1.0 mA / 5.6² cm² = 0.023 mW/cm² × 3.2 mA/(mW/cm²) = 73 µA typ ≥ 11 µA needed
  for V_IL with 220 k ✓ (6.5×); worst-case datasheet minima ≈ 1×, covered by the socketed knobs ✓. Dark current
  ≤ 200 nA → ≤ 44 mV ✓. LED (3.3 − 1.3)/2.2 k ≈ 0.9 mA ✓, GPIO21 can source it ✓. Reversed LED plug: 3.3 V < 5 V V_R ✓.
- **Ladder levels** 0/0.148/0.300/0.595 V, all < V_IL 0.825 V ✓ for ext1 LOW; ADC at 0 dB ✓ (`main.cpp:30`).
- **USB sense:** 5 V × 100/168 = 2.98 V (≥ 2.85 V worst 5 %) > V_IH 2.48 V ✓; 0 V on battery via the 100 k ✓.
- **Buzzer driver:** BC337-40, 1 k base → I_B 2.6 mA, I_C ≤ ~230 mA peak, well within hFE·I_B ✓; 100 k pull-down
  keeps it off while GPIO7 floats at boot ✓; flyback diode orientation in ASSEMBLY ✓ (band to the + side).
- **Speaker path:** 2 × RC at 15.9 kHz ✓; −90 dB at 2.8 MHz ✓; PDM one-line-DAC exists in IDF 5.5 for the C6
  (`I2S_PDM_TX_CLK_DAC_DEFAULT_CONFIG`, `speaker.cpp:32-35`) ✓, bench item as documented.
- **Perfboard nets** (`perfboard.py` NETS vs ASSEMBLY 3.6 / S2 tables, 0- vs 1-indexed): every joint matches,
  D1/C1/D3 polarities match the schematic, pad-wire holes match, no two nets share a hole.
- **Power budget arithmetic:** goal 11 mAh/day → 1700/11 ≈ 155 d ≈ 5 months ✓; scoreboard 12.7 → 134 d ≈ 4.4 ✓.
  The soft spot is the 1.0–1.5 mA "associated, light sleep" line: Espressif's 0.4 mA assumes DTIM3 and a quiet
  AP; a busy office SSID with broadcast traffic can be 3–5 mA, which halves life but still clears 1 month by 2–3×.
- **BOM part choices:** common-cathode Kingbright ✓ (DigiKey confirms CC, Vf 1.9/3.3/3.3 V typ); CMT-1209-390T is a
  passive magnetic transducer ✓; PCA9685 Adafruit 815 has the 220 Ω series resistors ✓ and OE is pulled low on the
  board (bridging it is harmless); USB-C M→F "full-featured with CC" is the right spec for a C-to-C source ✓;
  LIS3DH clone requirements (C3H, no LED, bypass LDO, CS→VCC) and the ≤ 30 µA gate are correct ✓.

## Before you click buy

- [ ] B1 done: `perfboard.py`/`schematic.py`/`wiring.yml`/README/ASSEMBLY/bom all say beam = **D8**, VBUS = **D2**
      with 68 k/100 k on every goal board; pictures regenerated.
- [ ] Resistors: the 600-piece kit **or** 10 each of 1 M, 2.2 k, 220 k, 10 k, 100 k, 68 k, 4.7 k, 22 k, 1 k, 470 Ω,
      470 k (1 % for R_KEY and the ladder).
- [ ] 28–30 AWG hook-up wire (≥ 10 m, 3+ colours) added to an order; 24 AWG only for the battery/amp runs.
- [ ] 2 × 470 µF spec says Ø6.3 × 11 (2.5 mm pitch) **or** note "bend leads to 2.54".
- [ ] 2-pin Dupont housings (or "tape the plugs") and a Ø2.5 mm drill bit on the tools list.
- [ ] ASSEMBLY S4 gets "meter D/C → GND / 3V3 on the DESPI-C02 before flashing" (S5), S5 gets "cells in for the
      option-A sound test", 7.2 gets "sleep current after ≥ 10 min".
- [ ] Firmware ticket: `gpio_hold_en` on EPD RST/CS + RFID CS, `esp_deep_sleep_disable_rom_logging()`, ladder
      windows ±12 %.
- [ ] Decide S2 (amp polarity): at least the "meter the pack plug first" line in S2b/S5.
