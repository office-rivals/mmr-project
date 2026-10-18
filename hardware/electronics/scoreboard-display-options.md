# Scoreboard display: colour vs e-paper

> **Decision (user, 2026-10-14): the scoreboard stays on the 4.2" black/white e-paper with 3 × AA.**
> Colour was considered and dropped. This document is kept for reference, for example for a later
> USB-powered colour revision. See *Colour sourcing notes* at the end.
> Battery figures here (≈ 190 days, "about 6 months") are the **display-only comparison from 2026-10-14**,
> before the LEDs, card reader and sound. The current scoreboard battery life is in INTERFACES §0.

The question (user, via lead) is whether a **colour** scoreboard display is worth it compared with
the 4.2" e-paper, on **cost** and **AA battery life**. The rest of the scoreboard stays the same:
XIAO ESP32-C6, 4 keys, LIS3DH motion wake, and Wi-Fi long-poll in light sleep (firmware's 1.5 mA).

**Usage (INTERFACES §3):**
- About 4.7 h a day of ACTIVE time (matches plus the 5-min idle tail).
- Deep sleep the rest of the day.
- The screen has to show the score for the whole match.

**Cost of the parts that don't change:**
- Sleep plus about 8 wake-ups a day costs ≈ 1.4 mAh/day.
- Usable capacity is about 1700 mAh with 3 × AA Eneloop, down to the 3.3 V cutoff (electronics
  README).
- 4 × AA gives about 2300 mAh. But **4 cells exceed the XIAO's 5.5 V buck input** (fresh NiMH
  5.6–5.8 V, alkaline 6.4 V), so they need an extra external regulator and a bigger holder.

Prices are DKK including moms, checked 2026-10-14. *est.* means a figure worked out from a schematic
or a typical value rather than measured.

## Summary

| Option | Example part | Display current while ACTIVE | Life, 3 × AA | Life, 4 × AA* | Display cost | Notes |
|---|---|---|---|---|---|---|
| **B/W e-paper 4.2" (baseline)** | Good Display GDEY042T81 400×300 + DESPI-C02 | ~0.1 mA average. It draws only during a 0.3 s partial refresh (≈ 6–8 mA) and **holds the image at 0 mA** | **≈ 190 days** | ≈ 260 days | ≈ 210 (OpenELAB EU) | Reflective, so readable in any room light at any angle. Shows the last result while asleep. No colour, no animation |
| **(a) 2.8" IPS SPI TFT** 320×240 (ST7789 / ILI9341) | Waveshare 2.8" (ST7789T3); generic IPS ST7789 | Logic 6 mA + backlight (4 LEDs, 60 mA typ at 100 %, PWM-dimmable) → total, incl. the 1.5 mA base: 100 % **67.5 mA** · 50 % **37.5** · 30 % **25.5** · 20 % **19.5** | 100 %: **5 d** · 50 %: **10 d** · 30 %: **14 d** · 20 %: **18 d** | 7 / 13 / 19 / 25 d | 46–100 (AliExpress) · ≈ 140–190 (Pi Hut / Opencircuit) · 270 (let-elektronik, DFRobot) | Already off between matches (deep sleep), which is assumed above. Can't keep the last score on screen while idle |
| **(a) 3.5" IPS SPI TFT** 480×320 (ST7796) | Waveshare 3.5" (ST7796S); LCDWiki MSP3525 | Logic 12 mA + backlight (6 LEDs, 95 mA at 100 %) → total: 100 % **108 mA** · 50 % **61** · 30 % **42** · 20 % **32.5** | **3 / 6 / 9 / 11 d** | 4 / 8 / 12 / 15 d | ≈ 147 (AliExpress) · ≈ 157 (Pi Hut) · 300 (let-elektronik, DFRobot) | The largest and best-looking option, and the most power-hungry |
| **(b) Small AMOLED** (dark UI) | 1.43" 466×466 CO5300 QSPI | ~15 mA *est.* with ~10–15 % of pixels lit at moderate brightness (30 mA typ for a normal image) | **≈ 22 d** | ≈ 29 d | ≈ 371 (AliExpress, with touch). No DK/EU stock as a standalone module | 36 mm across: digits only ~15–18 mm tall, marginal at 1 m. **Burn-in** from a static layout over months. The panel's VBAT pin is max 4.6 V, so it can't take fresh AA directly. QSPI works on the C6 |
| **(c) Colour memory LCD** (8 colours, reflective) | JDI LPM027M128B/C 2.7" 400×240 | Panel µW. The frontlit C version adds 16 mA, and it's **needed** in a normal room (dim, washed-out without light) | No light: ≈ 195 d · with frontlight: **≈ 20 d** | 265 / 27 d | B version: ≈ 558 (AliExpress). C version: discontinued. No DK/EU stock, no breakout board | Only 58.8 × 35.3 mm active area, smaller than the e-paper's 84.8 × 63.6. 8 dithered colours. Ruled out on availability and size |
| **(d) USB-powered colour TFT** | Any of (a), e.g. 3.5" ST7796 IPS at 50–100 % | No limit | **Unlimited** | – | (a) + 5 V adapter 69 + USB-C cable 39–79 ([Elextra](https://elextra.dk/p/netadapter-100-240v-til-5vdc-1a-usb-hun-slim-hvid/H57964)) ≈ **+110–150 per scoreboard** | Needs a cable to a socket at **each end** of each table (10 for 5 tables). Can be always on, including showing the last result |
| **(e) Colour e-paper** | Waveshare 4.2" B/W/R; Spectra 6 (4"–7.3") | – | – | – | – | **Ruled out:** a full refresh takes **12–27 s** and there's no partial refresh. A goal would take half a minute to appear, with the screen flashing |

