# Scoreboard: sample-playback sound (sound option A)

**User decision:** option A is the AliExpress variant (PAM8302A clone + 40 mm speaker 5-pack), with
the buzzer kept as option B, the fallback. Both are drawn (schematic, perfboard) and the 1 kΩ selector
socket (R_A1 or R_B) picks one; ASSEMBLY S2b. The Adafruit/PUI parts below remain the alternative.

Replaces the 12 mm magnetic buzzer with recorded sounds through a small class-D amp and a 40 mm
speaker. No new GPIO: GPIO7 (today's buzzer pin, back pad MTDO) carries the audio, and the spare
PCA9685 channel 15 switches the amp on and off.

## Circuit

```
GPIO7 (MTDO) ── R_A1 1 kΩ ──┬── R_A2 10 kΩ ──┬──► AMP A+   (1 µF coupling cap is on the amp board)
                            C_A1 10 nF       C_A2 1 nF     R_A3 (at the module, A+ → GND): the ceiling,
                            │                │             from the attenuator assortment (470 Ω … 2.2 k)
                           GND              GND           AMP A− ──► GND (single-ended)

VSYS (after D1, as the XIAO) ──┬──► AMP VIN      AMP OUT+ / OUT− ──twisted pair, ~7 cm──► speaker
                          C_AMP 470 µF            (both terminals floating: BTL, never to GND)
                             │                    PCA9685 ch 15 ──► AMP SD   (HIGH = on)
                            GND
```

- **The audio source is GPIO7 as a 1-bit PDM DAC.** The ESP32-C6's I2S0 runs PDM TX with the
  hardware PCM-to-PDM converter, in `I2S_PDM_TX_ONE_LINE_DAC` mode. ESP-IDF says this mode is meant
  "to drive power amplifiers directly with a low-pass filter" and needs no clock pin; its driver
  accepts `clk = -1`, to be confirmed on the bench.
  - Format: 16-bit PCM at 22.05 kHz, up-sampled 128× (fp 960 / fs 480), so the GPIO7 bitstream
    runs at 2.82 MHz.
  - DMA feeds it, so the CPU does no per-sample work.
- **The filter** is two RC poles at about 16 kHz. They take the 2.8 MHz bitstream down by about
  90 dB and lose less than 1 dB at 8 kHz.
- **Gain.** Full scale on GPIO7 is 1.65 V peak; through the amp's fixed 24 dB (×15.8) that would ask for
  ~26 V peak from a ~3 V bridge. The amp clips at about its supply, so the input needs ≥ ÷ 8 (−18 dB)
  at full scale, ÷ 11 (−21 dB) with margin. **R_A3** from A+ to GND at the module does that with the
  11 kΩ in series: 1.1 kΩ ≈ ÷ 11. It also moves C_A2's pole up (to ~150 kHz), leaving ≈ −70 dB at
  2.8 MHz: fine. On a module with a trim pot, the pot does the same job. **Set it from minimum:** start
  at the smallest R_A3 (470 Ω, ≈ −28 dB) or the pot at minimum, play the loudest sample at High with
  the pack at the 3.45 V cutoff (bench supply), and step up until it's loud but clean. This replaces
  today's R_SND link as the calibration knob.
  `sound_volume` becomes a digital gain in firmware: High 0 dB, Medium −9 dB, Low −18 dB (ux),
  Off = amp kept off. The PWM-duty trick goes away.
- **The amp is fed from VSYS, after D1** (lead's decision after the two design reviews, 2026-10-15).
  On the raw pack, a reversed splice would have killed the amp and C_AMP, and with USB only the amp
  was unpowered while SD was driven HIGH (above its VDD + 0.3 V limit). On VSYS it is reverse-protected
  by D1 and powered whenever the MCU is. Cost: the diode drops ~0.3–0.45 V on 0.3 A peaks, ≈ −1 dB of
  headroom. **Firmware mutes option A while USB is present**: on USB alone VSYS comes from the XIAO's
  charger, which can't supply 0.3 A peaks, so bench sound tests run on cells with USB unplugged.
  Pulling the JST pack plug still turns everything off.
- **Shutdown pin (SD).** The PCA9685 drives it from channel 15, totem-pole 0/3.3 V. The amp's
  minimum logic HIGH is 1.4 V, so 3.3 V is enough.
  - At power-on the PCA9685 starts with every channel fully off, so the amp is silent by default.
  - **Remove the amp board's SD pull-up resistor.** It costs 0.5 mA in shutdown (Adafruit's own
    figure), which would be about 12 mAh/day, more than everything else in sleep. Without it the
    amp draws ≤ 1 µA in shutdown. A several-kΩ resistor doesn't beep on the continuity range:
    **trace** which resistor joins SD to VIN, **measure** SD → VIN on the resistance range before and
    after (open afterwards), and confirm with the sleep-current check.
- **Which clone (buy requirements):** a PAM8302A board with an **SD pin brought out**, **input coupling
  capacitors** on A+ and A−, a **local ceramic supply bypass** and a printed pin order; a trim pot is a
  bonus. Save the listing's photo and variant with the order (bom, *Suppliers*).
- **Both options stay on the board.** The buzzer driver (option B) keeps its place. R_A1, C_A1, R_A2,
  C_A2 and J_AMP sit between the XIAO and the LIS3DH. R_A1 and R_B are both sockets, and the one 1 kΩ
  plugged into either picks the option.

### Firmware sequence (for firmware)

1. Start PDM sending silence.
2. After about 20 ms, set channel 15 ON.
3. Play the sample.
4. Set channel 15 OFF and stop the I2S.
5. Drive GPIO7 LOW.

The PCA9685 stays awake while a sound plays. A 1 s sample at 22.05 kHz, 16-bit, is 44 kB, so 10
sounds take about 0.4 MB of flash (IMA-ADPCM would cut that to about 0.1 MB).

**Fallbacks** if I2S PDM misbehaves:
- LEDC PWM at 10 bits and 78 kHz, with a 22 kHz timer interrupt writing the duty: about 10-bit
  quality.
- The C6's SDM peripheral: 8-bit density, about 48 dB SNR.

The same RC filter works for all three.

## Parts (per scoreboard)

| Part | Source | kr |
|---|---|---|
| Amp: **Adafruit 2130** (PAM8302A, 2.0–5.5 V, 24 dB, 1 µF input caps, trim pot, SD pin) | DigiKey 1528-2130-ND, about €3.39 ex VAT (0 in stock in the snapshot, 4-week lead time). Fast: a Danish or EU Adafruit reseller (stock to be confirmed). Clone boards (CJMCU-8302) work too, but check the SD pull-up | ≈ 32–50 |
| Speaker: **PUI Audio AS04008PO-2-LW152-R**, 8 Ω, 1 W (2 W max), 40 × 28.3 × 12 mm, Nd magnet, 152 mm wire leads, resonance 450 Hz, 84 dB at 1 W / 0.5 m | DigiKey (37 in stock, $5.92) | ≈ 51 |
| R_A1 1 k, R_A2 10 k, C_A1 10 nF, C_A2 1 nF, C_AMP 470 µF 16 V | DigiKey (A) / kit | ≈ 5 |
| Removed: CMT-1209-390T, BC337-40, one 1N5817, 2-pin socket | – | − 20 |
| **Net change** | | **≈ + 70 per scoreboard** (≈ 695 → ≈ 765) |

### Cheaper variant (AliExpress)

| Part | Source | kr per scoreboard *est.* |
|---|---|---|
| PAM8302A clone module (CJMCU-8302 or "PAM8302 2.5 W mono amp"), 5-pack | AliExpress | ≈ 10–15 |
| 40 mm 8 Ω 1 W round speaker (iron shell, Mylar cone), 5-pack | AliExpress | ≈ 5–8 |
| Filter R/C + C_AMP, minus the removed buzzer parts | as above | ≈ −15 |
| **Net change** | | **≈ 0 to +10** (vs ≈ +70) |

- **Delivery:** 1–3 weeks, like the NTAG tags. Order now if the user wants it for the first build.
- **Same chip, so the same sound,** provided the clone carries a genuine PAM8302A.
  - Some clones have no trim pot. Then fit a resistor from A+ to GND as the ceiling (start with
    10 k, which with R_A2 10 k gives −6 dB).
  - Their SD pull-up varies: find it and remove it, as on the Adafruit board.
- **Speaker:** cheap 40 mm Mylar speakers come with no datasheet. Expect:
  - 2–4 dB less output at 587–700 Hz, often a resonance of 550–700 Hz;
  - more rattle and buzz on High;
  - wider unit-to-unit spread.
- Mitigations:
  - firmware can high-pass the samples at about 500 Hz;
  - ux transposes up a fourth only if the bench shows > 10 dB down at 600–700 Hz;
  - buy the 5-pack and keep the best one.
- **Avoid 28 mm cheap speakers:** with a resonance around 800 Hz, ux's lowest notes would be > 10 dB
  down.
- **Middle option:** the clone amp + the DigiKey PUI speaker ≈ +55 kr. That keeps the known speaker,
  which matters most, and saves on the part that doesn't change the sound.

## Sound quality to expect

- **Resolution and noise.** 16-bit samples go through the C6's hardware PDM modulator. In practice
  the noise floor is set by ripple on the 3.3 V rail (the GPIO's high level *is* the rail), not by
  the bits: about 60–70 dB SNR.
  - A faint 10 Hz tick from the Wi-Fi beacon wake-ups may be audible in the quiet tail of a chime,
    at about −45 dB. This is a bench item.
- **Bandwidth.** The speaker covers about 450 Hz–10 kHz, so there's no bass. Bells, chimes,
  marimba, short jingles and voice clips come out clean, like a good doorbell or phone notification
  speaker. Kick drums and low brass come out thin.
- **Loudness at 1 m.**
  - The amp clips at about Vdd² / 16 Ω, with Vdd = VSYS ≈ pack − 0.3–0.45 V on peaks: ≈ 0.9 W on
    fresh NiMH (4.2 V), ≈ 0.65 W at 3.6 V, ≈ 0.55 W at the 3.45 V cutoff (EST; the R_A3 ceiling is
    set at the cutoff, so High sounds the same all through the pack).
  - The speaker gives about 78 dB SPL at 1 W / 1 m (PUI figure; the AliExpress speaker is unspecified),
    so **peaks reach about 75–77 dB SPL at 1 m** on High (EST).
  - The buzzer manages 67–72 dBA, so High is about 5–8 dB louder and far richer. Medium (−9 dB)
    is about as loud as today's High.

## Current and battery

- **While playing** (I2S holds the C6 out of light sleep at about 25 mA, plus PCA9685 6 mA, amp
  quiescent 4 mA, plus the load):

  | Volume | Average | Peak |
  |---|---|---|
  | Medium | ≈ 40 mA | – |
  | High | ≈ 70 mA | ≈ 300 mA on loud transients |

- **Standby:** amp ≤ 1 µA (once its SD pull-up is removed), filter 0, channel 15 LOW 0.
- **Assumed use:** about 230 sounds a day (≈ 170 goals, ≈ 20 wins, ≈ 40 badge and undo sounds),
  averaging ≈ 0.55 s each (ux's sounds v2: goal 0.45 s, won 1.4 s, badge 0.07–0.35 s,
  saved 0.65 s).
  - Medium: ≈ 1.4 mAh/day (the buzzer was ≈ 0.4).
  - High: ≈ 2.5 mAh/day (the buzzer was ≈ 1.0).
  - Firmware's 20 ms lead-in and 200 ms tail (amp held on so back-to-back sounds don't pop) keep
    the C6, the PCA9685 and the idle amp on (≈ 35 mA) for ≈ 0.22 s more per sound: ≈ +0.5 mAh/day.
- **Scoreboard total:** now kept in one place, the README's scoreboard *Power budget* (typical and
  pessimistic columns, 320 goal sounds a day for both goals, RF switch, telemetry, 3.45 V cutoff).
  The headline is INTERFACES §0.
