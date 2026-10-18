# Motion wake: LIS3DH vs a spring vibration switch (assessment for lead)

> **User decision (2026-10-15): a cheap LIS3DH clone board** (F2 below; ≈ 8 kr, same chip and
> firmware), not the spring switch. The switch stays documented here as an option. The clone's
> requirements and bench acceptance are in [README.md](README.md) (*Wake sensor*) and ASSEMBLY 3.2.

**Question (user via lead):** the LIS3DH is the most expensive line, at ≈ 63 kr × 3 per table. Can
something cheaper give the same "auto"? That means goal counters awake and on Wi-Fi before the first
goal, and the scoreboard awake when play starts, with no key press.

**Recommendation: yes, a bare spring vibration switch on D1 for both devices, with three conditions.**
1. An RC "stretch" network on D1.
2. A firmware wake gate that rejects single bumps before joining Wi-Fi.
3. The switch fitted in a socket, because it wears (see risk R1).

The LIS3DH footprint stays as the fallback, along with a cheaper fallback (an AliExpress LIS3DH board).
This saves ≈ 620 kr over 3 tables, ≈ 110–175 kr on the first table (DigiKey shipping eats some of it,
§3), and ≈ 62 kr per device. The battery is unchanged within ±1 %.

## 1. Wake reliability

- **What fires it.** A SW-18010P-class switch is a spring around a centre pin. A shock makes the
  spring touch the pin for ≈ 0.1–2 ms per touch, and it rings for a few touches. Ball hits on the
  walls, rod slams and the ball landing in the drawer are sharp shocks, so they fire it reliably.
  Rod spins without impacts and leaning on the table are slow, so they usually don't. That is fine,
  because a served ball always gives impacts within seconds.
- **Walk-past bumps.** A single bump gives *one* burst of touches (≈ 50 ms). Play gives *repeated*
  bursts, about one per ball hit. The firmware gate (§4) wakes only on **≥ 3 bursts at least 200 ms
  apart within 10 s**. That also rejects a door slam or someone setting a cup down.
- **Grade.** Sellers disagree on which suffix is most sensitive. The common reading (Espruino and
  others) is that the number is the force needed: **18010P is the most sensitive**, 18020P needs
  "a lot more". **Buy a mixed pack (10P/15P/20P)** and pick on the bench (§ Bench).
  - Expected choice: 18010P in the goal counter (the drawer is damped by the sled and its foam).
  - The scoreboard is taped to the table top and gets the full shock. 18010P with the gate, or
    18015P/18020P if it wakes too often.
- **Orientation.** The part stands upright on the board (pins at the bottom). Mount it with its
  **axis vertical**, so the spring hangs centred.
  - The goal board lies flat, so the axis is already vertical.
  - The scoreboard main board: **mechanical to confirm it lies flat.** If it stands, bend the switch
    over so its axis is vertical again.
  - A horizontal axis lets gravity sag the spring towards the pin. That makes it touchier in one
    direction, and in the worst case it rests closed.
- **Compared with today:** the same physics as the LIS3DH's threshold, but the sensitivity is set by
  the spring grade, not by a register. Note that `MOTION_THRESHOLD_MG` is a `board.h` constant today,
  not a remote setting, so no remote tuning is lost. The gate's numbers can be made remote.

## 2. Catching the closure in deep sleep: circuit

```
3V3 ── SW1 (SW-18010P, in a 2-pin socket) ── 1 kΩ ──┬── D1 (GPIO1, LP IO, ext1 ANY_HIGH: same pin and polarity as LIS3DH INT1)
                                                    ├── 100 nF ── GND
                                                    └── 1 MΩ ──── GND
```

- **Stretch.** A ≥ 0.5 ms touch charges 100 nF through 1 kΩ (τ = 0.1 ms). The 1 MΩ then holds D1
  above V_IH (0.75 × 3.3 V) for **≈ 29 ms** (τ = 100 ms × ln(3.3 / 2.475)).
  - The C6's ext1 wake is a level wake on the LP domain, so 29 ms is far beyond anything it could
    miss. Bounce collapses into one clean pulse.
  - The 1 kΩ keeps the switch's contact current within its 20 mA rating; without it, the inrush is
    amps for nanoseconds.
- **Current.** Open: 0 µA (cap leakage is nA). Resting closed: 3.3 µA through the 1 MΩ.
- **Firmware must not wake-loop.** If D1 is still HIGH at sleep entry (switch stuck or resting
  closed), skip ext1 and sleep on a 10-minute timer instead (≈ 0.03 mAh/day).
- **Same pin, same polarity as INT1, so the firmware change is small.** While awake, rising edges on
  D1 are the "still playing" signal (as INT1 is today), with no I²C and no latch to clear. Firmware
  can auto-detect the fitted option: LIS3DH answering at 0x19 → LIS3DH mode, otherwise switch mode.
- **Fit one option, never both.** INT1 is push-pull, so the switch would short it to 3V3. The LIS3DH
  fallback footprint stays on both boards.

## 3. Parts, sources, kr

