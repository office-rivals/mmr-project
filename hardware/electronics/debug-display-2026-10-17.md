# Tiny debug display on the goal counter (study, nothing bought), 2026-10-17

Lead's ask (user): a **very small debug display on L's front face**, seen through the frame opening, "only if we can do it
for 30 kr or less" (hard cap per counter, all-in). It is not the score unit. Inputs: ux (trigger, content), mechanical
(space) and firmware (effort, sleep). Prices are kr incl. moms, est. Everything is EST
(rule 11).

**Status: DECIDED (user, DECISIONS 2026-10-17): the white OLED is IN. Since 2026-10-18 it's the 0.91" 128 × 32 upright** ([slim-display-options-2026-10-18.md](slim-display-options-2026-10-18.md)); this was first the 0.96" on every goal counter: ux's 4 × 16 layout, short-press trigger.
Drawn in perfboard.py (J_OLED), schematic.svg, wiring.svg, bom.md row 22, ASSEMBLY §3/§4/§6, README; §0 ≈ 195 kr per counter.
Mechanical places it on L's front (battery-drawer re-layout). The history below is kept as it was.

## Verdict

**The electronics fit 30 kr (≈ 20–25 kr from AliExpress), but the display doesn't fit on L's front face as it stands.**
Mechanical says the face above the frame's bar is full: finger cup, undo button over the USB-C, arrow and lid snap, mouth
bay with the buzzer grille under it. The biggest free patch is ≈ 12 × 12, and the smallest module is 38 × 12. A 0.96" fits
only **in place of the finger cup** (the ribbon loop would then be the only pull) or by moving the button.
**Recommendation: don't add it now.** The phone page, the buzzer sounds and admin's beam and battery status already show
what it would show. If the user wants it anyway, the decision is to **trade the finger cup for a 0.96"** (≈ 25 kr).

**Update (mechanical, later on 2026-10-17): the finger cup is gone** (the pull is a cord loop in the mouth bay), so the front-left
strip **y −1.2 to −18.5 (17.3 wide), z ≈ 12–49** is free. A **0.91" module stood upright** (12 × 38) fits there with no trade.
Then the panel is portrait, 32 px across, so each line holds ≈ 5 characters (6 × 8 font). ux's 4 lines become short
tokens, e.g. `-61`, `ok`, `3.92`, `Q0`, `a 6.1`, `BLOCK`, `A`, `1.4.2`, about 8 rows of ≈ 1.4 mm text. That's readable up close
through the opening, but ux should judge it. The 0.96" (27 wide) still doesn't fit. **Cost unchanged (≈ 18–23 kr), battery unchanged.**
So it's now: **a portrait 0.91" in the free strip** (no trade), or skip it.

