# Hardware review 2: firmware fixes (2026-10-18)

The items tagged [firmware] in `electronics-review/2026-10-18-CONSOLIDATED.md`, with lead's calls. Host-checked, not on
hardware, nothing committed.

| Item | Done |
|---|---|
| **R1.5 low battery** | Cutoff **3650** (warn 3750, resume 3950; `board.h`); the contract has optional `batt_*_mv` config keys, which backend does not serve (lead: YAGNI). **VBAT calibration** over USB serial: `cal <meter mV>` stores the trim in NVS (no server). **Chirp first:** no request starts while a sound plays (a goal's POST follows its chirp, +0.22 s). **Below warn:** one request at a time, and a goal or undo detected while one is on the air is held in RAM (seq fixed), then written when the radio is quiet. **Brown-out at 2.76 V** (sdkconfig level 5, confirmed in the rebuilt libs). **Per-unit VBAT calibration:** procedure in README *Power* and sent to electronics for the ASSEMBLY step (`vbat_scale` = meter / boot-log `mv=`) |
| **R1.6 plan C** | Chopped reads: once `ambient_high` holds for 2 checks, D8 is ignored and the app polls `Hal::beamChop` every 10 ms (LED off vs 1 mA, both pull-ups, ~0.4 ms masked). Blocked = the difference < ½ of the clear beam's lit1. Off at the next check without `ambient_high`. EST +3–5 mA while on. The "edges up to ~2 ms" claim in `board.h` is now "EST, measure on the bench" |
| **USB-only phantom pack** | `batteryMv()` = −1 while VBUS sense is HIGH (no cutoff, `battery_mv` null) |
| **USB-sense pull** | `rtc_gpio_pullup_dis` / `pulldown_dis` on GPIO6 before deep sleep; `board.h` cites the 6.8 k / 10 k divider (electronics' part) |
| **Delete the role strap** | `dev::readStrap`, `PIN_ROLE_STRAP`, `tel::goalStrap`, the wrong-board path and its tests are gone. `boot(cause)` takes the wake cause only; `SleepRequest` is now `{timer_s, blinks}`. D7 is free. openapi: `wrong_board` is "no longer sent" (still in the enum); INTERFACES §9 is rewritten |
| **I²C 100 kHz default** | `I2C_CLOCK_HZ 100000`; 400 kHz only after a rise-time measurement (bench item) |
| **Buzzer duty cap** | Above `BUZZER_MAX_MV` 5000 the duty is scaled by (5000/VBAT)² |
| **Docs (mine)** | `board.h` stale rows (MX blue, not 12 × 12 tactile; GPIO5 = status LED; the divider; the edge time), README (*Power*, plan C, bench gates: low battery at the cutoff ≥ 3.1 V, USB-only reading, plan C in daylight, I²C), INTERFACES §9 + the low-battery row (lead to review) |

**Checks:** native 52/52 (2 new: `test_review2_battery_rules`, `test_review2_chopped_reads_in_daylight`; the strap and
wrong-board tests are gone); check_openapi 30/30 (the new config example); all 3 envs build (flash 1.268 MB); twin
adapted and passes 18/18 against this build.

**Residuals for the bench:**
- A chirp that *starts* while a POST is already on the air is not delayed (the radio can't be stopped). Below warn,
  only one request runs at a time.
- Plan C's current and its 0.5 threshold are EST.
- Waiting on electronics to confirm warn 3750 / resume 3950 (their README §3 table still shows the old values).