\* 4 × AA needs an extra regulator, a bigger holder and enclosure changes. It isn't designed in.

**Checking lead's estimate** ("TFT ~20–60 mA incl. backlight, so ~10–30 days on AA"): it holds for a
2.8" TFT on 3 × AA:
- 19.5 mA (20 % brightness) gives 18 days;
- 37.5 mA (50 %) gives 10 days;
- at full brightness it's 5 days, and the 3.5" is worse.

**The ≥ 1-month target is missed** at every brightness where an IPS TFT is comfortably readable in a
lit room (≥ 30 %), on 3 × AA and on 4 × AA.

## Colour with aggressive power saving (2.8" IPS, 3 × AA)

This is lead's scenario, worked through with the real figures. Every power-save mode is on:
- the MCU light-sleeps with Wi-Fi power save and long-poll (1.5 mA, as firmware has it);
- the backlight is PWM-dimmed between events and boosted after each goal or key press;
- between matches the controller is in sleep-in / display-off and the backlight is off (deep sleep).

**The figures:**
- **ST7789V logic (Sitronix datasheet):** IDD **6.0 mA typ** in normal display mode (7.5 max). This is
  a **fixed floor whenever anything is shown**, whatever the backlight does. The controller has to keep
  scanning the panel.
- **Sleep-in:** 15 + 5 µA typ, which costs about 0.4 mAh/day between matches and is negligible.
- **Backlight:** 4 white LEDs, **60 mA typ at 100 %** (QD-TFT2803 / LCDWiki MSP2807), linear with PWM
  duty.
- **Capacity:** 1700 mAh usable, 4.7 h ACTIVE a day.

| Idle backlight | Boost after each goal / key | Events per hour | Average while ACTIVE | Life on 3 × AA |
|---|---|---|---|---|
| 5 % | 100 % for 10 s | 40 goals | **16.8 mA** | **21 days** |
| 5 % | 100 % for 10 s | 60 (goals + scorer picks) | 20.0 mA | 18 days |
| 5 % | 50 % for 10 s | 40 | 13.5 mA | 26 days |
| 5 % | 50 % for 5 s | 40 | **12.0 mA** | **29 days** |
| 10 % | 100 % for 10 s | 40 | 19.5 mA | 18 days |
| 10 % | 50 % for 5 s | 40 | 14.8 mA | 24 days |

**Checking lead's estimate** ("~12–15 mA, about 1 month"): it's reachable only in the most aggressive row
(5 % idle, 50 % boost for 5 s), at **29 days**. Two things push it higher:
- the **6 mA controller floor**, which doesn't dim with the backlight;
- the boost. 10 s of full backlight per goal adds 6–9 mA on average.

