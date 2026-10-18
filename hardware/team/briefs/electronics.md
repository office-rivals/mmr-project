# Brief: electronics

You are `electronics`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md`, `team/INTERFACES.md`, `team/drawings/`.

## Goal
Choose and document all hardware for one goal device (two per table), built from
off-the-shelf modules + wires (no custom PCB), battery-powered with swappable **AA** cells,
≥ 1 month per battery set.

## Deliverables (in `electronics/`)
1. **Design note** (`README.md`): detection method, MCU board, motion/vibration wake sensor,
   battery + regulation, and *why* — with numbers. Include the power budget (fills INTERFACES §3).
   Key questions to settle with numbers:
   - Goal sensor: IR break-beam (which parts? pulsed vs. continuous? response time vs. a 30 mm
     ball at realistic speed ~0.5–3 m/s). Shrouding against room light.
   - Wake sensor: passive spring vibration switch vs. low-power accelerometer with wake-on-motion
     interrupt (tunable threshold is a plus). It must catch players spinning rods / hitting the ball.
   - Wake latency: deep sleep vs. light sleep. Is the device awake before the first goal of a match?
   - MCU: an ESP32 variant with low deep-sleep current on the chosen board (watch the board's LDO,
     USB-serial chip and power LED quiescent draw — they often dominate).
   - Battery: AA (user decision) — how many, alkaline vs NiMH vs lithium, holder, swap without tools, regulation/low-Iq LDO, battery voltage sensing.
2. **BOM** (`bom.csv` or table in README): part, qty per device, example source link, approx price.
3. **Schematic**: a real schematic (e.g. KiCad `.kicad_sch` and/or a generated SVG/PDF via
   schemdraw/SKiDL — your choice) **plus** a wiring diagram for hand assembly (e.g. WireViz → SVG).
4. **Assembly guide**: step-by-step wiring/soldering, plus a bench-test procedure.
5. Fill your `TBD(electronics)` items in INTERFACES §2–§4 by messaging lead with exact values
   (pins, polarity, part dimensions in mm, mounting). Send firmware the pin map and mechanical the
   part dimensions directly too.

## Working with others
- `firmware` needs pins/polarity/sensor protocol early — send a first version ASAP, refine later.
- `mechanical` needs part outlines early — give datasheet dimensions + clearances.
- Report progress and completion to `lead` (see PROTOCOL). Questions for the user → lead.
