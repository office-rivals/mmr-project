# Beam health + remote calibration: firmware part (2026-10-16)

**Status: accepted by lead (DECISIONS 2026-10-16) and BUILT in firmware.**
- Host-tested only, not yet on hardware. Code: `lib/core/beam_health.*`, `goal_app.cpp`, `src/goal/main.cpp`,
  `include/goal/board.h`. Contract: `openapi.yaml` (`beam_*` config, `DeviceStatus.beam`, `reason: beam`).
- Differences from the text below:
  - Step 4 restores the mode without a reading: A's lit level saturates anyway.
  - Twin's finding: a shorted receiver in A read as `ambient_high`. There is now one more reading, LED off
    with both pull-ups, so lit1 = LED on minus LED off at the same 20 k. A short (no change) becomes
    `sensor_dead`, and while that is pending `ambient_high` is held back. The mask is ~4 × `beam_settle_ms`
    (~12 ms); a ball blocks ≥ ~30 ms at the measured 0.55–0.95 m/s.
  - The last health sent to the server is kept in RTC memory, so a lasting fault isn't re-sent every wake.
    A worse state is sent at once, and the same state again after `beam_report_s`.
  - The summary record carries the worst ambient and ball light, not min/avg/max: a log record holds 3 values.
  - No `state_changes` / `mode_changes` OTLP counters: the `[beam]` log records carry each change.
  - New knob `BEAM_ADC_TOP_MV`: a dark node that clips the ADC must never read as light (bench).

Firmware's half of the joint proposal `electronics/beam-health-2026-10-16.md` (electronics owns that
file and the circuit; firmware leads config, health and reporting). Nothing is built yet. All numbers
are EST until the bench. **Updated after electronics' circuit (its §2–§4):** the LED is on D9 with a
boost on D10, a switchable 22 k pull-up is on D6, the ADC is on D2, and VBUS sense moves to GPIO6. The
weak-drive resistor is dropped. There are three server-selectable beam modes, and thresholds are in µA.

## 1. What the user asked for

- Too many balls: the sensor is always blocked.
- Too little difference between ball and no ball.
- Calibrate without firmware changes.
- Time of day matters, because some light gets into the drawer.

Today the goal counter has only `min_block_ms`, `lockout_ms` and `stuck_after_s` as server config, and
`beam_blocked` in its status. BEAM_RX (D8/GPIO19) is digital-only.

## 2. What can and can't be measured (firmware view of the circuit)

- **The lit level shows no margin.** With R_PU 220 kΩ the phototransistor saturates at ~14 µA
  (3.3 V / 220 k), and the typical light current is ~73 µA. The node sits at ~0.1–0.2 V whether
  the margin is 6× or 1.3×. An ADC on the node while the LED is on at full current tells us
  nothing until the beam is about to fail. A sense resistor in the emitter has the same problem,
  because in saturation R_PU sets the current, not the light.
- **Margin needs a weak test drive.** Drive the LED at a known fraction of its normal current for
  a few ms, through a second resistor on its own pin, e.g. 10 k ≈ 0.2 mA ≈ 1/5. If D8 still reads
  clear, the margin is ≥ 5×. With an ADC on the node, the reading under the weak drive sits in the
  linear range, so it gives a graded margin to trend.
- **Ambient needs the LED off with the pull-up still on.** Today D3 feeds both R_LED and R_PU, so
  "LED off" also removes the pull-up. The LED needs its own pin. With the LED off, the node shows
  ambient light alone: near 3.3 V when dark, falling as light gets in. Once it falls below V_IH
  (2.475 V), a ball in the beam can read clear and **goals are missed**. That is the dangerous
  daylight failure. An ADC gives the graded value; D8 alone gives only the cliff.
- **The ball side is measured for free during goals.** When a goal is counted the CPU is awake
  anyway. One ADC read of the node then gives `ball` (I_ball): how dark the gate really is with a real
  ball in it, at that time of day. This is the user's "difference between ball and no ball",
  measured on real goals.

