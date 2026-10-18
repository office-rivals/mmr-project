# Goal counter firmware

One goal counter per goal, on a **Seeed XIAO ESP32-C6** (Arduino 3.x on ESP-IDF 5.5 via
[pioarduino](https://github.com/pioarduino/platform-espressif32)). It counts balls through an IR
break-beam, POSTs each goal, and has an undo button, a buzzer and a small debug OLED.

The device API is [`openapi.yaml`](openapi.yaml), the source of truth; backend mirrors it in
`api/docs/hardware-api.md`. Other contracts are in [`team/INTERFACES.md`](../team/INTERFACES.md).
Flashing a unit, step by step: [FLASHING.md](FLASHING.md).

## Layout

| Path | What |
|------|------|
| `lib/core/` | **All behaviour, hardware-free and host-tested.** `goal_app.*` is the app, driven through the `Hal` interface in `app.h`. Leaves: `api.*` (REST paths, payloads, response policy), `detector.h`, `event_queue.*` (the persistent goal queue), `beam_health.*`, `sound.h` (buzzer notes), `telemetry.h` (log ring, heartbeat, strap, battery cutoff), `otlp.*` (OpenTelemetry JSON) |
| `src/goal/` | The ESP32 side of `Hal`. `device.*`: NVS, Wi-Fi + the REST and OTLP lanes, device auth, LIS3DH, battery, buzzer, deep sleep. `main.cpp`: strap read, beam ISR + health pins, undo button, OLED, the app loop |
| `include/board.h` | Pin map and calibration knobs |
| `include/secrets.example.h` | Template for the gitignored `secrets.h` |
| `test/` | Host tests (Unity): `test_core`, `test_telemetry`, and `test_apps`, which drives the app through a fake HAL |
| `tools/mock_server.py` | Stdlib-only mock backend: device auth, score per table, the undo rules, an OTLP receiver with alerts |
| `src/lp/blink.c`, `tools/lp_build.py` | The LP-core program (status LED in deep sleep) and the post-script that builds it into `lp_blink.h` |
| `tools/check_openapi.py` | Validates the tests' payloads and a mock goal session against `openapi.yaml` |

## Build, flash, test

| Env | What |
|-----|------|
| `xiao_c6` | Production (default) |
| `xiao_c6_bench` | No light sleep: USB serial stays up, the LED follows the beam |
| `xiao_c6_per_goal` | Fallback: Wi-Fi off between goals, reconnect per goal |
| `native` | Host tests |

```sh
cd firmware
uvx platformio@6.1.19 run                     # build (-t upload to flash over USB-C)
uvx platformio@6.1.19 device monitor          # serial log, 115200
uvx platformio@6.1.19 test -e native          # host tests
uvx --with jsonschema --with pyyaml --with rfc3339-validator python tools/check_openapi.py
```

- **Use PlatformIO 6.1.19 exactly.** 6.2.0 breaks pioarduino's second build phase (`No module named
  'SCons.Tool.FortranCommon'`). If the very first build of a fresh checkout still fails with that, run it again.
- **The first build takes ~6 minutes.** Auto light sleep while associated needs ESP-IDF's PM and tickless
  idle, which the prebuilt Arduino libraries ship disabled. `custom_sdkconfig` makes pioarduino download
  ESP-IDF once (~750 MB) and rebuild them into the shared `~/.platformio` package. Another C6 project with a
  different `custom_sdkconfig` swaps them back, at ~4 minutes each way.
- **Partitions:** `huge_app.csv` (3 MB app, no OTA). NVS keeps the default offset, so a reflash keeps the
  queue, `seq`, the cached config and the device secret. After a full erase, a new random `epoch` keeps the
  `event_id`s unique.
- **Secrets** (`include/secrets.h`, see FLASHING §2): Wi-Fi, `API_BASE_URL`, `ENROLMENT_TOKEN`, `API_ROOT_CA`,
  and optionally `OTLP_ENDPOINT` / `OTLP_HEADER_NAME` / `OTLP_HEADER_VALUE` / `OTLP_ROOT_CA` (empty = no
  telemetry). Without the file, the build uses the example's placeholders and warns. There is no setup
  hotspot (radio rule, INTERFACES §1).

**End-to-end on a LAN:** `uv run tools/mock_server.py --token replace-me --idle 30` (add `--fail 0.3
--reject 0.1` for the retry and drop paths, `--devices my-devices.json` from
`tools/mock_devices.example.json` to map real device ids to tables and goals). Point `API_BASE_URL` at
`http://<laptop-ip>:8000` with the same token. A ball into the home goal is a point for away.

## Architecture

```
lib/core GoalApp ──calls──► app::Hal ◄──implements── src/goal (ESP32: pins, ISRs, NVS, Wi-Fi, tasks)
 (single-threaded, non-blocking,      ◄──implements── the digital twin (host, simulated)
  tested on the host)
```

- **Network is asynchronous.** The app calls `Hal::send(id, lane, ...)` and gets `response(id, code, body)`
  later. Two lanes, each with its own task and keep-alive connection: REST and OTLP. The glue connects Wi-Fi
  on demand and syncs NTP on the first connect of a wake.
- **Deep sleep is a request.** `RtcState` (RTC memory) is all that survives it: wake count, heartbeat
  schedule, counters, beam baselines and the log ring. It is zeroed on power-on or by another build.
- **One image, no role strap** (review 2: the scoreboard image is gone, so is R_STRAP and the boot check; D7 is
  free).
- **Device auth (§11).** Every REST request carries `X-Device-Id`, `Authorization: Device <secret>` (256
  bits from the hardware RNG with the radio on, kept in NVS, never logged) and `X-Enrolment-Token`. After an
  NVS wipe the device gets 401 until an admin resets it; goals stay queued.

## How it works

```
power-on / motion / button (ext1) ──► ACTIVE ──(no goal, no motion for idle_timeout_s)──► status ──► deep sleep
```

- **Detection.** Auto light sleep wakes only on GPIO *levels*, so the beam pin is a level interrupt that
  waits for the opposite level; the IRAM ISR timestamps each change. A goal counts once the beam has been
  blocked for `min_block_ms`, re-arms `lockout_ms` after it clears, and a ball already in the gate at wake is
  not a goal. Blocked for `stuck_after_s` → `beam_blocked: true`. The beam sees no direction or count, so no
  ball may rest in or upstream of it (the drawer queue sits downstream: DECISIONS 2026-10-16;
  `test_detector_queue_cases`).
- **Beam health** ([beam-health-firmware-2026-10-16.md](beam-health-firmware-2026-10-16.md), circuit:
  `electronics/beam-health-2026-10-16.md`). Every `beam_check_s` while the beam is clear, the glue masks the
  ISR for ~12 ms and reads the node on D2: ambient (LED off) and the 1 mA margin. A ball that arrives meanwhile
  still counts. States `ok` / `low_margin` / `ambient_high` / `blocked` / `sensor_dead`; a worse one sends a
  status with `reason: beam`. `beam_mode` `a` / `a_boost` / `b` / `auto` switches D10 and D6 (unused pins
  high-Z, never LOW). Auto: a failed try of `b` falls back to `a`, or to `a_boost` when `a`'s own margin is short
  too, and holds for the dwell. `[beam] summary` per `beam_report_s` gives the day's light profile. No ADC → checks off.
- **Plan C, chopped reads** (review 2 R1.6): `ambient_high` flags at 60 % of the ambient D8 tolerates, so D8 keeps
  counting while it holds for `BEAM_CHOP_AFTER_CHECKS` (2) checks; ambient beyond D8's limit switches at once (round 3).
  Then the app ignores D8 and polls a chopped read every
  `BEAM_CHOP_MS` (3, round 3: a hard shot blocks only ~9 ms): the node with the LED off and at 1 mA, both pull-ups,
  250 µs settling each (`Hal::beamChop`, ~0.6 ms masked). A ball counts as blocked when that difference falls below
  `BEAM_CHOP_FRAC` (½) of the clear beam's (lit1 from the last check). Off again at the next check without
  `ambient_high`. EST ≈ +5 mA while on (~20 % CPU duty): bench.
- **Goals** go to the NVS queue first and the buzzer chirps `goal` at once (no beep = not counted); the POST
  follows when the chirp ends (review 2).
- **Undo button + buzzer** (ux/goal-counter-phase1-2026-10-17.md Part B;
  [goal-counter-phase1-firmware-2026-10-17.md](goal-counter-phase1-firmware-2026-10-17.md)). Button on GPIO4
  (active LOW, ext1 wake), buzzer on GPIO7 (LEDC, volume from `sound_volume`).
  - Press-down while awake → `scan` tick. Held `UNDO_HOLD_MS` (1 s) → one undo of this counter's newest goal
    not yet undone, if it is younger than `undo_window_s` (else "no", nothing sent). The `UndoEvent` goes into
    the goal queue behind its goal → `POST /undo-events`, and `undo` plays.
  - 201 `[undo] applied`, 409 `already applied`, 422 `refused by server: <code>` → "no" if pressed this wake.
    Refusals are not counted in `dropped_events`.
  - A press from deep sleep shows the screen; held to 1 s it is an undo as when awake ("no", `Undo: too late`).
  - Held 10 s → `[undo] button stuck` (log only). A held pin is not armed for deep-sleep wake (it would loop);
    a 60 s timer looks again.
- **Debug OLED** (ux B5/B5a): 0.91" 128 × 32 SSD1306 at `OLED_ADDR` 0x3C on the LIS3DH's Wire (`OLED_HEIGHT`
  64 for a 0.96"), U8x8 text mode. Two lines of 16 in an 8 × 16 font, faults in inverse. Line 1 is the
  verdict: an undo result for 5 s, else live `Beam BLOCKED`, else the worst fault (`NO TABLE` > `WiFi off` /
  `srv 401|404|err` > `Beam DEAD|amb|low` > `Batt low 3.48V` > `Queue 12`), else `OK      End A`. Line 2 cycles
  every 2 s through Wi-Fi, battery + queue, beam, and end + version. On at press-down until 10 s after the
  release; after a key wake or a power-on until 10 s after the first server answer (30 s at most). Otherwise
  the panel sleeps (0xAE), also through deep sleep; it is never power-gated. A frame is ~50 ms of I²C at 100 kHz, so a
  lower-priority task draws it: the app (priority 2) preempts it, plan C's 3 ms polls never wait, and a LIS3DH read
  waits ≤ one 25-byte chunk (~2.3 ms). Bench: scope a GPIO around the frame and the polls.
- **Status LEDs** (ux/status-led-2026-10-18.md; [status-led-firmware-2026-10-18.md](status-led-firmware-2026-10-18.md)):
  red + green in series on GPIO5 (HIGH green, LOW red, Hi-Z off). A group of 30 ms blinks 150 ms apart:
  1 green = OK, 2 red = a fault (the same check as the OLED's verdict line), 3 red = battery low. Every 2 s
  awake (`GoalApp`), every 5 s asleep: before deep sleep the main core loads `src/lp/blink.c` into the LP core
  (built by `tools/lp_build.py` with ESP-IDF's LP-core startup), which blinks it with LP-timer wakes. The
  count asleep is the last session's. Dark at battery cutoff.
- **Motion.** The LIS3DH (10 Hz low-power, high-pass, INT1 latched) is read every `MOTION_POLL_MS` to keep
  the idle timer alive. Found at 0x19 or 0x18 (clones); a LIS3DSH is named in the log and not supported.
- **Network.** Per wake: connect (BSSID and channel cached in RTC memory), NTP, config (200 → cached in NVS;
  404 → unassigned, keeps counting). It stays associated in Wi-Fi power-save for the session, so a goal is one
  POST on an open connection (~0.1–0.3 s). Responses (`openapi.yaml`): 2xx/409 → done; 400/404/410/422 →
  dropped and counted; anything else → retried, backoff 5 s doubling to 5 min. `occurred_at` is null without
  NTP in this wake.
- **Power-loss safety (§7).** Each NVS write is atomic, and the queue writes the slot before `next` and `ack`
  only after a 2xx; each slot carries its `seq`, so a torn slot is skipped. A pull loses at most the goal being
  written; otherwise a resend that the server dedupes. `test_queue_power_loss_at_every_write` cuts power after
  every write of a 143-op sequence.

## Telemetry and alerts (§10)

- **OpenTelemetry, OTLP/HTTP + JSON**, straight to `OTLP_ENDPOINT` with its own header. Resource:
  `service.name` = `foosball-goal-counter`, `service.version`, `device.id`, `foosball.role`,
  `foosball.table_id`, `foosball.goal`.
- **Logs:** structured records (tag, message, up to 3 ints) in a 48-record ring in RTC memory (survives deep
  sleep, not power loss; drops and counts the oldest). Shipped every `LOG_EXPORT_MS` while Wi-Fi is up (5 min;
  60 s on the bench), 16 per batch, and all at the end of each session. Secrets and card UIDs are never logged.
- **Metrics** with every status: battery V, RSSI, connect time, queue depth, heap, reset reason, beam health;
  counters since power-on (goals, rejected blocks, stuck events, Wi-Fi retries, drops, wakes). OTLP waits for
  NTP. No traces.
- **Heartbeat:** a status + metrics at least every 24 h from a timer wake; a failed one retries after 1, 2,
  4 … 24 h.
- **Recommended alerts:** `foosball.battery.voltage` < 3.5 V or `low_batt: true` → replace the cells; **no
  metrics or status for > 36 h** → dead battery or gone (the one that catches a dead battery); a rising
  `brownout` reset reason → contacts or cells (review 2).
- **Testing:** point `OTLP_ENDPOINT` at the mock (it validates, prints `LOG` / `METRICS` / `ALERT`;
  `--stale-s 120`), or at the AppHost's otel-lgtm on `:4318` with `FOOSBALL_OTLP_LAN=true` (observability).

## Power

Auto light sleep whenever idle, Wi-Fi associated in power-save during a session, deep sleep between sessions.
Estimates for 4 h of play a day at 40 goals/h (electronics owns the budget, INTERFACES §3/§8; battery life
§0). **Measure on the bench.**

| State | Current | Per day |
|-------|---------|---------|
| Deep sleep: C6 + buck Iq + LIS3DH + VBAT divider (+ OLED in 0xAE, EST 5–20 µA) | ~15 µA | 0.3 mAh |
| ACTIVE: light sleep + associated, power-save (budgeted for real APs) | ~1.0 mA | 4.7 mAh |
| Beam, mode `a` (`a_boost` / `b` add ~3.1 / 3.25 mA) | ~1 mA | 4.7 mAh |
| Goal POSTs (~0.2 s × 80 mA), connects per wake, beam checks | | ~1.2 mAh |
| Telemetry: 5-min log flush + session-end export + heartbeat | | ~0.6 mAh |
| **Total** | | **~12 mAh/day** |

- `xiao_c6_per_goal` skips the associated idle but reconnects per goal: ~13.5 mAh/day.
- If the collector closes idle connections sooner than 5 min, every flush pays a TLS connect: ~2.4 mAh/day.
  `LOG_EXPORT_MS` is the lever.
- GPIO3 drives the RF switch (0.33 mA when LOW): driven only while Wi-Fi is on.
- **Low battery** (3×AA NiMH or alkaline, radio-off reading; review 2 R1.5): below `LOW_BATT_WARN_MV` 3750 →
  `low_batt: true`; below `LOW_BATT_CUTOFF_MV` 3650 → one status, then deep sleep where motion only re-measures;
  resume at `LOW_BATT_RESUME_MV` 3950 (rested NiMH bounces back). The full path drops ~0.55–0.7 V at a TX burst: at
  15 dBm 3650 gives only ≈ 2.95–3.10 V, hence 11 dBm below warn; the bench gate (≥ 3.1 V on 3V3 at the cutoff at
  11 dBm, max sound + OLED + TX) sets the final cutoff, and warn / resume move with it (board.h ties them: cutoff
  + 100 / + 300) (config `batt_*_mv` could tune them, but backend doesn't serve them).
  - **Never a sound and a TX together:** a goal chirps first and its POST waits for the chirp to end (+0.22 s to
    the server). Below warn, one request at a time, and while one is on the air a new sound waits (the latest
    wins) and a goal or undo is held in RAM (seq fixed): both happen once the radio is quiet, chirp first. So near
    the cutoff a chirp can come up to `HTTP_TIMEOUT_MS` late; no NVS write and no sound during TX.
  - **TX power down below warn** (round 3): `WIFI_TX_POWER_LOW` 11 dBm instead of 15 (a smaller burst and path
    drop); Wi-Fi retries and reconnects in the metrics show a table that can't take it (RSSI is the AP's
    downlink and doesn't show our TX); then 15 again.
  - **Brown-out detector at 2.76 V** (sdkconfig level 5, ≥ 2.7 V): a sagging rail resets cleanly; count
    `brownout` resets in the metrics.
  - **On USB the pack isn't read** (VBUS sense HIGH): the charger's leak through D1 would fake ~2 V.
  - **Lithium cells** (5.4 V): above `BUZZER_MAX_MV` 5000 the buzzer duty is scaled by (5000/VBAT)².
  - **Per-unit calibration (assembly, no server needed), two points:** a bench supply on J_BAT, USB-C connected, the
    serial monitor open. Set ~3.6 V, meter it, type `cal <mV>`; set ~4.5 V (≥ 0.3 V away), meter, `cal <mV>` again.
    The device stores gain + offset through both points in NVS (gain 0.8–1.2, offset ≤ ±300 mV) and prints
    `cal: … -> gain … offset … saved`. One point alone stores a scale. A config `vbat_scale` would override it.

## Calibration knobs

- **Server config** (validated ranges, cached in NVS): `idle_timeout_s`, `min_block_ms`, `lockout_ms`,
  `stuck_after_s`, `undo_window_s`, `sound_volume`, `vbat_scale`, `beam_*`.
- **`board.h`:** `BEAM_WARMUP_MS`, `BEAM_ADC_TOP_MV`, `MOTION_THRESHOLD_MG`, `SOUND_VOLUME_DB`,
  `SOUND_OCTAVE_SHIFT`, `LED_*`, `UNDO_HOLD_MS`, `BUTTON_STUCK_MS`, `OLED_HEIGHT`, `OLED_FLIP`, `I2C_CLOCK_HZ`,
  `LOG_EXPORT_MS`, timeouts, backoff, `WIFI_TX_POWER`.

## Bench checklist (when parts arrive)

Run the mock with `--idle 30`. Measure from the cells with USB unplugged (USB back-powers the board).

- [ ] **Beam:** in `xiao_c6_bench` the LED follows the ball; stable within `BEAM_WARMUP_MS`. In `xiao_c6`
      (light sleep on) 50 goals at real speed count exactly, with no double counts (tune `min_block_ms`,
      `lockout_ms`); the beam pins hold through light sleep.
- [ ] **Beam health:** a dark node reads ~3300 mV (else set `BEAM_ADC_TOP_MV`); ambient in µA against a meter
      per mode (morning, midday, evening, lamp); 50 balls with `beam_check_s` 10 lose no goal; each mode's pins
      as wired, all LOW in deep sleep.
- [ ] **Wake:** idle → `status` + sleep current; a tap wakes it; passers-by and the next table don't (tune
      `MOTION_THRESHOLD_MG`). After an ext1 wake D1, GPIO4 and GPIO6 still read correctly.
- [ ] **Undo + buzzer:** a goal chirps; a press ticks; a 1 s hold plays `undo` and the mock logs `UNDO … -> 201`;
      a hold 11 s after the goal plays "no"; a hold from deep sleep plays "no"; a button held at sleep gives
      no wake loop. Chirp audible from the playing position; volumes step evenly; at the cutoff (11 dBm) High + Wi-Fi:
      no brown-out (the low-battery gate below).
- [ ] **OLED:** readable through the opening at 50 cm, the right way up (else `OLED_FLIP`); the 10 s timing;
      `Beam BLOCKED` with a hand in the gate; on after a cell swap; sleep current with and without the module.
      I²C runs at 100 kHz: measure the rise time at the far module before raising `I2C_CLOCK_HZ` to 400000.
- [ ] **Status LEDs:** awake one green every 2 s; unassigned (mock `--unassigned`) two red; a supply at 3700 mV
      three red; asleep the same every 5 s (scope: 30 ms wide, 150 ms apart); dark at cutoff; sleep current
      with the LP core blinking vs `blinks` 0 (expect + ~1 µA plus the LED). Visible in the drawer, not glaring.
- [ ] **Network:** goal → mock ≤ 3 s; AP off for 5 goals, all arrive in order after; pull a cell after a goal
      20× (each arrives once, repeats are `GOAL dup` → 409); the 11 dBm uplink (the low-battery power) in the table: judge it by delivered requests, retries and reconnects
      over a session (RSSI is the AP's downlink, it says nothing about our TX), else the FPC antenna (electronics).
- [ ] **Currents:** sleep (~15 µA; ~0.35 mA high = RF switch still driven), ACTIVE idle (~2 mA), charge per goal
      (~16 mAs). ~15–25 mA idle means PM isn't active (`esp_pm_configure failed`). Send them to electronics.
- [ ] **Low battery** (review 2 gate; the full gate with 11 dBm and a chirp over a POST: electronics/README *Low battery*): ramp a supply through 3750 / 3650 / 2900 mV: `low_batt`, then one status
      and quiet sleep, off at 3900, back at 3950. Scope 3V3 at the cutoff with the real battery holder and lead
      during TX + a High chirp + the OLED: ≥ 3.1 V, else raise the cutoff (board.h).
      No `brownout` reset reason over 20 goals at the cutoff. Two-point `cal`, then the boot `mv=` matches the meter
      at 3.6, 3.65 and 4.5 V within ±20 mV.
- [ ] **USB in place:** plugging USB wakes it (`[usb] powered`), `-t upload` works with no BOOT/RESET, goals still
      count; unplug → normal sleep.
- [ ] **USB-only reading:** J_BAT unplugged (ASSEMBLY §5.2), USB in: status `battery_mv: null`, no cutoff. GPIO6 in deep sleep on
      batteries reads a clean LOW (no internal pull-up against the divider).
- [ ] **Plan C in daylight:** with ambient_high held for two checks the log says `chopped reads on`; 50 balls
      count with no false goals, including hard shots (~9 ms blocks); the extra current while it runs (expect ≈ +5 mA); `chopped reads off` when
      the light drops.
- [ ] **Auth and telemetry:** first request → `ENROLLED`; after an NVS erase, 401s and queued goals. `LOG` /
      `METRICS` at session end and every 60 s (bench); `--stale-s 120` alerts after unplugging. The collector
      keeps the OTLP connection over 5 min idle. `min_free_heap` stays above ~40 KB.

## Third-party libraries

Fetched by PlatformIO at build time (pinned in `platformio.ini`), none vendored. Our code is MIT.

| Library | Version | Licence |
|---------|---------|---------|
| bblanchon/ArduinoJson | 7.4.2 | MIT |
| olikraus/U8g2 (U8x8) | 2.36.5 | BSD-2 |

No OTA: firmware updates go over USB-C.
