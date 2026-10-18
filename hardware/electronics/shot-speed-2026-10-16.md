# Shot speed / force of a goal: study (electronics + mechanical, firmware, analytics), 2026-10-16

Status: **STUDY, nothing built, nothing bought.** All numbers are EST (rule 11). The inputs came from mechanical (the fit,
from `team/drawings/drawer-photos/full` photo 7 + the tunnel model), firmware (sampling, wake, power, pairing) and
analytics (what the stat is worth). Their answers are in team/log.md, 2026-10-16.

**Hard constraint (user):** nothing may change the ball's path inside the goal. A ball that hits something can bounce
back out.

## 1. What the goal looks like (mechanical, photo 7)

- The ball hits a **felt-covered rigid back plate** (board, probably MDF/wood) that slopes down, about 120 wide. The felt
  looks glued flat (≈ 3 mm). Below the plate a slot drops the ball into the drawer's drop zone (s ≈ 285–495).
- The plate's **far side** faces the drop zone. From the frame it's a ≈ 300 mm reach through the 130 × 55 opening: no
  room for a hand. It can't be reached without opening the table (or a stick tool). **Unknown:** what's there. A
  photo looking up through the entrance from inside the drawer settles it.
- The mouth's side walls are **galvanized steel plates**, flush with the ball path. Anything taped on stands ≥ 5 mm
  proud, i.e. in the path.
- **Cable to the goal counter:** down through the entrance slot, taped to the slot's side edge (never hanging into the
  drop zone), then along the tunnel wall/roof to L's board: ≈ 350–450 mm.

## 2. What the stat is worth (analytics)