**What firmware needs from electronics** (all met by electronics' §2; kept for the reasoning):
1. The LED on its own GPIO (any pin), with R_PU staying on D3.
2. A weak test drive: a second resistor from another GPIO to the LED anode.
3. An ADC pin on the receiver node, in parallel with D8. D8 keeps counting.

Every header ADC pin (D0–D2) is in use, so the ADC pin has to be one of these:
- **(a)** a back pad: GPIO4, 5 or 6.
- **(b)** D2, by moving VBUS sense to back pad GPIO6. That is the same pin the scoreboard uses, and
  it keeps the beam wiring on the header.

Firmware has no preference; electronics picks.

**Electronics' circuit:**
- LED: D9 (2.2 k, 1 mA), plus a boost on D10 (680 Ω, +3.1 mA).
- Pull-ups: R_PU 220 k on D3, and R_PU_B 22 k on D6 (together 20 k).
- ADC: D2. VBUS sense moves to GPIO6, as on the scoreboard.
- The weak drive becomes "LED 1 mA with both pull-ups on": the node then sits in the linear range.
- Note: D6 is U0TXD. Firmware disables the ROM's wake log on the goal image too (as on the scoreboard). D6 only switches a
  pull-up, and the beam is off while booting, so nothing else is needed.

**"ADC instead of D8" is rejected.** Counting by ADC means sampling every ≤ 2 ms (the shortest block
is 9 ms and `min_block_ms` is 5), and the CPU could never light-sleep. See §5.

## 3. The health check (firmware)

Every `beam_check_s` (default 60 s) while ACTIVE, **only when the beam reads clear and no goal is in
its lockout**:

1. Mask the beam ISR.
2. LED off (active mode's pull-ups), wait `beam_settle_ms` (default 3; the receiver's edges take up to
   ~2 ms at 220 k), then read the ADC (4 samples): **I_amb**.
3. The weak reading: D6 high (20 k), LED 1 mA (D9 only), wait, read: **I_lit1** = (3.3 V − V)/20 k − I_amb. The active
   mode's margin = I_lit1 × (mode LED mA / 1 mA) / (mode's lit need), where the lit need is (3.3 − 0.825 V) / mode R.
4. Back to the active mode, wait, read: the lit reading (only informative in B; A saturates).
5. Unmask. If D8 now reads blocked, a ball came in during the check. The block is timed **from the
   mask start**, so even a 9 ms block still passes `min_block_ms` 5.

- **ISR / latency impact:** the beam is blind for ≤ ~3 × `beam_settle_ms` ≈ 9 ms once a minute,
  only while it reads clear. A goal arriving in that window is counted ≤ 9 ms late, against a
  ~140–240 ms beam → sound chain (INTERFACES §0). It is never lost, because the block is timed from
  the mask start.
- **Per goal:** one ADC read at the moment the goal counts gives **I_ball** (light left with a ball in the
  beam). No masking is needed: the beam is already blocked.
- **Units:** ADC mV are converted to µA via the active mode's pull-up, I = (3300 mV − V) / R. The rail
  is 3.3 V above the 3.45 V cutoff, so no VDD reading is needed. Everything is reported and
  thresholded in **µA**, so one threshold means the same light in every mode. The mode is reported
  alongside.

## 4. Health states and reporting

The worst state wins, in this order:

| State | Firmware sees | Means | What a person does |
|---|---|---|---|
| `sensor_dead` | The LED changes the node by less than `beam_dead_delta_ua` (incl. LED-off reading ≈ 0 V even in B: C–E short) for `beam_dead_checks` checks in a row, while D8 reads clear | Receiver shorted, or ambient flooding it (the server can tell the two apart by the hour: it persists at night) | Check the receiver and its wiring |
| `blocked` | D8 blocked ≥ `stuck_after_s` (exists today) | Queue full / ball stuck, **or** LED/receiver open. Firmware can't tell these apart: they read the same | Empty the drawer; if it is still blocked, check the LED |
| `ambient_high` | I_amb or I_ball above `beam_ambient_max_pct` of the active mode's tolerance (A 3.75 µA, B 41 µA), **after** auto has moved to B (or in a manual mode) | Light reaches the receiver: balls may read as clear | Shade the drawer / receiver (time of day in the history) |
| `low_margin` | The active mode's margin < `beam_margin_min` (×), or I_lit1 fell below its baseline by `beam_drift_pct` | Dirt, misalignment, an ageing LED, or the wrong R_LED | Clean or realign it, or fit the next R_LED (ASSEMBLY §6); auto may step A → A+ |
| `ok` | none of the above | | |

**Reporting (§10):**