So realistically it's **3 weeks**, and the ≥ 1-month target is still not met with margin. NiMH ageing,
cold or longer play days push it under.

**What the screen looks like:**
- **Between matches (deep sleep): black.** Backlight off, display off. Unlike e-paper, the last score is
  **not** visible. Keeping a dim image up between matches would cost ≥ 9 mA around the clock, about
  **5–6 days** of life. The black screen also tells nobody whether the device is working.
- **During a match, between goals, at 5–10 % backlight:**
  - A generic 2.8" IPS is roughly 250–300 cd/m² at 100 % *est.*, so 5 % is about **12–15 cd/m²**
    and 10 % about **25–30 cd/m²**.
  - For comparison, white paper under normal room light (300–500 lux) is ~80–120 cd/m².
  - So at 5 %, a white-on-black score is readable in a dim room, but **washed out and hard to read in a
    normally lit room, worse at 45°**. 10 % is borderline indoors.
  - After the boost ends, players would see the score fade to dim; ux should judge whether that's
    acceptable.
- **PWM:** use LEDC at ≥ 5 kHz so the dimming doesn't flicker on camera. It has to keep running in light
  sleep, which means the RC_FAST clock; firmware already knows this from the beam work.

**Verdict:** aggressive power saving roughly doubles the TFT's battery life, from ~10–14 days at a
readable 30–50 % to ~3 weeks. But it buys that by making the score dim most of the time and black
between matches, and it still misses 1 month. The recommendation below stands.

## Why "screen only on during matches" doesn't rescue the TFT

The numbers above already assume that. The TFT is fully off in deep sleep outside ACTIVE, and the 4.7 h
a day is mostly match time. On top of that:
- **Turning it off between goals mid-match isn't an option**, because players look at the score all the
  time.
- **Keeping it on all day** (to show the last result, as e-paper does for free) multiplies the display
  term by ~5. At 30 % that's 25.5 mA × 24 h ≈ 610 mAh/day, about **3 days**.
- **"Black when idle" only helps an AMOLED** (black pixels are off). An LCD backlight burns the same
  current behind a black screen. Turning the backlight off leaves a blank screen, not the last result.

## "Living screens" on the C6: what the SPI bus allows

- **SPI clock.** On the XIAO's SPI pins (D8 SCK, D10 MOSI) the signals go through the GPIO matrix,
  which ESP-IDF rates to **40 MHz**. The C6's 80 MHz needs the IO_MUX pins GPIO6/7, which aren't on the
  XIAO header. The controllers' datasheet write limit is 10–15 MHz. In practice they run at 40 MHz, but
  test it per unit.
- **Full frames at 40 MHz** (16-bit colour, transfer only):
  - 320 × 240 = 1.23 Mbit, about **31 ms**, so **≈ 30 fps at most**;
  - 480 × 320 = 2.46 Mbit, about **61 ms**, so **≈ 15 fps at most**.

  Drawing the frame on the 160 MHz single core adds to that. TFT_eSPI has no DMA on the C6; LovyanGFX
  and esp_lcd do.
- **Memory.** The C6 has 512 KB SRAM, and Wi-Fi + TLS take ~150–200 KB of it.
  - A full 320 × 240 16-bit framebuffer (150 KB) fits.
  - A 480 × 320 one (300 KB) doesn't, so it has to be drawn in strips.
- **Animating keeps the CPU awake.** That means no light sleep, roughly **+20–25 mA** while it runs.

**In practice:** a 2 s goal flash, a rolling digit or a pulsing "who scored?" prompt at 15–30 fps in a
region of the screen is easy. Full-screen smooth animation, video or 60 fps is not. Colour
"living screens" is realistic as **short accents**, not continuous motion. On battery, each second of
animation costs about what an e-paper refresh costs per goal.

## Readability

Players read the board at about 1 m and up to ~45° off-axis (ux).
- **E-paper** is reflective, ~180° viewing angle and readable in bright light. Its 0.212 mm pixels
  allow ~30 mm digits.
- **An IPS TFT** has a good angle, but a 2.8" has an active area of only 43 × 58 mm, so digits are ~25 mm.
  At 20–30 % backlight it looks dim in a bright room. A **3.5" IPS** (49 × 73 mm) is the smallest
  colour panel that matches the e-paper digit size.
