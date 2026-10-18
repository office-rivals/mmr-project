Buy after these fixes; the architecture is suitable for a prototype, but the current build instructions are not ready.
Blocker: the goal-counter drawings still put the beam on D2, where current firmware expects USB sense.
Blocker: the speaker supply bypasses polarity protection and leaves powered control signals connected to an unpowered amp on USB alone.
Blocker: the 3.3 V pack cutoff permits operation below the ESP32-C6's specified supply range.
Correct the BOM and qualify one assembled set before buying multiples; the 4.4–5 month figures remain estimates.

# Independent electronics review — ee-review-codex

Reviewed 2026-10-15. Scope: the brief's electronics, assembly instructions, interface contract and decisions, plus the firmware's actual pin assignments, peripheral setup and power handling. References below are workspace-relative. This is a desk review, not electrical certification or a bench measurement. I did not consult another reviewer's findings or change the design.

## Blocker

### B1. A goal counter built from the supplied drawings does not match the firmware

**Evidence:** `team/DECISIONS.md:175` explicitly approves moving the beam to D8 and adding USB sense on D2. `team/INTERFACES.md:74` and `firmware/include/goal/board.h:16` implement that contract. However, `ASSEMBLY.md:235`, `electronics/README.md:213`, `electronics/perfboard.py:58`, and `electronics/schematic.py:287` still connect BEAM_RX to D2. `electronics/wiring.yml:40` does not even expose D8 or USB VBUS. The inspected goal perfboard PNG agrees with the obsolete source. There are no goal-board USB-divider parts or wiring steps.

**Consequence:** firmware samples an unconnected D8, while the clear/blocked beam can be mistaken for USB presence on D2. Counting, sleep and flash-in-place wake cannot work as specified. The assembly calibration at `ASSEMBLY.md:354` measures the wrong pin for current firmware. The README's proposed ADC fallback is also obsolete: GPIO19 is not an ADC input.

**Fix before releasing the order/build package:** propagate the approved mapping through the goal schematic generator and SVG, perfboard generator and images, WireViz source and images, README, assembly/calibration instructions and BOM. Reserve two holes/pairs for the 68 kΩ/100 kΩ divider on each goal board. Add a continuity/pin-map check against both firmware headers. Keep the scoreboard's D2 ladder unchanged. Confirm beam edge/light-sleep wake on GPIO19 with the production image.

### B2. The speaker's raw-pack branch breaks the stated power-safety assumptions

**Evidence:** `electronics/premium-sound.md:19`, `electronics/schematic.py:148`, `electronics/perfboard.py:100`, and `ASSEMBLY.md:497` put PAM8302 VIN and its polarized 470 µF directly on VPACK, before D1. Nevertheless `ASSEMBLY.md:321` says reversing J_BAT damages nothing, and S5 reuses that power-on procedure. A reversed J_BAT applies reverse voltage directly to the amplifier and C_AMP. The battery disconnect is keyed, but the board-side Dupont header remains reversible.

