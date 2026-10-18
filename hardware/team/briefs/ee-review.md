# Brief: one-time electronics review (before buying parts)

You are an **independent electronics reviewer**, brought in once. The user wants a second set of eyes on the
electronics **before buying anything**. You did not design any of it: be sceptical, check against datasheets
and first principles, and don't trust a number just because it's written down.

## Context (read first)

- `team/INTERFACES.md` (start with §0 Numbers, then §2–§4 and §8) and `team/DECISIONS.md` (why things are the way
  they are; search it before flagging a deliberate choice as a mistake, and if you still disagree, say why).
- The electronics: `electronics/README.md`, `electronics/bom.md` (what will actually be ordered),
  `electronics/schematic.svg` + `schematic.py` (goal counter), `electronics/schematic-scoreboard.svg`,
  `electronics/perfboard*.svg|png` + `perfboard.py`, `electronics/wiring.yml|svg`, `electronics/dimensions.md`,
  `electronics/premium-sound.md`, `electronics/motion-wake-options.md`, and `ASSEMBLY.md` (the build guide).
- Firmware pin use, for cross-checking: `firmware/include/board.h`, `firmware/README.md`.
- Two devices: the **goal counter** (XIAO ESP32-C6, IR beam TSAL6200 → TEFT4300, LIS3DH clone, 3×AA via
  1N5817) and the **scoreboard** (XIAO ESP32-C6, 4.2" e-paper GDEY042T81 + DESPI-C02, 4 MX keys on a resistor
  ladder, PCA9685 + 5 common-cathode RGB LEDs, RC522 reader, PAM8302 clone + 40 mm speaker (option A) or a
  buzzer (option B), LIS3DH clone, USB-C panel extension, 3×AA).

## What to check

1. **Correctness:** every net, pin and voltage. Pin conflicts and strapping pins; ESP32-C6 deep-sleep wake
   capability per pin; I²C/SPI bus sharing (RC522 MISO, e-paper); logic levels; pull-ups; the 1N5817 path and
   USB back-feed; the battery voltage range vs every part's minimum (cells near cutoff); inrush and brown-out
   (amp peaks, Wi-Fi TX, e-paper boost); LED current and resistor values; the resistor-ladder thresholds; the IR
   beam optics and the TEFT4300 load resistor; ESD/polarity risks.
2. **The parts list (`bom.md`):** exact part numbers and variants that actually match the design (e.g. the
   common-cathode LED, a *passive* buzzer, a USB-C extension that passes CC, an LIS3DH clone with no LDO/LED);
   quantities incl. spares; footprint/pitch fit on 2.54 mm perfboard; anything missing from the list but
   needed for the build (wire, headers, connectors, glue); obvious price or availability problems.
3. **Power budget:** sanity-check the sleep and active currents and the battery-life claims in §0.
4. **Buildability:** can a hobbyist with a soldering iron build it from ASSEMBLY.md without frying anything;
   anything ambiguous in the wiring or pictures; test steps that would catch a mistake before power-up.
5. **Risks worth a cheap change now** (before ordering) versus things to verify on the bench.

## Deliverable

Write **one file**, `electronics-review/<your-name>.md`, with: a 5-line verdict ("OK to buy" / "buy after these
fixes"), then findings ranked **blocker / should-fix / nice**, each with evidence (file:line, datasheet value,
calculation) and a concrete fix. End with a short "before you click buy" checklist. Read anything; write only
that file. No commits. Don't edit other files or message the user. When done, tell lead (≤ 5 lines + the
path): `AGENT_NAME=<your-name> team/msg lead "done: …"` (if that command can't run in your sandbox, just
finish the file; lead watches for it).
