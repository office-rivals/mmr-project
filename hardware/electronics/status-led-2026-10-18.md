# Status LED: electronics' part (for ux/status-led-2026-10-18.md §3 and §6), 2026-10-18

**APPROVED and designed (user/lead, DECISIONS 2026-10-18): red + InGaN green on GPIO5.** Drawn in perfboard.py (J_STAT (8,4–6), R_G/R_R in a
1 × 4 machined socket at col 9), schematic.svg, wiring.svg, bom row 23, ASSEMBLY §3/§4/§6, README, INTERFACES §2/§3. Everything is EST (rule 11). Prices are kr incl. moms, *est.*

## 1. Pin

**GPIO5 (MTDI back pad)**, the last spare: an LP GPIO, so the LP core can drive it in deep sleep (firmware, §4). It needs a wire
pre-soldered to the pad, like MTMS/MTDO, so **it must be fitted before the XIAO is mounted** (or added later with the board out).
MTDI only straps SDIO-slave timing, which we don't use, so a lit LED at boot does no harm.

## 2. Part and resistor

- **3 mm, diffused, through-hole** rather than 0603. It seats flush in a Ø3 hole in the dash, its legs take the lead directly, and
  there's no carrier board. 0603 needs a tiny PCB and is hard to hand-solder for no gain at this size.
- **Green = InGaN 520–530 nm** ("true/pure green", Vf ≈ 2.7–3.0 V at 1–2 mA). It's the most visible per mA, and needed for the
  red+green option (§3).
  - Its Vf leaves ≈ 0.3–0.5 V across the resistor at 3.3 V, so the current depends on the part's Vf.
  - Start with **R = 220 Ω (≈ 1.5–2 mA)**, in a **machined socket** on the board as the brightness knob (bench: just visible in the
    drawer's shadow, nothing glowing out of the opening).
- Red, if used: AlInGaP ≈ 625 nm, Vf ≈ 1.8–1.9 V. Start with **R = 680 Ω (≈ 2 mA)**, also socketed.
- Cost ≈ 3–6 kr per counter (LEDs ≈ 1 each, resistors, 1 socket strip piece, a 2- or 3-pin header, 2–3 jumpers).

## 3. Red + green from GPIO5 alone: yes, without leaking, but the green must be InGaN

```
3V3 ── R_R 680 ── RED (A→K) ──┬── GPIO5          pin LOW  → red on   (3V3 → red → pin)
                              └── GREEN (A→K) ── R_G 220 ── GND   pin HIGH → green on (pin → green → GND)
                                                                pin Hi-Z → both off
```

- **Off (Hi-Z, and in deep sleep between blinks):** the two LEDs are in series across 3.3 V, so they stay dark only if their Vf sum is
  well above 3.3 V even at µA.
  - **Red AlInGaP + InGaN green:** ≈ 1.6 + 2.5 ≈ 4.1 V at 1 µA, so the leak is ≈ 0 ✓.
  - Red + an AlInGaP/GaP **yellow-green** (≈ 1.6 + 1.7 at µA) would leak a few µA and glow faintly. **Don't use yellow-green.**
- **Wiring:** 3 wires to the LEDs (3V3, STAT, GND) instead of 2, and 2 sockets on the board (R_R, R_G). The LEDs are 2 separate 3 mm parts
  side by side. A 3-lead bicolour LED doesn't fit this circuit, because it is common-anode or common-cathode.
- **Firmware:** green = drive HIGH, red = drive LOW, off = input/Hi-Z (the LP core does the same).
- **Mono green (ux's strawman):** GPIO5 → R_G 220 → green → GND. 2 wires, 1 socket.

## 4. Battery (per pattern, LED current only)

A blink of 30 ms at **2 mA** is 60 µC. **Asleep** 19.3 h/day at 1 group / 5 s; **awake** 4.7 h/day at 1 group / 2 s (README budget hours).

| Pattern | Asleep | Awake | **mAh/day** | at 1 mA |
|---|---|---|---|---|
| 1 blink (OK) | 12 µA → 0.23 | 30 µA → 0.14 | **≈ 0.37** | ≈ 0.19 |
| 2 blinks (attention) | 0.46 | 0.28 | **≈ 0.75** | ≈ 0.37 |
| 3 blinks (battery low; only the last ≈ week) | 0.70 | 0.42 | **≈ 1.1** | ≈ 0.56 |

- ux's ~0.3 is right, at ≈ 1.6 mA. **OK at 2 mA is ≈ 3 % of the typical 13.5 mAh/day**: 121 → ≈ 118 days, so §0's "≈ 2–4 months"
  holds.
- **Not included: the cost of blinking from deep sleep (firmware).** Waking the main core every 5 s would cost far more than the LED (a
  boot ≈ 1 mC → ≈ 200 µA ≈ 4–5 mAh/day). So it has to be the **LP core or an LP-timer-only GPIO toggle**: a few µA → ≈ 0.05–0.1 mAh/day.
- Bench: set the current by eye first, then measure the sleep average with the blinks.

## 5. If approved

- J_STAT (2-pin mono, or 3-pin red+green) and the R_G (+ R_R) sockets on the perfboard's free holes.
- The MTDI pad wire, with ASSEMBLY §3.4 and the meter checks.
- A lead of 2–3 jumpers ≈ 200 through the dash duct, and the bom, wiring, schematic and README budget rows.