- **Status.** A new `beam` object: `health`, `mode`, `amb_ua`, `lit1_ua`, `margin` (×), `ball_ua` (max
  since the last report), `baseline_amb_ua`, `baseline_lit1_ua`, `checked_s` (seconds since the check).
  `beam_blocked` stays for compatibility. A change *into* a worse state sends a status at once
  (reason `beam`), at most once per `beam_report_s`. Today a stuck ball only shows at the next sleep
  or heartbeat.
- **OTLP metrics**, on every report: gauges `foosball.beam.ambient`, `.lit`, `.ball` (µA), `.margin`,
  `foosball.beam.health` (0 ok … 4 sensor_dead) and `foosball.beam.mode` (0 a, 1 a_boost, 2 b), plus
  `foosball.beam.state_changes` and `foosball.beam.mode_changes` counters.
- **OTLP logs:**
  - One record per state change (Warn when worse, Info when back to ok).
  - One record per mode change (Info, with the reason).
  - One summary record every `beam_report_s` (default 600 s) with the min/avg/max of I_amb and I_ball,
    and the mode. That gives observability the **time-of-day ambient profile** from the existing 5-min
    flush, with no new transport.
- **Goal events** stay unchanged. I_ball per goal is only in the summary, to keep the event lean.
- **Who builds what:** backend stores the fields, admin-ui shows a per-device health badge and edits
  the config, and observability adds the alerts. For example, `ambient_high` on two days running at
  the same hour, or `blocked` > 10 min during play.

## 5. Cost

| What | How | Battery cost |
|---|---|---|
| Health check every 60 s | ~10 ms of CPU at ~25 mA, no radio = 0.25 mAs; 60/h × 4.7 h | ≈ 0.02 mAh/day: no change in months |
| I_ball per goal | 1 ADC read in an already-awake path | ~0 |
| Status at a state change | rare; on the open connection | ~0 |
| Metrics + summary records | ride the existing 5-min flush | ~0 |
| Weak reading / LED off | a few ms per minute | ~0 (LED off saves a sliver) |
| Modes A+ / B (electronics §3) | +3.1 / +3.25 mA, only while selected | Electronics' §3 gives the battery effect; mode A is unchanged |
| **Rejected: counting by ADC / pulsed on-minus-off on the main CPU** | sampling ≥ 500 Hz, ~0.2 ms awake each at ~25 mA ≈ 2.5–5 mA average | **+12–23 mAh/day**: the goal counter goes from ≈ 14.6 to ≈ 27–38 mAh/day, roughly halving its battery life (INTERFACES §0 range) |
| Rejected for now: the LP core | The C6's LP core has **no ADC** (`soc_caps.h`: no LP ADC). It could pulse and read digitally on LP GPIO, but the receiver's ~2 ms edges limit the pulse rate, and our Arduino toolchain has no LP-core build | — |

- **Daylight rejection for counting itself** (not just detecting it) needs one of these:
  - a modulated receiver (TSSP40xx, ~0.35 mA, electronics' earlier comparison);
  - main-CPU pulsed sampling (above);
  - mechanical shading of the receiver's view, which is the cheapest. The receiver sees ±20°.
- Firmware could also run pulsed sampling **only while `ambient_high`** (adaptive), paying the cost
  only in the bright hours. Firmware's proposal: don't build either until the field data shows it is
  needed.

## 6. Server config (openapi `DeviceConfig`; all optional, missing = default, out of range ignored)

| Field | Default | Range | Meaning |
|---|---|---|---|
| `beam_mode` | `a` | `a`, `a_boost`, `b`, `auto` | Electronics' modes A / A+ / B (snake-case for the backend's enums) |
| `beam_check_s` | 60 | 0, 10–3600 | Health check period while ACTIVE; 0 = off (also stops auto) |
| `beam_settle_ms` | 3 | 1–20 | Receiver settle after each LED / pull-up change (bench knob) |
| `beam_ambient_max_pct` | 60 | 1–100 | `ambient_high` above this % of the active mode's ambient tolerance |
| `beam_margin_min` | 2.0 | 1.0–20 | `low_margin` below this lit margin (×) in the active mode |
| `beam_drift_pct` | 30 | 0–100 | `low_margin` when I_lit1 falls this far below its baseline; 0 = off |
| `beam_dead_delta_ua` | 2 | 0–1000 | The LED changes the node by less → counts toward `sensor_dead` |
| `beam_dead_checks` | 3 | 1–100 | Consecutive checks before `sensor_dead` |
| `beam_baseline_min` | 120 | 0–1440 | EWMA time constant of the tracked I_amb / I_lit1 baselines; 0 = none |
| `beam_report_s` | 600 | 60–86400 | Summary record period; also the minimum gap between `beam` statuses |
| `beam_ambient_switch_ua` | 1.5 | 0–100 | auto: A → B when the ambient baseline passes this |
| `beam_ambient_return_ua` | 0.75 | 0–100 | auto: B → A when it falls below this (hysteresis) |
| `beam_mode_min_dwell_s` | 300 | 0–86400 | auto: minimum time in a mode |
| `beam_r_pu_a_ohm` | 220000 | 1000–10000000 | Fitted R_PU (for the µA conversion) |
| `beam_r_pu_b_ohm` | 22000 | 1000–10000000 | Fitted R_PU_B |
| `beam_led_ma` | [1.0, 3.1] | 0.1–20 each | LED current from D9, and the boost from D10 |

