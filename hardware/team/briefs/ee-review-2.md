# Brief: independent hardware review of the goal counter (before buying)

You are an **independent hardware reviewer**, brought in once. Nothing gets bought until this review is done. The
user's bar: **we can always update firmware, but we must be 99–100 % sure about the hardware** — that it can be
bought, assembled and powered up, and that it will work in the table the first time.

You did not design any of it, and on purpose you get **no design history**: judge the hardware on its merits. Be
sceptical, check against datasheets and first principles, and don't trust a number because it's written down.
**Challenge decisions** where you see a simpler, cheaper or more robust alternative: say what you'd do instead and
what it changes.

## Scope

**The goal counter only** (one per goal, two per table). A scoreboard exists in the files but is parked: ignore it.

The device: a 3D-printed sled in two units that slides into a foosball table's ball drawer through a ~130 × 57 mm
frame opening. Inside: a Seeed XIAO ESP32-C6 on a 70 × 30 perfboard, an IR beam (TSAL6200 emitter → TEFT4300
phototransistor) across the ball path, a LIS3DH clone (motion wake), a 0.91" 128 × 32 SSD1306 OLED, an MX blue key
switch (undo button), a passive buzzer, two status LEDs, and 3 × AA NiMH in a pull-out drawer with pogo-pin
contacts, through a 1N5817 to the XIAO's battery pads. Wi-Fi to a server. USB-C reachable for reflashing.

## Read these (and only these, plus datasheets)

- `electronics/README.md`, `electronics/bom.md` (what will be ordered), `electronics/schematic.svg` + `schematic.py`,
  `electronics/perfboard.svg|png` + `perfboard.py`, `electronics/wiring.yml|svg|png`, `electronics/dimensions.md`.
- `ASSEMBLY.md` (the build guide) and `mechanical/SLED-ASSEMBLY.md` (how it goes into the sled), the renders
  `mechanical/out/sled_*.png`, and `mechanical/sled.py` if you need a dimension.
- Firmware pin use, for cross-checking only: `firmware/include/board.h`, `firmware/README.md`.
- `team/INTERFACES.md` §0 (headline numbers) and §2–§4 (pins, power, part dimensions).

**Don't read** `team/DECISIONS.md`, `team/log.md`, any `reports/` folder, dated study files (`*-2026-10-*.md`),
`electronics-review/` (earlier reviews), `presenter/`, `GUIDE.html` or `video/`. They explain why things are as they
are; the point of this review is to see the design without that.

## What to check

1. **Will it work electrically?** Every net, pin and voltage. ESP32-C6 strapping/JTAG pins, which pins can wake
   from deep sleep and which the LP core can drive, ADC pins, I²C sharing (LIS3DH + OLED), pull-ups, the battery
   path (3 × NiMH, 1N5817, the XIAO's battery pads and charger, USB back-feed with cells in), brown-out at low cells
   during Wi-Fi TX, the IR beam (emitter current, phototransistor load, ambient light, margins), LED/buzzer drive,
   reverse polarity and ESD (pogo contacts, a drawer pulled under load).
2. **Can every part be bought as specified?** Exact parts and variants in `bom.md` (pinouts of the clone modules,
   SSD1306 vs SSD1315, 3- vs 5-pin MX, passive vs active buzzer, pogo pin stroke/force), quantities and spares,
   anything needed but missing from the list (wire, headers, heat-shrink, glue, tools).
3. **Can a hobbyist build it from the guides** without frying anything or getting stuck? Order of steps, soldering
   on perfboard, wire lengths and routing in the sled, plugs that can go in the wrong way, test steps before
   power-up, first power-up and bring-up checks.
4. **Will it survive in the table?** Ball hits and vibration, connectors working loose, the battery drawer, the
   antenna inside a wooden table near metal, heat, moisture, months on batteries.
5. **Simpler or smarter alternatives** (an off-the-shelf module, fewer parts, a different sensor or power scheme),
   with the trade-offs.

## Deliverable

Write **one file**, `electronics-review/2026-10-18-<your-name>.md`:
- a 5-line verdict: "OK to buy" or "buy after these fixes", and your confidence that it works first time;
- findings ranked **blocker / should-fix / nice**, each with evidence (file:line, datasheet value, calculation)
  and a concrete fix;
- "challenges": decisions you'd change, with the alternative;
- a short **bench checklist**: what to verify on the first unit before building the second.

Rules: read-only everywhere except your one file. No buying, no commits, no installs. Datasheet lookups online are
fine. When done, send lead ≤ 5 lines + the path: `AGENT_NAME=<your-name> team/msg lead "<summary>"` (run it from
`hardware/`). Questions go to lead the same way; don't contact other agents.