| Part | Source | kr |
|---|---|---|
| SW-18010P / 18015P / 18020P, bare (**not** the SW-420/LM393 comparator module), mixed 10–30 pack | AliExpress, add to order G (1–3 weeks) · LCSC C2681585 (SHOU HAN SW-18010P, "1 million times, 12 V 20 mA") | ≈ 10–20 per pack, **≈ 1 per device** |
| 1 kΩ, 1 MΩ, 100 nF | kit / order A | ≈ 0.5 |
| 2-pin female socket for SW1 | header strip | ≈ 0.3 |

**Savings:**
- **Per device:** ≈ 63 − 2 ≈ **61 kr**. Goal counter ≈ 180 → **≈ 120**; scoreboard ≈ 585 → **≈ 525**
  (option A).
- **3 tables:** the DigiKey order drops from 10 × LIS3DH ≈ 634 kr to ≈ 880 kr, still over the 550 kr
  free-shipping line, so **≈ 620 kr saved**. 3 tables ≈ 3,400–3,550 → **≈ 2,780–2,930**.
- **First table, the catch.** Order A without its 4 LIS3DH (≈ 254 kr) is ≈ 436 kr, under DigiKey's
  550 free-shipping line, so 185 kr of shipping comes back. The net saving would be only ≈ 70 kr.
  - Better: move the PCA9685 into order A as the genuine Adafruit 815 (≈ 140). Order A ≈ 576, free
    shipping; Ardustore order C loses its PCA9685 (≈ −60).
  - First table fast plan ≈ 1,385–1,445 → **≈ 1,210–1,270** (≈ 175 saved).
  - Keeping 1 LIS3DH as a bench fallback/reference: ≈ 1,275–1,335 (≈ 110 saved).
- **Timing.** The switches come with order G (1–3 weeks). The goal counters can be built and flashed
  before that; they just don't wake by themselves until SW1 plugs in.

## 4. Battery

| | LIS3DH | Spring switch |
|---|---|---|
| Sleep current | ≈ 3 µA → 0.07 mAh/day | 0 µA (3.3 µA only while resting closed) |
| A rejected bump (gate: boot ≈ 0.3 s × 25 mA, then ≤ 10 s light sleep, beam on ≈ 1.2 mA, **no Wi-Fi**) | – | ≈ 0.006 mAh |
| A false wake *without* the gate (Wi-Fi join + 5 min idle tail) | ≈ 0.3 mAh | ≈ 0.3 mAh |
| 20 bumps/day | ≈ 0 (LIS3DH threshold) | ≈ 0.12 mAh/day with the gate · ≈ 6 mAh/day **without** it (−35 % life) |

- **Net with the gate:** ≈ +0.05 mAh/day (0.12 − 0.07), under 1 % of 11 mAh/day, so the ≈ 5-month estimates
  stand.
- **The gate is mandatory.** The beam is powered from the first touch, so a goal scored during the
  gate is counted and queued, never lost. The gate only delays the Wi-Fi join.

## 5. Risks and the alternatives

- **R1 wear (the main risk).** LCSC lists the switch at 1 million operations. In play it may see
  ~10–20 k touches a day (several per ball hit, while awake), which reaches 1 M in about 2–3 months
  of heavy play.
  - Hence the socket: a 1 kr swap at each battery change.
  - **Bench item:** firmware logs touches per hour of play.
  - If it's > 10 k/day and the springs fail, switch to fallback F2.
- **R2 sensitivity spread** from part to part: bench-pick (the mixed pack); the gate absorbs some.
- **Alternatives:**

| Option | Verdict |
|---|---|
| **F1: keep the SparkFun LIS3DH** (63 kr) | Proven, no wear, tunable. The fallback footprint. |
| **F2: AliExpress LIS3DH board** (≈ 10–20 kr) | Same chip, same firmware, no wear: saves ≈ 45–50 kr per device. Risks: its regulator's quiescent current and a power LED to remove (bench: sleep current ≤ 30 µA). **The best fallback**, and a fair alternative if the user dislikes the wear risk. |
| LP-core beam polling | Only for the goal counter, misses fast balls at a low duty, and can't wake *before* the first goal. No. |
| Piezo disc | It can drive the pin through a high-value resistor (clamped), with no comparator. But its sensitivity depends on how it's bonded, and it's harder to reproduce than a spring. Not better. |
| Ball-operated switch | Stall risk; wakes at the goal, too late. No. |
| Key-only wake | Loses "auto" (user rejected it). No. |

- **What "auto" loses:** a fine, register-set threshold and the high-pass filter. Today it's a
  build-time constant, so no remote tuning is lost. The gate's numbers (`wake_bursts`,
  `wake_window_s`) can be remote server config instead. **What it gains:** on the goal counter D4/D5
  become free and there's no I²C, so there's no LIS3DH setup to get wrong in assembly.

## Bench (first table)

1. Fit SW1 (a socket) on one goal counter and the scoreboard, and log every D1 burst over a few days
   of play. Firmware logs the wake source and touches per hour.
2. **Pass:** wakes within ≤ 5 s of a served ball on every try (20 tries per grade). A walk-past bump,
   a cup set down and a door slam: no Wi-Fi wake. Touches per day logged for R1.
3. Pick the grade per device. If either fails, fit F2 on that device.
