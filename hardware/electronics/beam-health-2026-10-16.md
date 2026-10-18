# Goal-counter beam health + remote calibration: joint proposal (electronics + firmware), 2026-10-16

> **Values updated by hardware review 2 (2026-10-18):** R_LED_B 270 Ω, R_PU_B 68 kΩ, R_LS 47 Ω inline, 1 kΩ in series with D8 and D2; modes `a_boost`/`b` ≈ 6.3 mA, `b` = 52 k. Current margins: [README.md](README.md) *Daylight margin*.

Status: **PROPOSAL, nothing built.** Electronics owns this file and the circuit (§1–§3, §5). Firmware owns the health
check, states, reporting and server config. Those are in
**[firmware/beam-health-firmware-2026-10-16.md](../firmware/beam-health-firmware-2026-10-16.md)**; §4 below lists only
what the circuit changes there. All optics numbers are EST until the bench (rule 11).

**Why:** the user reports daylight in the ball drawer, too many balls blocking the beam, and wants calibration without
firmware changes.

What we can't do today:
- BEAM_RX (D8) is digital-only. With R_PU 220 k the lit node saturates (~14 µA), so even an ADC would show no margin.
- The LED and R_PU share D3, so with the LED off the receiver is unpowered too. Ambient can't be measured.

The dangerous failure is ambient alone holding the receiver ON while a ball is in the beam: **missed goals**.

## 1. Recommendation (joint)

**Detection:** keep the DC beam and the D8 edge interrupt (no latency or ISR change). Wire the cheap circuit below now,
while nothing is bought:
- an **ADC on the receiver node** (D2; VBUS sense moves to the GPIO6 back pad, like the scoreboard);
- the **LED on its own two pins** (1 mA, + a 3.1 mA boost);
- a **switchable 22 k pull-up** beside R_PU.

**Measurement:** firmware's ~9 ms health check gives graded µA readings (lit, ambient with the LED off, ball). The 22 k
pull-up brings the lit reading into the linear range, so **no separate weak-drive resistor is needed**.

**Remote calibration:** server config selects between three beam modes (§3). Mode B tolerates ~11× more ambient during
a block. That makes daylight a server setting (later auto), not a firmware change or a pulsed design.

**Order:** ship health checks + manual mode first (`beam_mode` default `a`, auto off). Turn auto on once field data shows
the time-of-day pattern.

**Not adopted:**
- pulsed counting on the main CPU: +12–23 mAh/day, about half the battery (firmware §5);
- the LP core: it has no ADC on the C6.

**Cost:**
- ≈ +1 kr and 4 wires per goal counter;
- 0 battery in mode A;
- mode A+/B only while selected (§3).

## 2. Circuit change (cheap now: nothing is bought)

```
D3  (GPIO21) ──R_PU   220k ─────┐
D6  (GPIO16) ──R_PU_B  22k ─────┼── BEAM_RX node ──┬── D8 (GPIO19)  digital edges, counting, as now
                                │                  ├── D2 (GPIO2, ADC1_CH2)  health readings     [new]
                    TEFT4300 C ─┘                  └── C_RX 1 nF ── GND  (ADC hold; τ 0.22 ms at 220k)
                    TEFT4300 E ── GND
D9  (GPIO20) ──R_LED   2.2k ──┬── TSAL6200 A (J_LED)      [LED moves off D3]
D10 (GPIO18) ──R_LED_B 680 Ω ─┘   TSAL6200 K ── GND
MTCK pad (GPIO6, LP) ◄── VBUS sense: 5V ─68k─┬─100k─ GND   [moved from D2, same as the scoreboard]
```

- **ADC pick: firmware's option (b).**
  - The noise-sensitive 220 k node stays on the header, short and next to D8.
  - The slow VBUS signal takes the back-pad wire. GPIO6 is an LP GPIO, so the ext1 USB wake still works, and it's the
    scoreboard's pin and method already.
  - GPIO2 and GPIO6 are not strapping pins. Solder the GPIO6 wire **before the XIAO is mounted**, like the BAT wires.
- **Pins:** all three free header pins (D6, D9, D10) are used. D7 stays the role strap. GPIO4/5/7 back pads stay spare.
- **Sockets:** R_LED and R_LED_B stay socketed (the hand-fitted knobs). R_PU_B can be fixed (1 %).
- **Parts per goal counter:** 22 k, 680 Ω, 1 nF, and 2 socket pins. 22 k, 680 Ω and 1 nF are already values in the
  counted cart; the quantities go up. About **+1 kr**.
