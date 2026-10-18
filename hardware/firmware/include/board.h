#pragma once
// Pin map and hardware knobs — INTERFACES.md §2, electronics' pin map v2 (XIAO ESP32-C6, confirmed).
// Deep-sleep (ext1) wake only from LP GPIO 0-7.

#define PIN_BATT_ADC 0              // D0: pack voltage (before the Schottky), 1M/1M + 100 nF; -1 = not fitted
#define BATT_DIVIDER 2.0f           // Vbat / Vadc
#define NO_PACK_MV 1000             // below this: no cells -> battery_mv null, never cutoff (and on USB it isn't read)
// 3xAA, NiMH or alkaline; radio-off reading. WARN -> status low_batt; CUTOFF -> one status, then deep sleep with
// no Wi-Fi/flash until VBAT >= RESUME (or a fresh boot reads >= CUTOFF). Review 2 (R1.5, lead): the full path
// drops ~0.55-0.7 V at a TX burst, so the cutoff is 3650 to keep the 3V3 rail >= 3.0 V; the bench gate
// (>= 3.1 V at the cutoff, max sound + OLED + TX) sets the final values (config batt_*_mv: not served).
#define LOW_BATT_CUTOFF_MV 3650     // 1.22 V/cell; the bench gate may raise it ...
#define LOW_BATT_WARN_MV (LOW_BATT_CUTOFF_MV + 100)    // ... and warn and resume move with it (cutoff < warn < resume)
#define LOW_BATT_RESUME_MV (LOW_BATT_CUTOFF_MV + 300)  // hysteresis: rested NiMH bounces back ~0.1 V/cell
#define PIN_MOTION_INT 1            // D1 (LP GPIO): LIS3DH INT1 (SparkFun SEN-13963), push-pull, latched
#define MOTION_ACTIVE_LEVEL 1
#define PIN_BEAM_RX 19              // D8 (moved from D2 2026-10-15): TEFT4300 collector, 220k pull-up to
                                    // BEAM_PWR; edge time EST: measure on the bench. Light-sleep wake: any pin
#define PIN_VBUS_SENSE 6            // back pad MTCK (LP GPIO; moved from D2 2026-10-16):
                                    // USB 5 V via 6.8k/10k (review 2), HIGH = plugged in -> ext1 HIGH wake, no
                                    // sleep while present (flash in place), VBAT ignored. -1 = not fitted
// Beam health (electronics/beam-health-2026-10-16.md §2). Modes: A = D3 + D9; A+ = + D10; B = + D10 + D6.
// Unused beam pins are high-Z, never LOW (a LOW D6 would pull the node down, a LOW D10 would rob the LED).
#define PIN_BEAM_ADC 2              // D2 (ADC1_CH2): the receiver node via 1k, as D8 (+ 1 nF). -1 = none
#define PIN_BEAM_LED 20             // D9: R_LED 2.2k -> TSAL6200, 1 mA
#define PIN_BEAM_BOOST 18           // D10: R_LED_B 270 -> the same LED, +5.3 mA (modes A+, B; review 2)
#define PIN_BEAM_PU_B 16            // D6 (U0TXD: ROM wake log off): R_PU_B 68k to the node (mode B = 52k)
#define BEAM_BLOCKED_LEVEL 1        // blocked = HIGH, clear = LOW (also LOW while beam is unpowered)
#define PIN_BEAM_POWER 21           // D3: the receiver pull-up R_PU 220k (the LED moved to D9 2026-10-16)
#define PIN_I2C_SDA 22              // D4
#define PIN_I2C_SCL 23              // D5
#define I2C_CLOCK_HZ 100000         // LIS3DH + OLED (review 2: 100 kHz until the bench measures the rise time on the
                                    // OLED lead; 400000 only after that)
#define LIS3DH_ADDR 0x19            // tried first; 0x18 (clone boards, SDO low) is found automatically
// Phase 1 Part B (ux/goal-counter-phase1-2026-10-17.md B4): the undo button and the buzzer.
#define PIN_UNDO 4                  // back pad MTMS (LP GPIO: ext1 wake): MX blue switch to GND, 100k pull-up + 1k;
                                    // LOW = pressed. -1 = not fitted
#define PIN_SOUND 7                 // back pad MTDO: LEDC -> BC337 -> CMT-1209-390T,
                                    // base pull-down: silent at boot and in sleep. -1 = not fitted