- **Non-IPS TFTs** (cheap TN ILI9341) wash out at 45°, so they're excluded (ux requirement).

## Recommendation

1. **Battery-powered (the user's requirement): stay with the 4.2" B/W e-paper.**
   - It is the only display that meets **≥ 1 month on AA**, at about 6 months.
   - It keeps showing the last score while asleep.
   - It costs about the same as a decent IPS TFT (~210 kr).
   - It has the best readability at an angle and in daylight.

   ux's 1-bit 400 × 300 layout already targets it.
2. **If colour or animation is a must, power it from USB, not AA.** Use a **3.5" IPS ST7796 (480×320)**
   at ~150–300 kr plus ~110–150 kr for an adapter and cable, with a socket at every table end.
   - The pin count stays the same (SPI + DC/CS/RST + backlight PWM instead of BUSY), and ux's layout
     scales by proportion.
   - Keep the AA holder out of that variant entirely.
3. **Don't** build a battery TFT (5–18 days, more battery swaps than goals logged), an AMOLED (small,
   burn-in, ~3 weeks), a colour memory LCD (no stock, small, needs a light) or colour e-paper (12–27 s
   refresh).

A cheap hedge, if wanted: keep the e-paper design, and design the enclosure's display window and
mounting so a 3.5" TFT module could replace it in a later USB-powered revision.

## Sources

- Panel and controller figures: Good Display GDEY042T81 (product page); Sitronix ST7789V and ST7796S
  datasheets (IDD 6 / 12 mA typ); LCDWiki MSP2807 (2.8", 4-LED backlight 60 mA typ / 80 max) and
  MSP3525 (3.5", 6 LEDs 95 mA); Waveshare 2.8"/3.5" wikis; an ST7801N AMOLED datasheet (10 % pixels
  lit ≈ 20 mW); Switch Science JDI LPM027M128C page; Waveshare 4.2" B/W/R and Spectra 6 listings.
- C6 SPI: ESP32-C6 datasheet v1.5 (GP-SPI2, 80 MHz, quad mode); ESP-IDF spi_master (GPIO matrix
  ≤ 40 MHz).
- Prices: OpenELAB EU, let-elektronik.dk, The Pi Hut, Opencircuit, AliExpress, Elextra (2026-10-14).

## Colour sourcing notes (2026-10-14, for reference only)

This was checked before the decision, in case a colour revision comes back:
- **IPS 2.8" with a full drawing:** LCDWiki **MSP2833** (no touch) / MSP2834 (touch). It uses an
  **ILI9341V**, not an ST7789.
  - PCB 50 × 86 mm, 4 × Ø3.2 holes at 44 × 76.08 mm.
  - Active area 43.2 × 57.6 mm, 3.4 mm from the sides and 9.3 mm from the top.
  - 280 cd/m², backlight 80 mA.
  - **Its backlight gate has a 10 kΩ pull-up (R7), so the backlight is ON whenever the pin floats.** R7
    would have to be removed and replaced with a pull-down.
  - The Waveshare 2.8" ST7789 (27579) is sold as TFT, not IPS.
- **D-size NiMH in DK:**
  - The EU "eneloop D" is an AA cell in a spacer.
  - Real D cells: Ansmann maxE 8500 mAh (low self-discharge, ~150 kr/cell), Ansmann 5000 mAh (Proshop,
    ~80 kr/cell).
  - Chargers: Varta LCD Universal Charger+ (Bauhaus, ~209 kr) and Ansmann Comfort Multi (RS, ~325 kr).
    The BQ-CC55 is AA/AAA only.
  - Holder: MPD BH3DW 3 × D (DigiKey, ~33 kr, 106.5 × 69.7 × 28 mm).
- **Pack comparison** at ux's 20 % idle backlight with a 10 s boost (2.8", ~27.5 mA while ACTIVE):
  3 × D ≈ 39 days, 2 × 3 AA in parallel ≈ 26 days, 3 × C ≈ 21 days, 5 × AA + a regulator ≈ 20 days,
  3 × AA ≈ 13 days.