- Each extra 0.1 s of average sound length costs about 0.25 mAh/day at Medium.

## For mechanical: size and keep-outs

- **Speaker:** 40 × 28.3 mm footprint, ≤ 12 mm deep, plus about 3 mm for the wires at the back.
  - **Mounting.** Cone facing out through a wall grille, about 30–40 % open area over the Ø ≈ 30 mm
    cone.
  - **Seal the speaker's rim to the wall with a 1 mm foam ring.** Front and back air must not mix.
    This matters more for loudness and low end than anything else here.
  - Clamp it firmly so it can't rattle the case, key plate or badge insert.
- **Back volume:** ≥ 20 cm³ behind the cone, with ≥ 5 mm clear behind the magnet. The closed case
  interior (≈ 1 L) is plenty. If the case has large openings near the speaker, give it a printed back
  cup of ≥ 20 cm³ instead.
- **Keep-outs:**
  - Speaker magnet and frame: **≥ 25 mm from the RC522 loop copper** (more is better), never over
    or under the loop in plan.
  - ≥ 15 mm from the XIAO's antenna.
  - ≥ 20 mm from the NTAG213 in the left wall.
- **Amp board:** Adafruit 2130, about 23 × 18 mm (measure on arrival), flat on the floor next to the
  main board and the pack lead. Keep it **≥ 30 mm from the RC522 loop**.
  - Its outputs are filterless class-D at about 300 kHz, so the speaker leads are a twisted pair
    ≤ 15 cm long, routed away from the loop and the RC522 wires.