- Existing fields keep their meaning: `min_block_ms`, `lockout_ms`, and `stuck_after_s` (→ `blocked`).
- **The baselines** follow the slow daily swing, and only while the beam reads clear. They drive
  auto's switch, so one bright reading doesn't flip the mode, and they're reported so the admin view
  can show "today vs usual".
- **Auto safety (firmware's addition).** Mode B's lit margin is only ~2.4× typ, ≈ 0.34× at the
  datasheet minimum (electronics §3).
  - After auto switches to B, the next check must show a margin ≥ `beam_margin_min`. If it doesn't,
    or the beam then reads blocked for longer than `stuck_after_s`, auto goes back to A and holds
    there for `beam_mode_min_dwell_s`. It reports `ambient_high` + `low_margin`: B can't be used with
    these optics, so the fix is R_LED_B or shading.
  - `low_margin` in A steps to A+ the same way. A+ returns to A only when A's margin would be
    ≥ 2 × `beam_margin_min`.
- **Mode switches mask the ISR** like the check does (≤ `beam_settle_ms`), and run only while the beam
  reads clear, outside any lockout.
- **"Calibrate without firmware changes":** the mode (or auto with its thresholds), detection timing and
  every health threshold are server config. The fitted resistor values are config too, so a builder
  who fits 470 Ω for R_LED_B enters `beam_led_ma` without a reflash. The D8 input threshold itself
  isn't adjustable, and the modes replace that knob. Electronics' circuit drops the PWM / `beam_led_pct`
  / LEDC keep-alive question.
- **Deep sleep:** D3/D6/D9/D10 low or floating (no beam current either way); D2 is analog high-Z.

## 7. Contract and work items (after lead's review; nothing is built)

| Item | Owner |
|---|---|
| `openapi.yaml`: the `DeviceConfig` fields above, the `DeviceStatus.beam` object, and `reason: beam`; check_openapi payloads | firmware |
| Firmware: `lib/core` health logic + host tests (state machine, modes + auto with its safety, baseline, µA conversion, mask timing); goal shell: pins D2/D3/D6/D9/D10, VBUS → GPIO6, ROM wake log off, ADC read | firmware |
| Store and serve config + status fields; `api/docs/hardware-api.md` | backend |
| Health badge + beam config editor | admin-ui |
| Metrics, the ambient-by-hour panel, alerts | observability |
| Circuit: LED pin, weak drive, ADC pin (a or b), parts | electronics |
| INTERFACES §2 (pins), §6 (config/status), §10 (telemetry) rows | owners as listed |
| Twin: a drawer-light scenario (ambient rising → `ambient_high`) and a full drawer (→ `blocked`) | twin |

**Bench before the thresholds become real:** follow electronics §5. Read I_amb, I_lit1 and I_ball in the real
sled in the morning, at midday and in the evening, and under a desk lamp, in each mode. Set the defaults
above from those readings.

## 8. Firmware's recommendation

1. **Build the health check now, on electronics' circuit (its §2).** It costs ≈ 0 battery, ≤ 9 ms of blind beam a minute,
   and about 1 kr of parts before anything is bought.
2. **Make every threshold server config, in µA** (§6), and track the baseline over the day.
3. **Ship `beam_mode` = `a` with auto off** (electronics §1). Turn auto on once the field data shows the daily pattern.
   Auto must have the B safety check above.
4. **No pulsed counting.** If even mode B can't cope (ambient above ~40 µA), shading is the fix.
