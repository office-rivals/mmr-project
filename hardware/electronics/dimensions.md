# Part dimensions for mechanical (INTERFACES §4)

All in mm. Source = datasheet drawing unless marked *measured-on-arrival*. Design with the
stated clearance; anything marked *(verify)* should be a named parameter.

## Electronics board (one part instead of separate MCU / sensor / regulator)

Everything except the battery holder and the two beam elements sits on **one perfboard**
(cut from a standard 50 × 70 mm, 2.54 mm-pitch protoboard; layout in `perfboard.png`). Mechanical mounts one rectangle.

| Item | Value |
|---|---|
| Board outline | **70 × 30 × 1.6** (x along the 70 mm edge from the USB end, y from the bottom long edge) |
| Mounting | **2 × Ø3.2 holes at x = 66.5, y = 3.5 and 26.5** (drill both). **One** printed Ø2.8 locating pin goes in the y = 3.5 hole (header edge); the y = 26.5 hole sits on a Ø7 boss as a rest pad, with no pin: a pin 3.5 from the lipped edge can't clear the roll-in under the lips (assembly-review B15, mechanical 2026-10-17); the board also rests on plain bosses at x = 28.5. It is held by 2 lips on the top (socket) edge at x ≈ 20, 45 and 2 snap clips on the header edge at x ≈ 24, 60 (no screws). The board must be rigid (the accelerometer is on it). **Rest pads** (no screw) on the end rail x 0.5–4 and on the two 1.5-wide edge strips under x 4–22, so a USB plug doesn't flex the cantilevered end, plus a **back stop** at the x = 70 edge that takes the plug's push (the B4 zones below: the middle of x 4–22 has wires under it). |
| Keep-out above board | 14 (tallest: socketed calibration resistors, standing C1, the standing TO-92 Q2) |
| Keep-out below board | 3 (solder joints, wire tails) — bosses ≥ 3 tall |
| USB-C | XIAO at the **left short edge (x = 0)**; the receptacle face is **~1.4 inside** the board edge (the plug overmould passes over the board, ≥ 2.4 above its top). Centre at **y = 16.1**, **z = 5.7** above the perfboard top (2.5 header spacer + 1.6 XIAO PCB + 1.6 half receptacle) *(verify)*. Opening ≈ 9.0 × 3.2. The plug overmould needs ~12 × 7 clear in front of the port. |
| Antenna | XIAO's ceramic antenna is at its end opposite the USB-C (x ≈ 18–22). Keep metal ≥ 5 away; plastic is fine. |
| Wire exits | Bottom long edge (y = 3.4): J_PT (x 31–34), J_LED (41–44), J_BAT (JST-PH pigtail soldered at x 49 and 54), J_BTN (57–59). Top long edge (y = 26.3): keyed J_OLED (31–41, 5th pin pulled), J_STAT (46–51). J_BZ at x 59–62, y 11.0. Dupont plugs need 15 clear above the board. Body keep-outs are asserted in perfboard.py (review 2) |
| Calibration resistors | Female socket strips near the **top long edge**, x = 54–62, y = 23.7 (R_LED_B socket + R_PU_B) and 26.3 (R_LED, R_PU). Reachable from above (lead asked for easy swap); inside the lid's **14 × 14** hole (sled, below). |

**Under-board keep-outs (assembly-review B4).** Every pin and lead is trimmed to ≤ 2 mm, and the
underside wires lie over them, so expect **up to 3.0 mm** of stuff below the board anywhere *except* in
these zones, which have no joints or wires. Supports may touch the board only here:
- **End rail** x 0.5–4.0, full width (left of hole column 0).
- **Outer 1.5 mm strips** of both long edges, y 0–1.5 and 28.5–30.
- **Pin bosses**: Ø7 around (66.5, 3.5) and (66.5, 26.5).

No central supports: the drawn underside wires cross the middle of the board. Everything else needs
**≥ 3.5 mm** of clearance under the board. The two full-length edge strips carry the board (the
LIS3DH area spans ~27 mm between them, which is stiff for 1.6 mm FR4). Both boards (goal and scoreboard) are
the same. The zones are drawn red-hatched in `perfboard.png` and `perfboard-scoreboard.png`.