There is a second, normal-use case: remove the pack while USB remains plugged in. The MCU and PCA9685 remain powered; the amp loses VIN. `firmware/src/scoreboard/speaker.cpp:95` still starts PDM and asserts amp enable without checking pack presence. The [PAM8302A absolute maximum table, p.2](https://www.diodes.com/datasheet/download/PAM8302A.pdf) limits input voltage to VDD + 0.3 V. Driving SD to 3.3 V with VDD near zero is outside that limit; the PCA board's 220 Ω series resistor is not supply isolation. Phantom powering and uncontrolled behavior are possible. The input coupling capacitor does not isolate SD.

**Fix:** choose and document an amp power path that handles reverse connection and USB/battery removal. One workable direction is a protected pack branch diode-ORed with USB VBUS, with C_AMP after isolation; select the parts and check voltage/current/dropout before adoption. Alternatively retain battery-only audio, add reverse protection and hardware isolation of SD when amp VIN is absent, and suppress playback without a pack. A firmware-only pack check cannot protect a mid-sound unplug. Do not simply move the amp onto XIAO BAT and assume USB can power it: the charger is only 120 mA. Update the drawing, layout, BOM and assembly together; test pack-only, USB-only, both, and a pack removal during sound using a current-limited supply.

### B3. Brown-out reset is being used as permission to operate below the MCU's rated voltage

**Evidence:** `electronics/README.md:167` calculates a 2.85 V rail during a TX burst at the 3.3 V pack cutoff, then accepts it because BOD is 2.51 V. The [ESP32-C6 hardware design guidelines](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32c6/schematic-checklist.html) specify 3.0–3.6 V supply operation. A reset threshold below that range does not guarantee correct RF, CPU or flash operation in between. The stated calculation also omits wiring/contact resistance and regulator/pass-device loss. Firmware uses 15 dBm TX, which helps but does not establish a guaranteed rail minimum.

The 470 µF capacitor is useful decoupling, not a substitute for this margin: if it alone supplied 350 mA for 1 ms, ΔV = I·t/C = **0.745 V**, before ESR. `electronics/README.md:146` overstates its ability to carry millisecond bursts. The scoreboard adds reader and display load; the amp shares battery impedance even though it bypasses D1.

**Fix:** set cutoff from a guaranteed minimum *loaded 3V3 rail*, including battery resistance, diode drop, contacts, ADC error and simultaneous loads. With the note's own 0.45 V loss, an unloaded 3.45 V pack is only a zero-margin starting point; 3.3 V cannot be the accepted threshold. Start conservatively, measure the rail on a scope during TX/refresh/scan/sound, then establish warn/cutoff/resume values and revise usable-capacity estimates. If the required AA capacity cannot be used while staying in specification, reconsider regulation. Journaled storage remains valuable but does not fix undervoltage operation.

## Should-fix

### S1. The lean order is missing quantities and consumables needed for its own build

**Evidence:** `electronics/bom.md:28` lists three 10 kΩ and two 100 kΩ resistors; row 32 adds only one 68 kΩ. For two goal counters and one scoreboard, including the approved USB-sense change, the minimum is:

| Value/item | Required before spares |
|---|---:|
| 1 MΩ | 6 |
| 2.2 kΩ / 220 kΩ | 2 / 2 |
| 68 kΩ | 3: USB sense on all three devices |
| 100 kΩ | 5: three USB dividers, key pull-up, buzzer base pull-down |
| 10 kΩ | 4: two role straps, K3, audio filter |
| 4.7 kΩ / 22 kΩ / 1 kΩ selector | 1 each |
| 470 µF / 100 nF / 10 nF / 1 nF | 4 / 3 / 1 / 1 |

`electronics/bom.md:144` and `ASSEMBLY.md:274` count a two-conductor beam/battery lead as one jumper. Each goal device needs **six single-conductor 30 cm jumpers**, not three; two goals consume twelve before the scoreboard's approximately eight. The lean list's “~14 used” out of twenty is therefore misleading. It also does not explicitly order the approximately 4.5 m of scoreboard hook-up wire called for at `ASSEMBLY.md:454`, plus goal-board underside/clone wiring. Generic female headers are not necessarily reliable sockets for thin resistor leads.

**Fix:** publish one counted first-table cart, add hook-up wire and some jumper/resistor spares, specify 1% resistors for dividers/ladder, and use sockets/contact dimensions that grip the chosen resistor leads. Recount parts after B2. Explicitly list two-contact Dupont housings if the procedure requires them. The 50×70 perfboard grid must be checked against the pictured 24×18-hole layout before buying; nominal board dimensions alone do not establish its hole origin.

### S2. The clone amp needs a defined module specification and an actual gain-setting procedure

**Evidence:** `electronics/premium-sound.md:14` assumes onboard input coupling; `electronics/bom.md:43` buys a generic CJMCU-style clone. `ASSEMBLY.md:550` tells the builder to find a pull-up with a continuity beep and concludes that no beep means no resistor. A several-kΩ pull-up will normally **not beep across its ends**. Trace each end to the relevant pin, then measure resistance; identify the specific board before removing anything.

`electronics/premium-sound.md:34` recognizes clipping from 24 dB gain, but `ASSEMBLY.md:560` starts with the pot fully up, and S5 offers only a 10 kΩ shunt for a potless clone. That is not a calibrated ceiling. Under the design's full-scale assumption, 1.65 V peak × roughly 15 gain is about 25 V peak before attenuation—far beyond a 3–5 V bridge supply. Even allowing filter/input loading, a nominal −6 dB shunt is not sufficient assurance.

**Fix:** require a clone with SD access, input coupling capacitors on the module inputs, local ceramic supply bypass, documented pin order, and either a pot or a specified attenuation network. Begin at minimum gain; use the actual samples or a test tone and set the maximum at the lowest permitted battery voltage. Add a small attenuation-resistor assortment to the order. Verify SD-to-VIN resistance before/after removal and the sleep-current increment. Keep both speaker terminals isolated from ground; label this explicitly in the build guide. The existing twisted, short output leads and RF keep-outs are sensible.

### S3. Green/blue LED current and color matching are not guaranteed at 3.3 V

**Evidence:** `electronics/README.md:359` assumes approximately 2 mA through 220 Ω for green/blue. [Kingbright's actual datasheet, p.2](https://www.kingbrightusa.com/images/catalog/SPEC/WP154A4SUREQBFZGW.pdf) gives typical Vf = 3.3 V at 20 mA, with maxima 4.0 V blue and 4.1 V green. Lower-current Vf will be lower, so this does **not** prove the LEDs cannot light; it does mean a 3.3 V logic supply gives little guaranteed headroom, especially near dropout. The PCA9685 sourcing output also has voltage drop; it is not an ideal 3.3 V source ([NXP, static characteristics](https://www.nxp.com/docs/en/data-sheet/PCA9685.pdf)).

**Fix:** buy a small sample/spares and verify all six colors through the diffuser at the minimum allowed rail. Measure channel currents and calibrate the palette. If this fails, choose a part characterized for the required low current/voltage or revise the drive arrangement before ordering all fifteen LEDs. Do not solve a dim channel by deleting its current limiter. Common cathode is the correct polarity for the present wiring. The genuine [Adafruit 815](https://www.adafruit.com/product/815) does include 220 Ω on each output; check those resistors explicitly on any clone substitution.

### S4. The optical budget is typical-only; keep calibration mandatory and correct the geometry claims

**Evidence:** `electronics/README.md:53` estimates 73 µA typical and “roughly 1×” minimum margin. Recomputing its assumptions gives **10.20 µA** at the quoted minimum efficiencies versus **11.25 µA required** to meet 0.825 V LOW with 220 kΩ: minimum margin is **0.91×**, already a miss. The [TSAL6200](https://www.vishay.com/docs/81010/tsal6200.pdf) intensity guarantee is at 100 mA, not the design's 1 mA; proportional scaling is an estimate. The [TEFT4300](https://www.vishay.com/docs/81549/teft4300.pdf) light-current test is at VCE = 5 V, and its microsecond timing is at 100 Ω load, not 220 kΩ. Neither guarantees the claimed 2 ms response here.

`electronics/dimensions.md:79` specifies 12 mm emitter-tip and 4 mm receiver-tip recesses, while the README's shielding argument uses two 8 mm recesses. Thus the receiver's asserted ±10° view is not established by the final geometry. Emitter/receiver active points are also behind their dome tips.

**Fix:** retain the approved DC/narrow-channel design and socketed calibration; no need to buy a different sensor architecture now. Order 470 Ω, 1 kΩ, 100 kΩ and 470 kΩ alternatives plus one spare optical pair. Record the resistor pair that achieves <0.4 V clear and >2.9 V blocked in the final sled, over alignment tolerance, lowest rail and room lighting. Scope the transitions and test actual slow/fast balls. Fit TEFT4300 collector/emitter by the manufacturer's drawing rather than using an apparently working reversed transistor as the polarity test. Remove the obsolete D2 ADC-fallback claim.

### S5. The battery-life arithmetic is plausible, but its inputs do not match the assembled system

**Evidence:** 1700/11 = 155 days and 1700/12.7 = 134 days do reproduce the headline estimates. However:

- `electronics/README.md:189` budgets the RF-switch GPIO as released between bursts. `firmware/lib/device/device.cpp:166` releases it only when Wi-Fi is turned off; `connect()` holds it low throughout association. The specified 10 kΩ pull-up therefore adds **0.33 mA × 4.7 h = 1.55 mAh/day** unless already included in a measured board baseline. No such measurement is recorded.
- `team/INTERFACES.md:85` assumes 40 goals/hour **per goal counter**: two counters × four hours gives 320 scoreboard goal updates/day. `electronics/README.md:398` uses about 170 and `electronics/premium-sound.md:135` also starts from 170 goal sounds. Reconcile per-goal versus per-table activity before quoting the scoreboard life.
- The generic electrolytic at `electronics/bom.md:139` has no leakage specification supporting the assumed 2 µA. The scoreboard has a second 470 µF on the raw pack. Actual capacitor leakage, clone regulators/LEDs, repeated long-poll replies, telemetry, and Wi-Fi losses need inclusion.
- `electronics/README.md:396` totals about 39 µA including its later sleep extras, before amp/C_AMP uncertainty. A whole-scoreboard ≤30 µA criterion copied from the goal device cannot be used to accept its LIS3DH clone.

**Fix:** separate measured module current from modeled traffic, include the RF-switch current and both counters' traffic, specify a capacitor with suitable leakage or qualify it, and integrate pack current for a representative session and sleep period. Show a range until then. The original one-month target allows roughly 57 mAh/day at the assumed capacity and still looks feasible, but B3 can reduce usable capacity. Do not promise four or five months from this desk calculation.

### S6. Several purchasing and assembly assumptions need an exact variant, not a search phrase

**Evidence:** `electronics/bom.md:24`, `:43`, and `:47` specify generic LIS3DH, amp and angled USB extension listings. The chosen LIS3DH must fit the allotted area, expose INT1, have pull-ups to the actual 3.3 V rail, and permit removing/bypassing an LDO without unwanted reverse supply current. `ASSEMBLY.md:166` says to use VCC if that is the only pin; that is insufficient for an unknown board with an LDO. C3H marking plus firmware WHO_AM_I = 0x33 is useful, but does not validate the module's power circuit.

The fast-order promise also needs updating: the checked [OpenELAB panel listing](https://openelab.io/products/4-2-inch-e-ink-high-rate-refresh-e-paper-400x300-spi) identifies SKU GDEY042T81 but currently states **shipping from China within 5–10 working days**, contrary to `electronics/bom.md:34`'s 3–5 days from Munich. The [adapter listing](https://openelab.io/products/24-pin-serial-e-paper-screen-hat-adapter-board) identifies DESPI-C02. These are the right named parts, but delivery and checkout totals are not established by the existing cart estimate.

**Fix:** save actual supplier SKU/variant/photos and a pin-by-pin modification note for the clone batch; buy one batch to qualify before scaling. Check the USB plug's angle, overmould and ear pitch against the enclosure. Confirm panel plus separate adapter, VAT/shipping and stock at checkout. A USB 2.0 designation does not itself imply missing CC: require demonstrated CC/data continuity and successful power/enumeration in both accessible plug orientations, not just a “USB 3.1” title.

### S7. The buzzer schematic and layout put the pull-down on different sides of the selector

**Evidence:** `electronics/schematic.py:108` draws R_BD on the **GPIO side** of R_B; `electronics/perfboard.py:103` and `ASSEMBLY.md:519` connect it to the **transistor base side**. With the R_B selector absent in speaker mode, the schematic leaves the populated transistor base floating, whereas the layout correctly holds it low.

**Fix:** make the schematic agree with the layout: R_BD from BC337 base to emitter/GND, after the socket. Keep the flyback diode cathode on buzzer positive. Specify the exact transistor pinout when substituting 2N4401 for BC337; they are not interchangeable lead-for-lead. Bench-check buzzer current and transistor heating at maximum permitted pack voltage with the R_SND link, then choose the ceiling resistor if needed. The manufacturer's catalog identifies CMT-1209-390T as a 3 V, 2048 Hz magnetic transducer; I could not retrieve its full operating-voltage table, so its full-pack drive is not signed off here.

## Nice

### N1. Consolidate old assembly and dimension text before handing the guide to a hobbyist

`ASSEMBLY.md:80` still asks for 20 cm jumpers cut in half, conflicting with the later 30 cm whole-lead procedure. `electronics/dimensions.md:122` and `ASSEMBLY.md:714` retain the old top-mounted reader orientation, while the current interface specifies the front wing. `electronics/bom.md:177` has a first-table total around 2000 kr beside the current 1370–1520 range. Archive superseded choices rather than leaving competing instructions in the purchasing/build path. Also include the 2.5 mm drill/slot-finishing tool required for the LED strip in the tools list.

### N2. Improve the first-power test beyond a continuity beep

`ASSEMBLY.md:258` is a useful start. Add diode-mode verification of D1 and buzzer flyback orientation, measured pack polarity at the board plug, explicit amp polarity, and checks of every populated supply rail before attaching the expensive panel. Mark raw VPACK and protected VSYS distinctly. Use a current-limited first-power source where available; batteries alone will supply substantial fault current. Keep wire insulation/strain relief and LED ESD handling in the assembly instructions. No additional external-port ESD circuit is mandated by this desk review; internal wiring and the existing USB protection still require sensible handling.

## Checks that did not reveal a reason to change the architecture

- The scoreboard pin allocation matches its firmware header and layout. GPIO1/2/6 are LP wake pins; GPIO19 is suitable for the goal's awake/light-sleep input, not deep-sleep wake. GPIO4/5 strapping concerns are SDIO timing choices rather than the boot-mode selection used here; preserve the documented startup sequence. These assignments agree with the [ESP32-C6 datasheet pin and strapping tables](https://documentation.espressif.com/esp32-c6_datasheet_en.html).
- The key ladder gives 0, 148, 300 and 595 mV at 3.3 V. Its highest pressed level is 0.180×VDD, below the 0.25×VDD LOW threshold with ordinary resistor tolerance. Check actual ADC windows at the final minimum rail; simultaneous K1 plus another key is electrically indistinguishable from K1 and cannot be “rejected” by ADC software alone.
- LIS3DH and PCA9685 addresses do not conflict. The [LIS3DH supply range](https://www.st.com/resource/en/datasheet/lis3dh.pdf) is 1.71–3.6 V; its latched interrupt is a sensible wake mechanism. Firmware probes both addresses, validates identity and configures the latch. Keep the chosen clone approach; the spring-switch proposal is explicitly not adopted.
- Separate SPI chip selects and a dedicated reader MISO avoid contention with the write-only display. The [MFRC522](https://www.nxp.com/docs/en/data-sheet/MFRC522.pdf) permits 2.5–3.6 V main supplies and specifies up to 10 µA soft power-down. Its 25 cm wires and the actual enclosure need bench testing during display/sound/Wi-Fi activity. RC522 cannot substitute for a 125 kHz reader; verify the intended badge technology before a fleet order.
- The [GDEY042T81 manufacturer page](https://www.good-display.com/product/386.html) confirms 400×300, SSD1683, SPI and nominal 3.3 V. The exact panel minimum/boost transient behavior was not independently established from its full PDF in this review; measure refresh at the final cutoff and verify the DESPI RESE setting against the delivered panel documentation.
- The series diode is correctly oriented to block the XIAO charger's normal forward current into the AA pack. The [SGM40567 datasheet](https://www.sg-micro.com/rect/assets/e95e555a-a8a2-4761-b86a-6554dff2d8ed/SGM40567.pdf) gives BAT an absolute maximum of 6 V, so the proposed pack does not automatically violate that pin rating. This is not proof of the entire power path over every chemistry: check no USB VBUS back-feed and measure reverse pack current with USB connected, especially for primary cells. Use matched NiMH cells for the initial qualification.
- The firmware explicitly writes PCA outputs off before sleeping (`firmware/src/scoreboard/io.cpp:44`); that is the right behavior. Fix the README's claim that setting SLEEP by itself turns every output off. NXP describes oscillator shutdown, not a general substitute for explicitly clearing channels.

## Before you click buy

- [ ] Close B1 with one consistent goal pin map and revised USB-divider quantities.
- [ ] Close B2 with a drawn, reviewed amp protection/power-sequencing circuit and its extra parts.
- [ ] Establish a conservative loaded-rail limit for B3; budget bench access to an oscilloscope/current measurement.
- [ ] Reconcile one complete cart: resistor counts, six individual goal wires per device, hook-up wire, sockets, optical spares, and clone-specific parts.
- [ ] Confirm exact LIS3DH/amp/USB variants, GDEY042T81 + DESPI-C02, common-cathode LEDs, passive buzzer and transistor pinout; recheck delivery/VAT.
- [ ] Buy/qualify one table first: cold boot, each wake source, beam calibration, all colors, minimum-rail refresh/scan/sound, sleep current and battery removal during operation.

Not checked: physical samples, oscilloscope waveforms, actual cell discharge curves, every vendor's live cart, or a full firmware test run. I inspected the local layout images and drawing sources; remote PDF extraction did not supply usable schematic screenshots, so board-level power-path visual verification remains open. No battery-life, audio-quality or RF-range claim is measured by this report.