- **Fun only**, like own goals. Never used in contribution, MVP or rating. Goals only (misses aren't seen). Needs a known
  scorer (G1).
- **Uses:** "fastest goal" on the finished screen, hardest goal of the week, each player's best and median.
- **Accuracy:** a per-player median over ≥ 10 goals is fine at **±20 %** random error. A single-shot record needs
  **±10 %**, because the max picks out the biggest positive errors. Table-to-table bias must be < 10 % if tables are
  compared.
- **Unit:** "≈ 34 km/h" with a per-table calibration knob, or a 0–100 scale with no unit.
- **Force-only** (depends on where the ball hits): OK as a relative "shot power" median, **not for records**. Hit-position
  noise lands on the single max, and players who aim at different spots get a bias the median doesn't remove.

## 3. The options

Physics, for scale: the ball is ≈ 35 mm and ≈ 20 g; shots run ≈ 3–15 m/s (≈ 10–55 km/h). An impact on felt lasts
≈ 1–3 ms. A sensor on the plate measures **momentum transfer (force × time)**, which grows with speed but also with the
angle and the hit point. Only a time of flight measures **speed**.

| | A. Piezo film/disc or FSR **under the felt** | B. Accelerometer (or piezo disc) on the **plate's far side** | C. Two optical beams across the **mouth** (time of flight) | D. Sound (microphone) |
|---|---|---|---|---|
| Measures | Force at the sensor spot | Panel vibration ≈ impulse | **Speed** into the goal (the component across the goal line) | Loudness of the thud ≈ impulse |
| Accuracy (EST) | Poor across the plate: one 20 mm disc only feels hits near it. The FSR is nonlinear, ±25 % part-to-part, with hysteresis and drift. ±30 %+ | Relative only. Hit point and angle give ±20–30 %; the rod slams are the noise | **±5 %** with the receivers below: 40 mm spacing = 4 ms at 10 m/s, timed to µs. Error = 1/cos of the entry angle on oblique shots | ±30 %+: rod slams, shouts and the other table |
| Calibration | Per sensor + per table | Per table: one `shot_power_scale` knob | Spacing only (absolute) | Per table and per room |
| Fits the constraint? | **Risky.** The felt must be peeled and re-glued (user check: glued or stapled?). A stiff disc under the felt could change the rebound locally, which is exactly the bounce-out risk | **Yes.** Nothing touches the ball side | **No, not tape-only.** Tape-on parts stand ≥ 5 mm into the path. Recessing them means drilling 4 × Ø3 holes in the steel side walls | Yes |
| Wake + battery (firmware) | Peak-hold (diode + RC) + a comparator into a GPIO, then one ADC read: ≈ 0 | 2nd LIS3DH at 5.376 kHz, AOI wake on INT1, FIFO trigger mode keeps the samples around the hit (32 = 6 ms): ≈ 185 µA while ACTIVE ≈ **+0.9 mAh/day** (≈ 7 % of the typical 13.2) | First edge wakes the CPU (0.3–1 ms late), then a ≈ 150 ms PM lock times the later edges to µs. **But** the beams must stay lit while ACTIVE, across ≈ 120 mm with fast receivers (a few k pull-up): ≈ 5–15 mA → **+25–70 mAh/day**, i.e. weeks, not months. Needs USB power or lensed optics | Continuous capture keeps the CPU awake: ≈ 15–25 mA → **+70–115 mAh/day**. Not viable on battery |
| Cost per goal (EST) | Piezo + peak-hold ≈ 5 kr; FSR 402 ≈ 50–70 kr; an FSR strip across the width ≈ 100–200 kr | LIS3DH breakout ≈ 15–30 kr + 4-core cable ≈ 5 kr. A piezo disc + peak-hold + comparator ≈ 10 kr | 2 × TSAL6200 + 2 receivers ≈ 20 kr + drilling + power | Mic ≈ 20 kr |
| Main risks | Bounce-out; re-gluing the felt; coverage | **Access to the far side (unknown).** Rod slams look like hits; at 5 kHz a ≈ 1 ms peak gets ≈ 5 samples, so it reads low (fine for a relative scale) | Drilling the table; battery; daylight at the mouth (the room has big windows: photo 7); the goalie's foot may cross a beam (the goal pairing drops it) | Noise; battery |

**Pairing with the beam goal (firmware, the same for A, B and C):** the hit comes before the counting beam's block by the
roll time (≈ 0.3–0.5 s). Take the **strongest hit in [block − 1.5 s, block − 0.05 s]**. A hit with no goal within 1.5 s
after it is a post or a bump, and is dropped. It goes out as a nullable `shot_speed` (or `shot_power`) field on the goal
event (a contract change, later).

**Why B uses a 2nd LIS3DH, not the board's:** the goal counter sits in the drawer, far from the plate and on a sled, so
the hit is weak there and rod slams are relatively loud. The 2nd LIS3DH goes on the same I²C (D4/D5) at the other
address: the board's clone may already use 0x18, so one of them gets SDO strapped to the other address (bench check).
The piezo variant of B needs no I²C: piezo ‖ 1 MΩ → BAT54 → 100 nF ‖ 10 MΩ hold → GPIO5 (MTDI back pad, ADC1_CH5), with
a µA comparator into GPIO4 (MTMS) for the wake. Both back pads are free.

## 4. Recommendation

1. **Don't do A, C or D.**
   - A risks the bounce-out the user wants to avoid.
   - C is the only true speed, but it needs drilling the steel and costs the battery (weeks).
   - D is too noisy and keeps the CPU awake.
2. **B is the only tape-only, battery-safe option**: a 2nd LIS3DH (or a piezo disc) taped to the plate's far side,
   cabled to the goal counter. It gives a **relative "shot power" 0–100** per table, used for **per-player medians
   and best/median on the player page**. It is **not good enough for "hardest goal of the week" records or km/h**
   (analytics: those need ±10 %).
3. **Run the free bench test first (§5).** Buy nothing until it shows a usable correlation and someone has seen the
   plate's far side.
4. **If the user wants km/h records**, that's C: drill 4 × Ø3 holes in the steel side walls, and power the beams from
   USB or accept weeks of battery. That's the user's call, not ours.

**Decisions for the user (via lead):**
- (a) Is a relative shot power (median only, no records) worth ≈ 20–35 kr + ≈ 7 % battery per goal counter?
- (b) Is drilling the goal's side walls ever acceptable (needed for real km/h)?

## 5. A cheap bench test (no parts, two phones)

**Goal:** does the vibration (or the sound) at the goal follow the ball's speed well enough? This uses no parts and
changes nothing.

1. **Phone 1 (ground truth):** 240 fps slow motion, looking down at the last ≈ 300 mm before the goal, with a tape
   measure lying beside the goal line. Speed = distance between the ball's positions in two frames ≥ 6 frames apart
   ÷ time (≈ ±5–10 %).
2. **Phone 2 (sensor stand-in):** phyphox ("Acceleration" + "Audio amplitude"), lying flat on the goal end's top
   rail, as close to the back plate as it reaches.
3. **Shots:** 30 goals (10 slow, 10 medium, 10 hard) across the goal's width (left, middle, right). Then 20 rod slams
   and 10 posts with no goal (the noise).
4. **Pass:** peak (acceleration or audio) vs speed has r ≥ 0.8, **and** a slow goal's peak is ≥ 2× the loudest rod slam.
   If only the middle shots correlate, the hit point dominates. Then it's force-only, median-only.
5. **If it passes:** look at the plate's far side (a photo up through the entrance from the drawer), then tape one
   LIS3DH breakout there on a 0.5 m 4-core lead to a bench XIAO running firmware's 5.376 kHz FIFO capture. Repeat
   step 3 for the real number.

Caveat: the phone's accelerometer samples only ≈ 100–500 Hz, so it underestimates the peak. The 48 kHz audio channel
doesn't. A weak accelerometer result is not a fail by itself if the audio correlates.

## 6. Not changed

No §0 number, interface, schematic, perfboard or BOM changes. Nothing is built until the user decides (a)/(b).