#define BUZZER_MAX_MV 5000          // review 2: above this pack voltage (lithium cells) the duty is scaled down
#define OLED_ADDR 0x3C              // debug OLED (ux B5a): 0.91" 128 x 32 SSD1306 on D4/D5 with the LIS3DH,
                                    // panel sleep when off (never power-gated). 0 = not fitted
#ifndef OLED_HEIGHT
#define OLED_HEIGHT 32              // 32: 0.91" 128 x 32 (lead DECIDE 2026-10-18); 64: a 0.96" 128 x 64 (the same
                                    // 2 lines, centred)
#endif
#define OLED_FLIP 0                 // round 3: the 0.91" is wired at its left end (header left), so it reads upright;
                                    // 1 = rotate 180° if it reads upside down on the first power-on (ASSEMBLY §6)
// Status LEDs (ux/status-led-2026-10-18.md, electronics: red + green in series on one pin): HIGH = green,
// LOW = red, Hi-Z = off. An LP GPIO: the LP core blinks it in deep sleep. -1 = not fitted
#define PIN_STATUS_LED 5            // back pad MTDI
#define LED_BLINK_MS 30             // ux §2: one blink
#define LED_GAP_MS 150              // blink to blink within a group
#define LED_PERIOD_AWAKE_MS 2000    // a group this often while awake ...
#define LED_PERIOD_ASLEEP_S 5       // ... and while asleep
#define PIN_LED 15                  // XIAO user LED, active LOW (~0.9 mA lit); -1 to disable
#define PIN_RF_SWITCH 3             // XIAO RF switch enable, active LOW, 10k pull-up: LOW costs 0.33 mA,
                                    // so drive it only while Wi-Fi is on
#define LED_ON_LEVEL 0

// Calibration knobs
#define BEAM_WARMUP_MS 50           // receiver settle time after power-up (EST; measure)
#define BEAM_CHOP_MS 3              // plan C (review 2/3): chopped reads this often (incl. ~0.6 ms settling) while ambient_high persists ...
#define BEAM_CHOP_AFTER_CHECKS 2    // ... for this many health checks in a row (0 ms = never)
#define BEAM_CHOP_FRAC 0.5f         // blocked = the LED's difference below this share of the clear beam's (lit1)
#define BEAM_CHOP_SETTLE_US 250     // per LED step at both pull-ups (52 k with the 1 nF: τ ≈ 52 µs; ~5 τ, 0.7 %)
#define BEAM_ADC_TOP_MV 3300        // the C6 ADC's real top at 12 dB (bench): readings at or above it count as
                                    // the rail (no ambient), so a clipped dark node never reads as light
#define SOUND_VOLUME_DB {0, -18, -9, 0}  // config sound_volume 0..3 (0 = off) -> dB (~3 / 12 / 50 % duty, ux B3)
#define SOUND_OCTAVE_SHIFT 0        // whole octaves (+1 = up) to sit the notes near the CMT-1209's 2048 Hz peak
#define UNDO_HOLD_MS 1000           // ux B2: hold this long to undo (a ball or a bump can't)
#define BUTTON_STUCK_MS 10000       // still held: "button stuck", log only, no deep-sleep wake on it
#define MOTION_THRESHOLD_MG 64      // high-pass filtered; raise if passers-by wake it, lower if play doesn't

// Firmware knobs
#ifndef USE_LIGHT_SLEEP
#define USE_LIGHT_SLEEP 1           // auto light sleep; 0 for bench debugging (light sleep drops USB serial)
#endif
#define LOG_EXPORT_MS (USE_LIGHT_SLEEP ? 300000 : 60000)  // OTLP log flush while associated (lead 2026-10-15:
                                    // 5 min in production for the battery, 60 s on the bench); sleep flushes all
#define MOTION_POLL_MS 2000         // read the latched LIS3DH INT this often while ACTIVE
#define HTTP_TIMEOUT_MS 5000
#define WIFI_TIMEOUT_MS 10000
#define RETRY_MIN_MS 5000
#define RETRY_MAX_MS 300000
#define NTP_SERVER "pool.ntp.org"
#define WIFI_TX_POWER WIFI_POWER_15dBm  // peaks ~250 vs ~354 mA at full power; raise if RSSI is poor
#define WIFI_TX_POWER_LOW WIFI_POWER_11dBm  // below the warn level (round 3): a smaller burst, less path drop. Watch
                                    // RSSI in the metrics; 8.5 dBm (WIFI_POWER_8_5dBm) if the table takes it
