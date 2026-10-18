# Cheapest score display for phase 1 (study, nothing bought), 2026-10-17

Lead's ask (user): "Also figure out what the cheapest screen/digit display costs which we could add." Phase 1 is the goal
counters plus the phone, with the scoreboard parked. Inputs: ux (readability), mechanical (mounting), and
[scoreboard-display-options.md](scoreboard-display-options.md). Prices are kr incl. moms, **est.** from listings checked on
2026-10-17 (AliExpress / eBay vs DK/EU shops). Currents are lygte-info.dk's measurements at 5 V (lower at 3.3 V). Everything
is EST until the bench (rule 11).

## 1. What "readable" means here (ux, mechanical)

- **Digits ≥ 20 mm (0.8")**, 25 mm comfortable. It's read in a glance mid-play, at up to 45°, at 1–2 m. 15 mm only works
  for a careful read.
- Plain **"5 3"** is enough: names are on the phone. Each number gets a **fixed colour bar** in the team's men colours, printed
  on the stand (0 kr), with the scoreboard rule (the team defending this end = left).
- **Reflective and matte** is preferred: no glare at 45° in daylight, and about 0 battery. Red LED only if it's USB-powered.
- **One per table**, on the end shelf's flat top at the right end (95 deep, ~170 free: the scoreboard v5's spot), on a stand
  tilted ~50°, taped or clipped.
- **Option 1 is out (mechanical):** a cable from the sled through the frame gets reached through for every ball, has to be
  found by feel at each battery swap, and gets pinched when L is lifted. A display has to go **wireless** (its own unit). The goal counter also
  has just one free pin left (GPIO5) after the button and buzzer.

## 2. The displays

| Display | Digit height | Readable at 1–2 m, daylight, 45°? | kr: AliExpress / DK-EU | Current while shown | Interface, pins | Firmware effort |
|---|---|---|---|---|---|---|
| **TM1637 4-digit 0.56"** | 14 mm | **No**: below 20 mm. LED is bright, but the glance test fails | ≈ 15 (eBay €2) / ≈ 35 (EU €4.8) | 4.5 mA low … 60 mA high | 2 GPIO | trivial |
| TM1637 / HT16K33 **1.2"** red LED | 30 mm | Yes, but the segments are **2 LEDs in series: they need 5 V** (dim or dark on 3–4 V AA) | ≈ 40–60 clones / ≈ 110–130 (Adafruit 1270-type) | 3.6 mA low … 58 mA high (+ a boost converter on AA) | I²C (HT16K33) or 2 GPIO | trivial |
| **MAX7219 8-digit** | 9–14 mm | **No**: too small, and needs 5 V | ≈ 15–25 / ≈ 40–60 | 13–24 mA low … 220–415 high | 3 GPIO | trivial |
| **OLED 0.96" / 1.3"** (SSD1306/SH1106) | ≤ 10 / ≤ 15 mm | **No**: small, poor in daylight, burn-in from a static score | ≈ 20–30 / 35–50 · EU ≈ 60–90 | ≈ 8–20 mA | I²C | low |
| **Segment LCD HT1621 6-digit** | 14.9 mm | **Almost**: reflective and matte, but below 20 mm. TN angle ±45° marginal. No ready ≥ 20 mm module found | ≈ 20–40 / ≈ 50 (NL) | **≈ 0.1–0.4 mA** (backlight off) | 3 GPIO | low |
| **E-paper 2.13"** (250 × 122) | ≈ 20 mm | Yes, just: reflective, ~180°. Four digits fill its 48.6 mm width | ≈ 40–60 / ≈ 100–130 | 0 to hold, ≈ 6–8 mA for a 0.3 s partial refresh per goal | SPI: 6 GPIO | **low: reuse the scoreboard's GxEPD2 code** |
| **E-paper 2.9"** (296 × 128) | **≈ 24–25 mm** | **Yes**: the comfortable size, reflective, any angle, keeps the last score at 0 W | ≈ 55–80 (WeAct-type) / ≈ 120–150 (Waveshare) | same as 2.13" | SPI: 6 GPIO | low (as above) |

**Readable and on AA:** only e-paper (2.9", or 2.13" at the minimum). The LED options that are big enough need 5 V, and a
segment LCD with ≥ 20 mm digits isn't sold as a ready module.

## 3. The options

