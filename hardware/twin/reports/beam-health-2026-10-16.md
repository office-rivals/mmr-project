# Twin: beam health scenarios (2026-10-16)

> Superseded numbers: review 2 (2026-10-18) fitted R_PU_B 68 k (b = 52 k) and a 6.3 mA LED pair. Mode b now loses
> balls above ~16 µA, and the scenarios' light levels are fractions of firmware's limits; see twin/README.md.

Asked by electronics (drawer light, full drawer) and lead (also low margin, sensor dead, health in
status and OTLP, no goal lost or double-counted). Built on firmware's `lib/core/beam_health` and
`firmware/beam-health-firmware-2026-10-16.md`.

**Result:** 26 scenarios (was 24). `./run-ci.sh` passes 26/26 at 31 mm and at 36 mm, selftest ok (mock server).
Not yet run against the real API; that needs backend (below).

## Receiver model (twin/src/devices.h, GoalDevice)

- Node = 3.3 V − I × R_pullup(active mode), where I is the LED light (73 µA per mA typ, none with a ball
  in the gate) plus the drawer light. Fitted parts are firmware's `beam::Cfg` defaults.
- Between V_IL and V_IH the twin reads the wrong way: a ball reads clear, no ball reads blocked. Mode a
  therefore loses balls above ~3.75 µA of drawer light, and mode b above ~41 µA (electronics §3).
- `beamCheck`: amb = LED off with the active pull-ups; lit1 = LED 1 mA with both pull-ups (matches
  firmware's formulas). `beamMv`: the node during a goal.
- Scenario knobs: `setAmbient(µA)`, `lit_ua` (dirt, a weak LED), `shortReceiver()`.
- Light, ball or short changes fire the beam ISR when the digital level changes. Not modelled: the ISR
  mask during a check (≤ 9 ms).

## Scenarios

| Scenario | What it shows |
|---|---|
| `drawer_queue` (extended) | A parked ball → `blocked` at once (status reason `beam`) and at sleep; drawer emptied → `ok`; each goal counted once |
| `drawer_light` (new; home `a`, away `auto`) | 3 µA: `a` → `ambient_high` (goals still count), auto → `b` (`ok`). Sun, 30 µA: `a` can't see the ball (goal lost, none made up), `b` counts it and reports `ambient_high`. Dark: auto → `a` ("dark again"). Dirty receiver: `low_margin` (drift) first, then auto's `b` trial fails its margin check → back to `a`, held for the dwell, `ambient_high` |
| `beam_faults` (new; home `a`, away `b`) | Dirty aperture (lit −38 %) and a weak LED (b margin 1.8×) → `low_margin` in the beam status, the sleep status and OTLP `foosball.beam.health` = 1, every goal counted; fixed → `ok` (0). Shorted receiver → `sensor_dead` in `b` (OTLP 4), no goal made up |

Goal integrity: the score is checked after every goal in every step, so a lost or double-counted goal fails.
The exception is where the physics makes a goal invisible (mode a in sun, a shorted receiver). There
the scenario checks that no goal is made up.

## Findings for firmware

1. **A shorted receiver in mode a reports `ambient_high`, never `sensor_dead`.** lit1 = I(20 k) −
   I(220 k), and at a node stuck at 0 V that is 165 − 15 = 150 µA, which looks like a strong LED.
   Mode a is the shipping default. Comparing the node mV LED-off vs LED-on (both at 20 k) would catch it.
   The twin notes it as KNOWN and stays green; it can become a check once this is fixed.
2. **The beam status is re-sent on every wake while the state persists** (FYI). `health_` and the note
   time aren't in RTC memory, so each session's first check is "a change into a worse state" again.
   This is within the `beam_report_s` limit, and cheap (it rides the session).
3. A shorted receiver in b: the at-once status said `ambient_high` (first check), and `sensor_dead`
   came at sleep. Since firmware's fix, `sensor_dead` is sent at once (see the update below).

## For backend (real-API run)

The registry (`twin devices`) now carries extra device config: table 27 away `"beam_mode": "auto"`,
table 28 away `"beam_mode": "b"`. The stack seed needs to pass `beam_mode` into the device config.
Statuses with the `beam` object and `reason: beam` must be accepted.

## Update (same day): firmware fixed 1 and 2

- `Reading.amb20_mv` (LED off, 20 k) is filled. A shorted receiver now reports `sensor_dead` in both modes,
  at once, and `beam_faults` checks this (the KNOWN note is gone).
- The last health sent is kept in RTC memory. A lasting state is re-sent only after `beam_report_s`, by
  design. `drawer_light` checks that repeats keep the same state and are ≥ 600 s apart.