**Correction (lead, same day): most of that strip is behind the frame.** The opening's left edge sits at y ≈ 4.5 − e_L
= **−5.5 to −10.5** (L's 2.5 float adds ±2.5). So only **≈ 8–13 mm of the 17.3** is visible, and the R10 corner takes more near the bar.
A 12-wide module (with a ≥ 1 mm bezel) fits only at the best case. **Likely no**: mechanical is checking the visible width.

**ux (same day): yes to the portrait 0.91" if it's visible**, with a 1-letter prefix on every token. 8 rows of ≤ 5 characters, in a fixed
order, faults in inverse: `W-61` (`W off`) · `S ok` (`S401`/`S404`/`Serr`) · `B3.92` · `Q0` · `a 6.1` (live `BLOCK`) · `A` (`UNASG`) ·
`1.4.2` · `U ok`/`U no` (for 10 s after an undo). 1.4 mm text is comfortable at 30 cm and marginal at 50: fine for a view you lean in to.
The trigger is unchanged. **What decides it is mechanical's visible width.**

## The candidates

| Module | Size (PCB / active) | kr, AliExpress / DK-EU | Readable at 30–50 cm? | Fits L's face? |
|---|---|---|---|---|
| **0.91" 128 × 32 SSD1306 I²C** | 38 × 12 / 22.4 × 5.6 mm | ≈ 10–15 / ≈ 40–60 | Yes for 2 lines of 8 px (≈ 1.4 mm) text up close; ux's 4 lines need the small font, which is marginal at 50 cm | **No**: 38 wide vs the 12 × 12 patch |
| **0.96" 128 × 64 SSD1306 I²C** | 27 × 27 / 21.7 × 10.9 mm | ≈ 13–20 / ≈ 50–70 | **Yes**: ux's 4 lines × 16 characters at 8 px (≈ 1.4 mm), bright, high contrast through the opening | **Only instead of the finger cup**, or by moving the button |
| XIAO user LED blink codes, buzzer sounds | – | 0 | – | Already there |

**All-in per counter** (AliExpress): module ≈ 10–20 + 4 jumpers ≈ 7 + header pins ≈ 0.5 → **≈ 18–28 kr ✓ under 30**. From DK/EU
stock it's ≈ 50–80, ✗ over the cap.

## Electronics

- **Bus:** I²C on D4/D5 with the LIS3DH. The SSD1306 sits at **0x3C** (or 0x3D), and the LIS3DH at 0x18/0x19: **no clash**. The module's
  own I²C pull-ups go in parallel with the LIS3DH board's: a stronger pull-up (≈ 3–5 k), still fine at 100–400 kHz, and no current when idle.
- **Pins:** none extra (I²C + 3V3 + GND, a 4-pin plug). GPIO5 stays free.
- **Power:** **no power-gating.** An unpowered module back-loads SDA/SCL through its protection diodes and can stop the
  LIS3DH's bus. Use the panel's own sleep (0xAE + charge pump off): **≤ 10 µA** (SSD1306 datasheet) + the module's LDO
  (≈ 1–5 µA EST) → **≈ 0.1–0.5 mAh/day** (firmware: the module's LDO + pull-ups, 5–20 µA EST). On-time ≈ 10–20 mA for a few 10 s looks a day
  → < 0.05 mAh. **§0 battery unchanged** (≈ 13.3 → ≤ 13.8 mAh/day). Bench: measure the module's sleep current before fitting; reject one with a power LED (or remove the LED).

## Trigger and content (ux)

- **Trigger:** press-down = the scan tick + screen on at once. Release in < 1 s = the screen stays on for 10 s (no undo). Held to 1 s =
  undo, as now, and the screen shows the result ('Undo ok' / 'Undo: too late'). From deep sleep the press wakes it, and the
  screen stays on until 10 s after Wi-Fi settles.
- **Content** (fixed order, live while on, faults in inverse video):
  - `WiFi -61  srv ok` (RSSI + the last server reply: ok/401/404/err)
  - `Batt 3.92V  Q 0`
  - `Beam a ok 6.1x` (shows `BLOCKED` live, so a hand in the gate tests detection)
  - `End A  v1.4.2` (`UNASSIGNED` when the server 404s the config)

## Firmware (firmware, 2026-10-17, EST)

- **Effort: small.** U8g2 page mode (or Adafruit_SSD1306 + the GFX already in use) costs ≈ 20–30 kB flash and a 0.5 / 1 kB
  buffer (128 × 32 / 64). The goal image is 1.25 of 3 MB, and RAM 46 of 320 kB. About a day, including a Hal "show" hook and a
  native test. It draws only while awake, on the shared Wire with the LIS3DH at 100–400 kHz.
- **Sleep:** 0xAE (display off; the charge pump stops with it) through deep sleep is fine. **Not gating is right:** the lines idle
  high in deep sleep, and nothing drives them low. The real idle cost is the module's LDO and pull-ups: **≈ 5–20 µA EST
  → 0.1–0.5 mAh/day**. Measure it on the bench.
- **Content:** firmware would add the last goal's seq + age, the last undo result, the config version, and the device id tail
  (for registering). ux's 4 lines (above) set the layout. The extras fit as a second page if ux wants them.

## If the user wants it

1. Lead decides the trade (mechanical): the finger cup → a 0.96" window (ribbon loop as the only pull), or move the button.
2. Bench one ≈ 15 kr 0.96" module: sleep current, readability through the frame at 50 cm in daylight, no I²C errors with the LIS3DH.
3. Then: J_OLED (4-pin: 3V3, GND, SDA, SCL) on the perfboard's free holes, a 4-wire lead, bom.md + §0 (≈ +25 kr per counter → ≈ 195 kr).
