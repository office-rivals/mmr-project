# Slimmer status display: module options (2026-10-18)

**Status: CHOSEN, the 0.91" 128 × 32 upright** (mechanical's `mechanical/reports/2026-10-18-slim-display-proposal.md` + ux B5a: 2 lines at 8 × 16). bom row 22 and the docs are switched over.

The user (via lead) allows a slimmer display than the 0.96" if it fits L's front better. It must keep the same electronics:
SSD1306-family, I²C at 0x3C, 4-pin GND VCC SCL SDA on **J_OLED**, never power-gated. The opening is 57 (L → ~54). This file is
for mechanical (fit) and ux (readability). Sizes are typical listings: **measure the bought module**. Prices are kr incl. moms, *est.*
Everything is EST (rule 11).

| Module | Pixels | PCB (W × H) | Active area | Pixel pitch | ux's 4 lines × 6×8 font | White? | kr: AliExpress / DK-EU |
|---|---|---|---|---|---|---|---|
| **0.96"** (current) | 128 × 64 | **27.3 × 27.8** (≈ 26 × 26 on some SSD1315 boards), pins on a long edge | **21.7 × 10.9**, ≈ 9–20 down from the pin edge | 0.17 | 4 × 21 characters, with room for spacing or a larger font (8 rows) | Yes | ≈ 13–20 / 45 (Ardustore) |
| **0.91"** (recommended if it fits better) | 128 × 32 | **38 × 12** (≈ 3–4 thick), pins on a **short** edge | **22.4 × 5.6**, roughly centred on the glass (≈ 30 × 11.5), which sits toward the far end from the pins | 0.175 | **4 × 21 characters at the same 1.4 mm text height**: exactly ux's 4 lines, with no gap between rows | **Yes, the most common colour** | ≈ 8–15 / ≈ 40–60 |
| 0.49" | 64 × 32 | ≈ 13 × 12 | 11.2 × 5.6 | 0.175 | 4 × 10 characters: ux's lines don't fit | Yes | ≈ 10–15 / – |
| 0.66" (Wemos-shield type) | 64 × 48 | ≈ 26 × 34 (shield) | 13.4 × 10.1 | 0.21 | 6 × 10 characters | Yes | ≈ 15 / – (not slimmer) |
| 1.3" SH1106 | 128 × 64 | ≈ 35 × 34 | 29.4 × 14.7 | 0.23 | as the 0.96" but larger | Yes | ≈ 25 / – (not slimmer) |

## Reading it

- **The 0.91" is the slim option.** It's 12 tall instead of 27.8, so it can stand **upright, untilted** in a ~20-tall dash row:
  a 38 × 12 face with the 22.4 × 5.6 active area.
- **It shows the same text at the same size.** The 128 pixels across are the same, and the pixel pitch is the same (0.175 vs 0.17).
  Its 32 rows hold exactly 4 lines of the 8-px font.
  - What's lost is the 0.96"'s spare height: no blank row between lines, and no larger font.
  - Inverse-video faults still work, one 8-px row each.
  - ux decides whether 4 tight lines read well enough at 30–50 cm.
- **Electronics: no change.**
  - J_OLED, the lead, the pull-ups and the sleep current are the same: the panel sleeps at ≤ 10 µA plus the module's LDO.
  - The 0.91" boards also carry an LDO and pull-ups. Check the pin order on the silk: most are GND VCC SCL SDA, like J_OLED.
  - **Firmware changes one line:** the U8g2/U8x8 constructor goes from 128 × 64 to 128 × 32 (an `OLED_*` choice in board.h), plus the 4-line layout.
- **Battery: the same or a little less.** The panel's on-current is ≈ half (half the pixels).
- **Cost: ≈ 5 kr less per counter** from AliExpress (≈ 8–15 vs 13–20). If it's picked, bom row 22 and §0 move by < 5 kr per counter, so §0 stays ≈ 185.
- The 0.49" is too small for ux's content. The 0.66" and 1.3" aren't slimmer.

## ux's answer (2026-10-18)

**No to 4 tight lines.** The built 0.96" layout uses an **8 × 16 font (≈ 2.7 mm glyphs)**, not 8 px, and 1.4 mm text with no row gap is
marginal at 50 cm through the tube. If mechanical picks the 0.91", it shows **2 lines at 8 × 16 (≈ 2.8 mm)**:
- line 1: the worst fault, or `OK      End A`;
- line 2: cycles through the details every 2 s (ux/goal-counter-phase1-2026-10-17.md B5a).

**On readability alone the 0.96" still wins.** The choice is mechanical's, on space. (The "4 × 21 at the same size" row above assumed the
8-px font; with ux's 8 × 16 it is 2 lines on the 0.91" vs 4 on the 0.96".)

## Mechanical notes

- Mount the 0.91" with the pins at one end and the lead leaving sideways, through the duct.
- Nothing presses on the glass, whose FPC folds round the far edge.
- Leave ≈ 1 mm clearance round the PCB, and screen only the active area.
- Its PCB usually has no mounting holes, so hold it by a pocket with 2 lips on its long edges. Keep the lips off the glass.