- **Deep sleep:** firmware drives D3/D6/D9/D10 LOW, so there is no beam current. D2 is an analog input, high-Z.
- **While powered, a beam pin that is off is high-Z, never LOW** (firmware): a LOW D6 would pull the node down
  through 22 k, and a LOW D10 would rob the LED through 680 Ω. So "off" in the mode table means floating.

## 3. Beam modes (the remote knob)

C6 thresholds: V_IL ≤ 0.825 V, V_IH ≥ 2.475 V.
- **"Lit OK"** needs I_c ≥ (3.3 − 0.825)/R.
- **"Ball reads blocked"** needs the light left with a ball in the beam (ambient + leakage) < (3.3 − 2.475)/R.

| Mode | Pins high | Pull-up | LED | Lit needs | Lit typ (margin) | Ambient tolerated during a ball | Extra current |
|---|---|---|---|---|---|---|---|
| **A** (default, dark drawer) | D3, D9 | 220 k | 1.0 mA | ≥ 11.3 µA | 73 µA (6.5×) | < **3.75 µA** | – |
| **A+** (weak optics, dark) | D3, D9, D10 | 220 k | 4.1 mA | ≥ 11.3 µA | 300 µA (27×) | < 3.75 µA | +3.1 mA |
| **B** (daylight) | all four | 20 k (220 k ‖ 22 k) | 4.1 mA | ≥ 124 µA | 300 µA (2.4×) | < **41 µA** (11× A) | +3.25 mA |

- **Battery** (§0 basis: ACTIVE 4.7 h/day, 1630 mAh):
  - A only: unchanged, ≈ 2–4 months.
  - A+/B for the whole ACTIVE time: ≈ 1.5–1.9 months.
  - Half the ACTIVE time: ≈ 1.8–2.6 months.
- **Min-spec optics:** mode B at the datasheet minimum is about 0.34× (a miss). The bench sizes R_LED_B (470 Ω gives
  ≈ 5.2 mA, still fine for a GPIO).
- **Edges:** mode B's edges are ~10× faster than A's, so `min_block_ms` holds in every mode.
- **Too much light for mode B:** above ~40 µA of ambient no DC mode works. Shading the receiver is then the fix
  (mechanical: a longer tube narrows the ±20° view). The health data says when.

## 4. What the circuit changes in firmware's part: **folded** (firmware confirmed 2026-10-16)

Firmware folded all of this into its file:
- the readings come from the ADC on D2;
- the LED at 1 mA with the B pull-ups replaces the weak-drive resistor;
- thresholds are in µA, converted from ADC mV through the active mode's pull-up;
- mode config: `beam_mode`, `beam_r_pu_a_ohm`, `beam_r_pu_b_ohm`, `beam_led_ma`, plus the auto switch, return and dwell;
- `mode` is in the status `beam` object and in the OTLP gauge `foosball.beam.mode`.

**Mode values:** `a`, `a_boost`, `b`, `auto` (this file's A, A+, B).

**Auto safety (firmware):**
- After a switch to `b`, the next check must show a margin ≥ `beam_margin_min`. Otherwise auto returns to `a`, holds it for
  the dwell time, and reports `ambient_high` + `low_margin`.
- `a_boost` returns to `a` only when `a`'s margin would be ≥ 2× the minimum.

**D6 is U0TXD:** the ROM boot log toggles it. That's harmless, because the beam is off at boot and D6 only switches a
pull-up. The goal image disables the ROM log anyway.

## 5. Docs and bench after lead's review

**Electronics** updates these:
- schematic.py/svg (goal);
- perfboard.py/png/svg (re-layout of the beam corner + the router assert);
- ASSEMBLY (back-pad wire to GPIO6, new holes, meter checks);
- bom.md counts;
- README *Goal sensor* + pin table;
- INTERFACES §2 rows (beam power, receiver input, USB sense).

**Firmware:** board.h pins, openapi.

**Bench (first table):**
- I_amb in the real drawer at morning, midday and evening, room lights on. This sets the auto thresholds.
- Mode B lit margin with R_LED_B 680 vs 470.
- ADC reading vs a meter at 3 points per mode.
- **ADC top with a dark node** (firmware's `BEAM_ADC_TOP_MV`): the C6 at 12 dB may clip below 3.3 V. Any ambient
  below (3.3 V − top) / 220 k is then invisible: a 3.1 V top hides < 0.9 µA, under the 1.5 µA auto-switch.
  Cover the receiver, read the ADC, and set the knob.
- 50 balls fed back-to-back with the check every 10 s: no lost goal.
