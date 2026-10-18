# Hardware review 2: electronics' fixes (2026-10-18)

The items tagged [electronics] in `electronics-review/2026-10-18-CONSOLIDATED.md`, all done. Nothing committed, nothing
bought. **Checks, all green:**
- `perfboard.py` (both boards): the wire-clearance assert, plus a new **body keep-out** assert;
- `check_plugs.py` (new): every lead harmless on every header;
- `check_wiring.py` (new): wiring.yml matches perfboard.py, 18 BOARD labels, every endpoint;
- `schematic.py` (both), `wireviz`, `assembly_tables.py` (new: ASSEMBLY §3.1 / §3.6 generated from perfboard.py).

| Item | Closed by |
|---|---|
| **R1.1** wiring.yml net shift | Every label quoted, BOARD = perfboard.py net names (18), J_STAT 3, J_OLED 4, headers listed in hole order. `check_wiring.py` asserts the counts and every U1/U2 endpoint against perfboard.py's NETS. Re-rendered |
| **R1.2** cart | `bom.md` top: one goal-only counted cart with exact MPNs and DigiKey PNs, quantities and spares. Highlights: XIAO pre-soldered 102010636, SparkFun SEN-13963, Mill-Max 0973 pogo pins (2 per pole), Kingbright WP710A10ZGDK / WP710A10SURDK, Rubycon 10YXJ470M6.3X11 (UVR EOL), onsemi BC33740TA, Cherry MX1A-E1NN (plate-mount; MX1A-E1NW is the PCB-mount one), Waveshare 14657 OLED, FIT0610 only, 2 × Molex 146153-0100, LM66100 + PA0087 drop-in, Pololu housings, 3 jumper packs, 3 header and 2 socket strips, all resistors counted, plus bench supply and scope in tools. ASSEMBLY's parts list regenerated from it. **§0 rises:** per counter ≈ 315 (first table's units ≈ 385), first table ≈ 1,700–1,800, three tables ≈ 2,600–2,900 |
| **R1.3** buzzer inside the LIS3DH | Q2 stands in column 23 (flat to the USB end), R_BD / R_B / D3 / C1 / D1 / J_BZ re-placed by a search for body clearance. `perfboard.py` now asserts that no part **body** overlaps either module or another body |
| **R1.4** drawer contacts (electrical side) | Mill-Max 0973, 2 per pole; compression at the catch nominal 1.0 / min 0.6 / max 1.6 (sent to assembly-review B16 and to mechanical with every drawing dimension); ENIG targets recessed ≥ 1 mm, Mill-Max 3024 as fallback; FIT0610 switch bridged; coupon first. Drawer study §6, dimensions, ASSEMBLY §4 |
| **R1.5** low-battery margin (hardware) | README: the full-path drop table (0.55–0.7 V), firmware's 3650 / 3750 / 3950, the ≥ 3.1 V bench gate with the real path, and the LM66100 drop-in bought now (blocks reverse current; not a plain P-FET), fitted if the gate needs > 3.7 V. Per-unit VBAT calibration (`cal <mV>`) is an ASSEMBLY §5 step. NiMH/alkaline only. §0 battery ≈ 1.7–3.4 months |
| **R1.6** daylight margin | R_LED_B 680 → **270 Ω**, R_PU_B 22 k → **68 kΩ**: mode `b` ≈ 1.35× at minimum parts (was 0.34×), ambient ceiling 4.2× mode `a`; `a_boost` ≈ 5.7×; first-table default `a_boost` (≈ 1.2 months on NiMH until stepped down). Edge-time claim replaced by a bench measurement. Plan C (firmware) and plan D (TSSP40, not bought) recorded |
| Key J_BAT / J_OLED; harmless leads | J_BAT 3-pin, middle pulled; J_OLED 5-pin, pin 5 pulled, order SCL G SDA V with 100 Ω in SCL/SDA; R_S 100 Ω in GPIO5; R_LS 47 Ω inline at the IR LED; J_PT/J_LED moved and C_BTN placed so no housing can straddle two headers. `check_plugs.py` seats every housing everywhere along each header row, both ways round |
| Input protection | 1 kΩ from the beam node to GPIO19 and to GPIO2; 100 nF across J_BTN (C_BTN) |
| Plug retention | ASSEMBLY §6 step 8: hot glue on every housing and socketed resistor after calibration, leads tied within 20 mm, C1 and the switch joint glued (SLED-ASSEMBLY: mechanical) |
| Sleep acceptance split | base ≤ 25 µA (OLED off, blinks off) + the full device averaged over ≥ 4 blink cycles (≈ 40–55 µA): README, ASSEMBLY §7, troubleshooting |
| USB-sense divider | 6.8 k / 10 k (README, schematic, board, INTERFACES) |
| Delete the role strap | R_STRAP gone from the board, schematic, wiring, README (section replaced), ASSEMBLY |
| Buzzer | R_B 470 Ω; W_BZ twisted, on the far side of the duct from W_PTX; NiMH/alkaline only |
| Status-LED resistors | inline in the lead (R_R 680, R_G 220), the socket removed from the antenna end; R_S 100 on the board |
| Antenna | leads routed away from the XIAO's far end (ASSEMBLY §4); FPC antenna in the cart and troubleshooting (spot: mechanical) |
| Bring-up | first power from a 100 mA current-limited supply; TEFT4300 collector found with the meter before crimping (collector = shorter lead, Vishay drawing); OLED lead metered; phone camera only as a positive check (volts across R_LED instead); J_STAT in the plug list |
| Docs | wiring "grille" gone, README LED-on-D3 (role-strap section) gone, dimensions' stale rows (wire exits, C1, holder, OLED, contacts, board s 126–196, receiver tip 4.4), the old insert-guide links in ASSEMBLY's goal sections → SLED-ASSEMBLY |