## Fit with ux's sounds v2 (`ux/SOUNDS-V2.md`)

- **Band.** The sounds sit at 587–2400 Hz, with harmonics up to about 9.5 kHz.
  - The 40 mm speaker resonates at 450 Hz free-air, and about 550–650 Hz in a ≥ 20 cm³ sealed back.
    So 600–700 Hz should be at most about 3–6 dB down from 1–2 kHz, not > 10 dB. **No transposition
    needed.** Bench-check it with ux's WAVs.
  - A 20–28 mm speaker (resonance about 700–900 Hz, about 4 dB less sensitive) *would* be > 10 dB
    down at 587 Hz. That is why I chose the 40 mm one.
- **Flash:** 154 KiB is fine.
- **Volume:** the PAM8302 has no gain pins, so ux's Low −18 / Med −9 / High 0 dB is a digital gain,
  with the trim pot setting the bench maximum.

## Why not the speaker on the existing BC337?

It works as a toy, not as a premium sound.
- A low-side NPN switching an 8 Ω speaker from VSYS is unipolar. Silence at 50 % duty is about
  0.2 A of DC through the coil, so samples would have to idle at 0 % duty, which adds even-harmonic
  distortion.
- The swing is half of a bridge amp's (−6 dB).
- The BC337's microsecond storage time distorts a 78 kHz PWM carrier.
- The amp costs about 32–50 kr and ≤ 1 µA standby, and fixes all three.

## Bench A/B before the user decides

- **A:** today's buzzer path.
- **B:** Adafruit 2130 + AS04008PO on a breadboard: GPIO7 → RC filter → A+, SD to 3V3 by hand.
- Same firmware, same `ux/out/sounds/*.wav`.
- Optional **C:** the 40 mm speaker on the BC337 through 22 Ω + 220 µF, to hear why it's not
  enough.