Mounted on the board (for reference, not separately mounted):

| Part | Outline | Notes |
|---|---|---|
| Seeed XIAO ESP32-C6 | 21.0 × 17.8 × 1.6 PCB (+1.5 USB-C overhang) | No holes. Soldered on pin headers. |
| SparkFun LIS3DH (SEN-13963) | 22.86 × 12.70 | Soldered on headers (rigid). Its own Ø3.3 holes, 17.78 apart, are not used. |
| C1 bulk cap | current-production part, bom row 7 (the UVR1A471MED is EOL); standing, centred between (21,5) and (21,6), ≤ Ø6.3 | screen leakage on the bench (≤ 2 µA after 10 min at 4 V) |

## Placement in the goal-counter sled (as built in mechanical's sled.py, 2026-10-18)

Coordinates as in `mechanical/sled.py`: **s** inward from the frame's outer face, **y = 0** at L's left outer face
(**r** = −y), **z** up from the tunnel floor. **sled.py is the reference**; these rows are what electronics checked
against it. All EST until printed (rule 11). The 2026-10-17 layout (board at the front wall) is history:
[sled-layout-2026-10-17.md](sled-layout-2026-10-17.md).

| Item | Value |
|---|---|
| Layout | Battery drawer lane r 21–71, z 12–32, from the front wall to s ~120; the board behind it; the **dash** above the lane holds the OLED, the status LEDs, the undo key, the buzzer and the receiver bay; the dash leads run through the strip duct at r 1.2–19 |
| Board | B0 at **s 126.0, y −44.8**, board s 126–196, y −44.8 to −14.8, underside **z 8.4**, USB end forward. One pin (bottom hole), the top hole on a boss |
| USB-C | Centre **y −28.7, z 15.7**, reached through the empty drawer lane: 14 × 8.5 cut-out with a lead-in funnel in the lane's back wall (s 116.7–121.7). The plug lies on the lane floor (z 11.7); sled.py asserts a 13 × 8 overmould clears |
| Antenna | XIAO far end at s 144–148. Parts within 5 mm of the XIAO's far edge: only R_SCL (4.7 mm); R_S8, R_S2, R_BTN and R_S moved ≥ 5 mm (round 3). In-table RSSI test; U.FL FPC antenna spot on the lid (mechanical) as the fallback |
| Headers | Bottom edge: J_PT, J_LED, J_BAT (JST-PH pigtail), J_BTN; top edge: keyed J_OLED (5 wide), J_STAT; J_BZ at board x 59–62, y 11. See *Perfboard* above |
| Battery | FIT0610 in the drawer; **slack-loop lead** (Adafruit 6181 pair, ≈ 260) to the **JST-PH on J_BAT**; a separate cord is the drawer's travel stop. Pulling the drawer does **not** switch the counter off |
| Receiver bay | In the dash at its right end; the keyed 3-pin mouth-joint header in its back wall; R's sensor lead plugs on there (service only) |
| Undo button (phase 1) | **MX blue switch** (2026-10-18; was a 12 × 12 tactile), as built: plate-mount in a printed 1.5 plate with a **14.0 cutout**, 2 metal pins, centred at **r 23.5**, a **plain printed 10 × 10 keycap**, flush (no label, lead/user; an 18 mm cap wouldn't stay inside the opening at e_L 15). Lead ≈ 220 down the strip duct to J_BTN; 1 k inline at the switch |
| Buzzer (phase 1) | CMT-1209-390T Ø12 × 9. **As built (2026-10-18):** standing in the block under the OLED at **s 58.5, y −45**, port **up** at z ~42 into the open room behind the display (~12 below the dash top), no grille; leads up into the room, then the strip duct to J_BZ (≈ 200). Far from the LIS3DH and the antenna (both on the board at s ≥ 122). **Venting ✓:** the room has no top (s 41–66, y −31 to −68, ≈ 900 mm² open) straight up into the air above L's front and the frame tube; sled.py asserts a clear Ø8 column above the port. Bench audibility check stays |
| Status OLED (user 2026-10-17/18) | **Waveshare 14657** 0.91" 128 × 32 white I²C module (frozen, review 2): PCB **36.0 × 12.5**, active area **22.38 × 5.58** (Waveshare's drawing; mechanical: r 36.3–58.7, the 3.8 offset from the left end is EST), pins **VCC GND SDA SCL**: 2.54 holes at the LEFT end (soldered wires, flat on the back) and a side-entry PH2.0 socket on the back at the right end (unused, in mechanical's pocket; body ≈ 7.6 × 9.9 × 4.8 EST), no mounting holes (**measure the active-area offset on arrival**). Mechanical: upright in the dash, wired end (holes) at the LEFT in front view, the unused PH2.0 socket at the right in its pocket, held by 2 lips on the long edges (sled.py is the reference). Lead ≈ 200 EST from J_OLED through the duct. Keep R's sensor lead ≥ 5 from the module's back (as built: ≥ 5 behind it, but it passes 2.1 under the bottom edge where it U-turns in the bay; covered by the screen-on bench test, ASSEMBLY §6 step 6). Nothing presses on the glass. **Orientation:** most 0.91" modules read upright with the pin holes on the **left**, which is how it now sits, so expect `OLED_FLIP` **0** (firmware sets the default; 1 if a module reads upside down). Check it on the first power-on |
| Status LEDs (user 2026-10-18) | 2 × 3 mm diffused (red + InGaN green), side by side in the dash ~6 under the OLED window, centred on it (as built, mechanical 2026-10-18): **two Ø3.1 holes, 6 apart, at r 42.5 (green, left) and r 48.5 (red, right), z 36**, face recessed 0.5, flange on a step, no light pipe. Each LED drops into an open channel behind the OLED's underside block and slides forward. Legs ≈ 25 back to a 3-wire lead, up behind the OLED and down the strip duct (≈ 200), to **J_STAT**. Nothing glows out of the opening (bench sets the current) |
| TSAL6200 | Well at s 194, inserted from the box side along +y; a printed clip behind the flange; legs bent 90° **toward −s**, ≥ 2 behind the flange (the rib at s 194 is notched around them, mechanical); lead (~200) through a notch in the s 181.8 cross wall, along the channel-side wall (2–3 clips in the finger gap) to J_LED |

## Battery holder

| Item | Value |
|---|---|
| Part | **DFRobot FIT0610 only** (review 2: the Keystone 2487 is 18.5 tall and doesn't fit the lane), 3×AA, slide cover, ~150 mm leads from one short end; its slide switch is **bridged** with a wire |
| Outline | FIT0610 **68 × 47 × 17** *(verify on arrival)* |
| Mounting | **Battery drawer (2026-10-18):** lies flat, cover up, clipped into the drawer's tray. The drawer pulls out through the frame opening; the holder lifts out of the tray and its cover slides off on the table (the tray end is open on the cover's slide side). |
| Leads | ~150 mm red/black from one short end (at the drawer's rear), through the drawer's strain relief, joined (≥ 40 from the holder) to the slack-loop lead with F1 in the + wire; the lead ends in the JST-PH plug on J_BAT |
| Battery lead | **Wired, slack loop** (no pogo pins or targets): **≈ 255 assembled from the JST-PH plug's mating face (J_BAT pocket beside the board, s ~171–179) to splice B behind the holder** (mechanical's model 247 + slack): a 25 mm plug tail (Adafruit 1131 plug half), splice A zip-tied on the ledge slots at s 158–161 (stationary; the pocket holds only the mated PH pair), 240 mm of a 2-wire strip of Adafruit 6181 (flat 2.8 × 1.4, the only part that flexes, bend r ≥ 7 = LEAD_R_MIN), splice B glued in the drawer tab's groove; ≥ 40 of holder lead (HOLDER_LEAD) with **F1 2 A** in the + lead under 4 mm heat-shrink; a separate Ø1 cord is the stop. ≈ 45 mΩ round trip + F1 ≈ 47 mΩ |
| Swap clearance | The drawer comes out of the frame (≥ ~105 travel) on its slack-loop lead, the holder lifts out of the tray (≥ 40 of holder lead), and the cover slides off along its long axis. Its slide switch is bridged. **The counter stays on while the drawer is out**: off = unplug J_BAT or take a cell out. |

## Beam emitter — Vishay TSAL6200 (5 mm, 940 nm)

| Item | Value |
|---|---|
| Body | Ø5.0 ± 0.15 |
| Flange | Ø5.8 ± 0.15, flange thickness ≈ 1.0 |
| Height, flange underside → dome tip | 8.7 ± 0.3 |
| Height, flange top → dome tip | 7.7 ± 0.15 |
| Emitting point | ≈ 3.5 below dome tip (on the axis) |
| Leads | 2 × 0.5 sq, 2.54 pitch, out of the back, ~25 long (cut). Long lead = anode. Flat on flange = cathode. |
| Beam half-angle | ±17° |

## Beam receiver — Vishay TEFT4300 (3 mm phototransistor, 940 nm filter)

| Item | Value |
|---|---|
| Body | Ø3.0 ± 0.1 |
| Flange | Ø3.9 ± 0.15, with a flat at 3.2 ± 0.1 (keying), thickness < 0.6 |
| Height, flange underside → dome tip | 4.5 ± 0.3 |
| Height, flange top → dome tip | 3.5 ± 0.1 |
| Chip | ≈ 2.5 below dome tip |
| Leads | 2 × 0.4 (+0.15/−0.05), 2.54 pitch, out of the back, 34.4 ± 0.5 long. **Collector = the shorter lead (1.5 ± 0.5 shorter), on the side of the flange flat; emitter = the longer lead** (Vishay drawing 6.544-5269.01-4). Bend/solder ≥ 2 mm from the case. |
| Acceptance half-angle | ±30° |

## Beam geometry (agreed)

- Channel 40, beam axis at **17** above floor (ball: 31 mm usual, 31–36 supported, see INTERFACES §0; 17 ≈ the 31 mm ball's 16.75 centre height above its contact plane, usable ~14–20), apertures **Ø3**. Receiver
  tip 4.4 behind its aperture (mechanical, review 2), emitter tip 12 behind its aperture → ~56
  emitter-to-receiver. Optics budget is fine at
  56 mm with ~6× typical margin (see README §Detection).
- Emitter and receiver **coaxial** (±1 mm, ±3°). Matte, dark walls around the apertures.
- Wells must hold the element by its **flange** against a shoulder so it can't be pushed back by
  wire pull; a dab of hot glue or a printed clip retains it.

## Scoreboard buzzer — Same Sky CMT-1209-390T

| | mm |
|---|---|
| Body | Ø12.0 × 9.0 (± 0.5), black PBT |
| Sound port | top face, centred |
| Pins | 2 PCB pins on the bottom face, 5.0 pitch, cut to ~3 + 2 soldered wires (~15 cm twisted pair to J_SND) |
| Grille | 5–7 × Ø2 holes within Ø10 in the case wall, the top face sealed to the wall with a foam/hot-glue ring |
| Placement | ≥ 15 from the LIS3DH, not behind the battery, facing the players or up; nothing taped over the holes |

## Scoreboard key LEDs — Kingbright WP154A4SUREQBFZGW (5 mm RGB, common cathode, diffused)

| | mm |
|---|---|
| Body | Ø5.0, flange Ø5.9 × 1.0 max, flange base → dome top 8.6 |
| Leads | 4 × 0.5 square, 24.5 long, one row at 1.27 pitch: 1 R, 2 common (longest), 3 B, 4 G |
| On the LED strip | seated **flush** (flange on the board, 0–0.5), dome tip **≈ 8.6–9.1** above the board; straight leads through a Ø2.5 slot (2 holes opened up), centred on its key's u. Lens is already white-diffused, 2θ½ = 60°, so no sanding needed. v4: dome tip 8 behind the 2 mm opal diffuser bar, 3 opaque baffles at the key boundaries |
| LED strip (v4, MX keys) | **98 × 8 × 1.6** perfboard, LEDs only, on its centre line at the key u (±10.16, ±30.48 from the middle); 2 × Ø2.5 holes at ±46.5, 1.0 below the LED line. Front 19.6 behind the face, LED line 11.75 above the key centres. 13 wires (~12 cm) to the PCA9685 |
| MX key wiring (v4) | hand-wired behind the printed key plate: KEYS bus on pin 2 of every switch, GND bus below, K2–K4 resistors from pin 1 to the bus. All within 3 mm behind the pins, u ±40.5, v −2…+7 about the key centres. 2 wires (~15 cm) to J_KEY |

## Scoreboard LED driver — PCA9685 board (Adafruit 815 layout; clones ±1 mm)

| | mm |
|---|---|
| PCB | 62.5 × 25.4 × 1.6, 4 corner holes ~Ø2.5 (positions vary: hold it with ribs/clips, ±1 mm) |
| Headers | none fitted. Control pins on both short ends (GND OE SCL SDA VCC V+), 16 × 3-pin channel columns (PWM/V+/GND) along one long edge |
| Height | ~2 above the PCB (SMD) + wires soldered from the top; back-side joints ≤ 2. v4: lies FLAT on the floor, components up, PWM edge towards the key strip, on 4 corner pads (2.5 + 1 mm foam) between corner posts (±1 outline): PCB x 22.8–85.3, y 65–90.4, underside z 6.0, top ~12.6 incl. wires |

## Scoreboard card reader — RFID-RC522 module (MFRC522, 13.56 MHz)

| | mm |
|---|---|
| PCB | 40 × 60 ± 0.5 × 1.6; mounting holes vary between clones, so use a pocket/clip, no screws |
| Header edge | one short edge, 8 pins (SDA SCK MOSI MISO IRQ GND RST 3.3V); no header fitted, 6 wires (≥ 25 cm) soldered on the back and trimmed ≤ 1 mm (1 mm foam tape there) |
| Components | chip + crystal on the front, ≤ 4 tall, near the header end |
| Antenna loop | PCB trace filling ~40 × 38 at the end **away** from the header. "Scan here" mark over its centre, ~19 from the far short edge |
| Orientation | **v5 (current):** behind the face in the right wing, **parallel to the face**, loop end **up**, flat back towards the face (≤ 2.5 PETG + ≤ 1 air), on taped pads; positions in mechanical's `scoreboard.py`. *(v4, superseded: flat under the top, flat back up.)* |
| Keep-outs from the loop (v4 model, full-board-width loop) | ≥ 10 from metal/battery/ground planes (cells 20.3); not over the e-paper (glass 6.1 at its nearest edge, no overlap in plan, asserted) and ≥ 11 from the DESPI-C02 (11.0; the real trace is ~2 further in; firmware skips polls while the panel refreshes and powers the panel off after each one); ≥ 20 from the buzzer (41.9) and the XIAO (80.6); NTAG213 tag ≥ 60 target, 45 hard minimum, never on the loop axis (66.2); ≥ 10 from LED5 (10.5, its wires 11.4); speaker magnet/frame ≥ 25 (off the loop axis), amp module ≥ 30. **v5 (mechanical, asserted in scoreboard.py; electronics checked 2026-10-15):** speaker 25.9 (off-axis: below the loop along the face), LED5 23.9, cells 21.3, PCA9685 40.1, DESPI 54.4, e-paper 7.7 (beside), main board 58.8, amp 58.2, XIAO 75.0, NTAG 102.4, USB-C socket 34.4 / cable 27.5 |
| Range | cards ~2.5–4.5 cm above the top, key fobs ~1–2 cm |
| LED5 (scan feedback, same Kingbright LED) | **beside** the module: dome hot-glued into a Ø5.3 × 1.5 socket under the translucent badge insert's tongue, x 86.0, y 121.1, dome tip z 97.9, flange z 89.3, leads straight down; flange edge 10.0 outside the loop end in plan. No metal. The RC522 is not drilled or modified. Its 4 wires (≥ 25 cm, ~10 cm route to the PCA9685) twisted, leading away from the loop, never across it |