**Left for the bench** (every one is a step in ASSEMBLY or README):
- the ≥ 3.1 V rail gate, which sets the cutoff;
- daylight in all three beam modes;
- edge times;
- I²C rise time;
- contact resistance and the mallet test;
- RSSI in the table;
- C1 screening;
- the OLED's active-area offset;
- the pogo hole size on the coupon.

## Lead's cuts after the §0 jump (2026-10-18)

- **Drawer:** a keyed wired lead with a slack loop to J_BAT; **no pogo pins or targets** (drawer study §7). The R1.4
  pin/target rows above are withdrawn.
- **Beam:** mode `a` stays the default; `a_boost`/`b` per table only if needed.
- **OLED:** the fleet uses an AliExpress module with the same outline after the first build.
- **§0 now:** per counter ≈ 235 at fleet quantity (first table's units ≈ 290), first table ≈ 1,350–1,450, three
  tables ≈ 1,850–2,100; battery ≈ 1.7–3.4 months in mode `a`.

## Round 3 (lead's calls on ee2-codex-r2 + ee2-fable-r2, 2026-10-18)

| Item | Closed by |
|---|---|
| R2-B1 LM66100 | Dropped from the cart and README: it wouldn't block the 120 mA charger. D1 stays |
| J_BAT | A polarized, latching **JST-PH** pair (Adafruit 261 halves): the board pigtail is soldered into (17,0)/(19,0); the battery lead ends in the plug. Both halves are metered before the first mating (ASSEMBLY §4.4). `check_plugs.py` and `check_wiring.py` updated |
| R2-B2 OLED harness | Waveshare 14657's PH2.0 plug can't fit the dash (mechanical), so 4 wires are soldered into its left-end 2.54 holes and its socket stays unused; `OLED_FLIP` 0 (firmware) |
| R2-S1 consistency | R_LED_B 270 everywhere (schematic, perfboard caption); J_OLED cavities 1 SCL / 2 GND / 3 SDA / 4 V / 5 plugged in INTERFACES = ASSEMBLY = wiring; J_BAT is 2-pin JST, so the numbering is plain 1/2; "drawer out = off" corrected (off = unplug J_BAT or take a cell out; USB-only tests: J_BAT unplugged); dimensions' placement table replaced with sled.py's as-built values |
| B2 text | README: 3.65 − (0.55…0.70) misses its own ≥ 3.1 V gate on paper, so the cutoff is provisional and the bench sets it (at 11 dBm below warn, with a chirp overlapping a POST, the final status, a depleted start-up); two-point VBAT calibration (firmware `cal` ×2, check ±20 mV at 3.6 / 3.65 / 4.5 V); ADC ±40 mV at ATTEN3 per Espressif |
| INTERFACES stale lines | ≤ 30 µA → the base ≤ 25 µA split; NiMH/alkaline only, never L91; "no leak" → negligible on paper, measured on the bench; OLED row |
| S6 | **R_BS 1 kΩ** at the board end of the button lead (plus the 1 k at the switch) |
| R2-S2 cable | Named: a 2-wire strip of **Adafruit 6181** silicone ribbon (24 AWG, flat 2.8 × 1.4); bend r ≥ 7 (mechanical); a separate cord is the drawer's stop |
| fable N3 | ASSEMBLY 3.5 now fits the pre-soldered XIAO |
| antenna | R_S8, R_S2, R_BTN (and R_S) moved ≥ 5 mm from the XIAO's far edge; only R_SCL is at 4.7 mm. RSSI + FPC fallback cover the rest |

### Round 3, part 3 (ee2-opus-r2)

- **JST-PH cable:** Adafruit **1131** (500 mm, socket + plug) cut in half, not the 261 (a 100 mm single-connector pigtail).
- **F1:** a 2 A fast pico fuse (Littelfuse 0251002.MXL) in the holder's + lead at the holder, ≈ 14 mV at TX. It is in
  the cart, schematic, wiring, ASSEMBLY §4 and the README's path table.
- **Drift:** fixed the keyed-Dupont J_BAT in dimensions, INTERFACES, bom, the README block diagram, the 3.45 V and boost-cost
  lines, Keystone and the perfboard comment. New `check_drift.py` greps the goal-counter documents for the dropped parts.
- **Nits:**
  - ASSEMBLY's duplicate J_BAT label and the §9 verb;
  - the §5.5 supply hook-up and the 100 mA first-power note;
  - hot glue as strain relief for the J_BAT pigtail.
- **§0:** ≈ 245 per counter (first table's units ≈ 350), first table ≈ 1,400–1,500, three tables ≈ 1,900–2,200. The JST pair,
  the fuse and a corrected per-device subtotal account for the change.
