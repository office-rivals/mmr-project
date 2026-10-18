# Electronics review: consolidated actions (lead, 2026-10-15)

Two independent reviews: `ee-review-fable.md` (Claude Fable 5.1) and `ee-review-codex.md` (Codex GPT-6-Astra).
Both say **buy after fixes**. Nothing is ordered until every A item below is closed and electronics has posted
an updated "buy it like this" list.

## A. Blockers (fix before ordering)

| # | Finding (found by) | Decision / fix | Owner |
|---|---|---|---|
| A1 | Goal-counter schematic, perfboard, wiring.yml, README, ASSEMBLY (+ calibration step) still put the beam on **D2** and have **no VBUS divider**; firmware/INTERFACES use **D8** + 68k/100k on D2. A board built today never counts (both) | Redraw the goal counter NOW (don't wait for the sled): beam RX → D8/GPIO19, VBUS 68k/100k → D2; remove the D2 ADC-fallback claim; update every artefact + the BOM | electronics |
| A2 | Lean resistor list is short (2.2k, 220k, 10k, 100k, 68k) and each goal device needs **6** single 30 cm jumpers, not 3; no hook-up wire listed (both) | One counted first-table cart: buy a **1 %** resistor kit + the exact counts table (codex S1), 6 jumpers per goal device, hook-up wire, a few 2-pin Dupont housings, spare optical pair + R_LED/R_PU alternatives (470 Ω, 1 k, 100 k, 470 k) | electronics |
| A3 | Speaker amp on raw VPACK before D1: a reversed splice kills amp + C_AMP; with USB only, SD is driven while the amp is unpowered (both) | **Move the amp to VSYS (after D1)** (≈ −1 dB headroom, accepted) so it's reverse-protected and powered whenever the MCU is; firmware **mutes option-A playback while VBUS is present** (bench/flashing only, the charger can't feed 0.3 A peaks). Add the pack-polarity meter check before first plug-in | electronics + firmware |
| A4 | 3.3 V pack cutoff lets the C6 run below its 3.0 V minimum during TX (≈ 2.85–2.9 V); the 470 µF can't carry ms bursts (both; codex blocker, fable nice) | Provisional thresholds **warn 3600 / cutoff 3450 / resume 3800 mV** until the bench scope measures the loaded 3V3 rail at TX + refresh + scan + sound; fix the README's capacitor claim; update §0 battery life (≈ −3–5 %) | electronics (numbers) + firmware (constants) |

## B. Should-fix (in the same pass)

| # | Finding | Fix | Owner |
|---|---|---|---|
| B1 | D6/GPIO16 is U0TXD: ROM logging toggles EPD RST every wake; RST/CS/RFID-CS float in deep sleep (fable) | Disable ROM logging at boot; drive + `gpio_hold_en` EPD RST, EPD CS, RFID CS high in deep sleep, release on wake | firmware |
| B2 | Key-ladder windows ±10 % vs 5 % resistors (fable) | 1 % ladder resistors (A2); widen K2 125–170 / K3 260–340 mV; optional 100 nF at J_KEY | firmware + electronics |
| B3 | DESPI-C02 D/C pin may have a pull: the wrong-board guard could reject a correct scoreboard (fable) | ASSEMBLY S4: meter D/C on arrival; < ~1 MΩ → add a 10 k pull-up on D7 or invert the convention | electronics |
| B4 | Clone amp: continuity beep can't find a several-kΩ pull-up; gain procedure unsafe (starts at max) (codex) | Trace + measure SD pull-up; start at minimum gain, set the ceiling at the lowest pack voltage; add an attenuation-resistor assortment; require a clone with SD + input caps | electronics |
| B5 | Green/blue LED headroom at 3.3 V through PCA9685 + 220 Ω (both) | Buy samples/spares, verify all 6 colours at minimum rail before buying 15; fallback 100 Ω on G/B | electronics |
| B6 | Optical margin is typical-only (0.91× at minimum); recess geometry text inconsistent (codex) | Keep socketed calibration; record the resistor pair per sled; fix the 12/4 vs 8/8 mm text; TEFT4300 polarity by drawing | electronics + mechanical |
| B7 | Battery budget misses the RF-switch pull-up (~1.55 mAh/day), mixes per-counter vs per-table goal rates, capacitor leakage unspecified (codex) | Re-do §0 battery figures as a **range** with those inputs; specify a low-leakage 470 µF (or 10 V Ø6.3, 2.5 mm pitch, fable) | electronics |
| B8 | Buzzer schematic puts R_BD on the GPIO side (layout is right) (codex) | Fix the schematic; note the 2N4401 pinout differs | electronics |
| B9 | Exact variants needed (LIS3DH clone power path, amp clone, angled USB-C with CC), and OpenELAB now ships **from China in 5–10 working days** (codex) | Pin the supplier SKUs + photos; correct delivery times and the fast-plan dates | electronics |
| B10 | Stale text: 20 cm jumpers (ASSEMBLY:80), top-reader orientation (dimensions/ASSEMBLY), a ~2,000 kr total in bom, no Ø2.5 drill in tools, sound test needs cells, ≤ 30 µA read after ≥ 10 min (both) | Clean up | electronics |

## C. Bench items (first table)

Loaded-rail scope at cutoff; sleep current per device; LED colours; optical calibration; amp gain + pop (40 ms
lead-in if needed); RSSI near R_A1/C_A1; DESPI RESE; reverse pack current with USB connected; battery removal
during sound.