| Option | What | kr per table (est.) | mAh/day · life on 3 × AA (1630 mAh) | Placement | Firmware |
|---|---|---|---|---|---|
| **(1) Display on a goal counter, wired out** | – | – | – | **Ruled out** by mechanical (cable through the frame) and by pins | – |
| **(2) Stand-alone mini score unit** (recommended) | XIAO C6 + **2.9" B/W e-paper** + LIS3DH clone (motion wake) + FIT0610 3 × AA + D1/470 µF/VBAT divider on a small perfboard, in a cut-down scoreboard shell | **≈ 150–190** (AliExpress display) · **≈ 210–250** (EU display). XIAO 45–55, display 55–150, holder 20–25, LIS3DH 10, passives/board/headers ~10; filament + tape own | Deep sleep ~15–20 µA (0.4) + ACTIVE long-poll ~1.5 mA × 4.7 h (7) + refreshes (~0.1) ≈ **7.5 mAh/day ≈ 7 months EST** | End shelf, tilted ~50°, tape/clip (mechanical: a 100 × 60 × 25 box fits the 95-deep shelf). Colour bars printed on the stand | **Low–medium:** a cut-down scoreboard image (long-poll the live score that backend builds for the phone page, motion wake, GxEPD2 at 296 × 128). No keys, no LEDs, no reader, no sound |
| (2b) The same with a 2.13" e-paper | Digits ≈ 20 mm (ux's minimum) | ≈ 15 less | same | same | same |
| (2c) The same with a 1.2" red LED | Needs a 5 V boost on AA, so not matte/reflective | ≈ 150–230 + boost ≈ 10 | Low brightness ≈ 6–8 mA at the pack while ACTIVE → ≈ 35–40 mAh/day ≈ **6 weeks**; daylight brightness (≈ 15–20 mA) ≈ 2–3 weeks | same | trivial display, same unit |
| **(3a) A spare old phone/tablet** on the shelf with the phone live-score page | **0 kr if one exists**; a used tablet ≈ 300–500 | USB charger needed (≈ 70–150 for the adapter + cable) | A socket within reach, or charge it nightly | No hardware work; admin-ui's phone page needs a "big score" view |
| (3b) A ready ESP32 + e-paper board (e.g. Heltec Vision Master E290 2.9", LilyGO T5 2.13") | ESP32-S3/ESP32, LiPo + USB charging, no AA | ≈ 170–220 + a LiPo | ESP32-S3 light sleep with Wi-Fi draws more than the C6: ≈ weeks–2 months EST on a 1000 mAh LiPo | same stand | Medium: port the image off the C6 HAL |

## 4. Recommendation

1. **The cheapest readable display is (2) with a 2.9" B/W e-paper: ≈ 150–190 kr per table** with an AliExpress panel
   (≈ 210–250 with EU stock), about **7 months on 3 × AA EST**. It's reflective and matte at 45°, holds the last score at 0 W, and its
   ~25 mm digits pass ux's glance test. Firmware reuses the parked scoreboard's e-paper, long-poll and motion-wake code.
   The display alone costs ≈ 55–150 kr. A 2.13" saves ≈ 15 kr, but it's at ux's minimum.
2. **The truly cheapest is (3a)** if a spare phone or tablet exists: 0 kr plus a charger and a stand. It needs a socket, or
   charging every night.
3. **Don't:**
   - **0.56" TM1637, MAX7219 or OLED:** too small (≤ 15 mm), and the OLED also burns in.
   - **A 1.2" LED on AA:** needs 5 V, and it's 2–6 weeks of battery.
   - **A display wired to the goal counter:** ruled out by mechanical.
   - **HT1621 segment LCD:** the cheapest and lowest-power, but 15 mm digits. Worth a second look only if a ≥ 20 mm module turns up.

**Effect on §0 if built (after lead's OK):** + ≈ 150–250 kr per table. The phase-1 first-table cost becomes 2 goal counters +
this, instead of + the scoreboard (≈ 610–630).

## 5. Cheap bench check before ordering 1

Order one 2.9" B/W SPI module (≈ 60 kr, with an SSD1680 driver board). Drive it from a spare XIAO with GxEPD2. Print a stand at
50° on the end shelf. Check "5 3" at 2 m and 45° in daylight, and the partial refresh time (≤ 0.5 s, no flashing).

## Sources

[lygte-info.dk display module measurements](https://lygte-info.dk/project/DisplayModuleSpecifications.html) (digit heights,
currents) · [Adafruit 1.2" 7-segment backpack](https://www.adafruit.com/product/1271) · [eBay.de TM1637 0.56"](https://www.ebay.de/itm/202107385315)
· [ormix.lv TM1637](https://ormix.lv/en/catalog/item/id/35448) · [Waveshare 2.9" e-paper modules](https://www.waveshare.com/product/displays/e-paper/epaper-2.htm?p=2)
· [domoticx HT1621 6-digit](https://domoticx.net/webshop/display-lcd-6-digit-7-segment-14-module-spi-ht1621-backlight-wit/)
· scoreboard-display-options.md (e-paper/TFT currents, C6 SPI).
