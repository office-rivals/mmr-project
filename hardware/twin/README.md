# Digital twin: virtual foosball tables

Develop and test the backend without hardware. Each virtual table has **2 goal counters** that speak
exactly what real ones speak: the REST API ([`firmware/openapi.yaml`](../firmware/openapi.yaml),
including §11 device auth) and OTLP/HTTP logs + metrics (INTERFACES §10).

It runs **the firmware's own logic** (`GoalApp` and everything under
[`firmware/lib/core`](../firmware/lib/core)), compiled for your machine. Only the hardware is simulated:
beam + receiver + ball, undo button, accelerometer, battery, USB 5 V sense, NVS (with power pulls), RTC
memory, deep sleep, Wi-Fi, the buzzer, the status LED and the debug OLED. The glue ([`src/device.h`](src/device.h)) is the
twin's `src/goal/main.cpp` and decides nothing itself.

## Quick start

Needs a C++20 compiler, `make`, libcurl (preinstalled on macOS; `libcurl4-openssl-dev` on Debian/Ubuntu)
and Python 3 for the mock server. The first `make` downloads ArduinoJson (the version in
`firmware/platformio.ini`) into `build/deps`.

```sh
cd twin
./run-ci.sh     # builds, starts firmware/tools/mock_server.py on a free port, runs every scenario per ball size
```

The suite runs once per end of the ball range in INTERFACES §0 (`TWIN_BALLS="31 36"`, mm). Exit code 0 =
every scenario passed at both sizes.

A goal is a ball rolling through the beam, ~17 mm above the channel floor (INTERFACES §4), at a random
0.5–3 m/s: the beam is blocked for the ball's chord at that height divided by its speed (10–71 ms).

The receiver is modelled electrically (electronics/beam-health-2026-10-16.md §3): the node is pulled up
through the beam mode's resistor(s) and pulled down by the LED's light (none with a ball in the gate,
73 µA per mA typ) plus the drawer light. Between V_IL and V_IH the twin reads the wrong way, so mode `a`
loses balls above ~3.75 µA of drawer light and mode `b` above ~16 µA (fitted parts = firmware's `beam::Cfg`;
the scenarios' light levels are fractions of these limits, so a part change moves them too). Scenarios set `setAmbient(µA)`,
`lit_ua` (dirt, a weak LED) and `shortReceiver()`. Plan C's chopped read (`beamChop`) is the node LED-off minus
LED-on, both pull-ups, as a point sample. The app task can be held up: each request start costs a 2 ms radio burst
(EST), and `busy(ms)` stalls it on purpose. Beam and button edges are queued with their ISR time and reach the
app in its next loop, as in the glue. The OLED costs nothing (the glue draws on its own lower-priority task).

## Against your backend

1. Register the devices: `./build/twin devices` prints the registry (device id → role, table, goal end
   `home`/`away`; a 2v2 roster per table; extra config some devices need, e.g. `"beam_mode": "auto"`).
   Every scenario has its own table; `play` uses tables 101+.
2. Run:

```sh
export TWIN_BASE=http://localhost:8081/api/v3/hardware   # REST base URL (the part before /devices/...)
export TWIN_ENROLMENT_TOKEN=<org enrolment token>
export TWIN_OTLP=http://localhost:4318                    # OTLP/HTTP base, or "" for no telemetry
./build/twin run all                                       # or: run stuck_ball goal_undo ...
```

For this repo's API, `api/scripts/hardware-twin-stack.sh` does both steps (Postgres in Docker, the API,
a seeded table per twin table, every device pre-assigned) and prints the env.

What the scenarios expect from any backend:

- A goal is accepted (201) within 10 s. The score a scenario checks is what the server accepted: per
  device, `/goal-events` minus `/undo-events` (a ball into the home goal is a point for the right).
- `event_id` is deduped: a resend is answered 409 and never counts twice.
- Undo refusals are 422 with a code (`not_yours`, `too_late`, …); `goal_undo` assumes `undo_window_s` 10.
- Unassigned devices: config 404. A known device id with a different secret: 401.

Device secrets derive from `TWIN_SECRET_SEED` (default `twin`) and the device id, so a virtual device
keeps its identity across runs; set your own seed for brand-new devices on a shared backend.

## Scenarios

| Name | What it checks |
|------|----------------|
| `simultaneous_burst` | 8 rounds of same-instant goals at both ends: 8 : 8, none lost, one POST per goal (no retries) |
| `clock_skew` | Devices 5 s behind, 5 s ahead, and never synced (`occurred_at: null`): every goal counts |
| `power_pull_mid_post` | Cells pulled after the goal POST left: the resend has the same `event_id` and is deduped. Pulls inside the NVS write sequence: at most the goal in progress is lost, `seq` is never reused |
| `offline_queue_drain` | Wi-Fi down for 5 goals: queued in NVS, delivered once each when it's back |
| `stuck_ball` | A ball stuck in the gate: one goal, sleep status `beam_blocked: true` |
| `low_battery` | `low_batt` in status and 3 red blinks (awake and asleep); below warn one request at a time: a goal detected while the last one's POST is out waits in RAM, both count once; below cutoff exactly one `cutoff` status, then radio and LED silence until fresh cells |
| `heartbeat_and_silence` | Idle devices send a daily heartbeat; a dead one stays silent for 50 h (your >36 h alert should fire) |
| `role_mismatch` | Config role `scoreboard` for a goal counter: it still counts and reports `metrics.config_role` |
| `unassigned` | Config 404: goals still sent with `table_id: null` |
| `server_errors` | 503/429/401 retried with growing backoff and delivered once; 422 dropped and counted |
| `nvs_wipe` | New secret for a known id: 401, the goal stays queued and is retried, never scored |
| `several_tables` | 3 tables, 30 interleaved random goals: each counter's goals accepted once. Which table the server credits isn't visible on the device API |
| `ball_sizes` | 31 and 36 mm balls at 0.5–3 m/s each count once; a ball rolling back out doesn't count twice |
| `usb_flash` | USB wakes a sleeping counter; it never sleeps and keeps counting (even on flat cells), its goals carry `battery_mv: null` (VBAT ignored on USB); unplugged, it sleeps |
| `drawer_queue` | 3 goals 2 s apart each count once; a waiting ball nudged back into the beam parks there: not a goal; beam health `blocked` at once (status reason `beam`) and at sleep; drawer cleared → next goal counts, health `ok` |
| `drawer_light` | A day and a half of drawer light, home mode `a`, away `auto`. 80 % of `a`'s limit (3 µA): `a` reports `ambient_high`, auto moves to `b` (`ok`). Sun, 80 % of `b`'s limit (~13 µA): `a`'s D8 is blind, its first check turns plan C's chopped reads on and it still counts; `b` counts with `ambient_high`. Dark: auto back to `a`. Dirty receiver: `low_margin` (auto may step to `a_boost`), then its `b` trial fails the margin check and falls back (to `a_boost` while `a`'s margin is too low, else `a`), held for the dwell |
| `beam_faults` | Home `a`, away `b`. Dirty aperture and a weak LED → `low_margin` (beam status, sleep status, OTLP `foosball.beam.health` 1), every goal counts; fixed → `ok`. Asleep the LED blinks 2 red for a fault, 1 green for `ok`. Shorted receiver → `sensor_dead` in both modes (OTLP 4), no goal made up |
| `plan_c` | Plan C (R2-B3): in sun beyond any D8 mode (2× `b`'s limit) chopped reads come on; 60 fastest balls (9 ms block) at random phases with the radio busy all count, with the screen off and on. A goal the app reaches only after the ball has left (core held up 100 ms) counts from the D8 edge and reports no false `ambient_high` |
| `goal_undo` | Undo button: held 1 s undoes a false count (201); 0.5 s only ticks; a double count takes two presses; 11 s late → "no", nothing sent; power lost before the 201 → resend 409, undone once; held up offline past the window → 422 `too_late` + "no" (real time); another counter's goal → 422 `not_yours`; from deep sleep a short press only shows the screen, held 1 s gives "no"; a stuck button answers once, then the counter sleeps and stays asleep |

Every scenario also checks, on every device: no busy loop (`tick()` never keeps asking to run again at
once: on hardware that keeps the CPU awake), no deep sleep with the buzzer, the screen or the status LED
on, the status LED only ever blinks (never on > 100 ms), and asleep it blinks 1–3 per group, 0 at cutoff.

Errors are injected **inside the twin** (`Fault` in [`src/link.h`](src/link.h)): Wi-Fi down, status codes
the server never sees, power pulled after a request left. They need nothing special from the backend.

## Play

`play` runs tables like an office (15 goals, then a rest of 20 min to 4 h, so devices sleep, heartbeat
and wake again), for dashboards and alerting:

```sh
./build/twin --speed 10 play --tables 3 --hours 2     # 10x real time
./build/twin --start -3d play --tables 3 --hours 72   # 3 days of telemetry, ending about now
```

Faults, each on the first N tables: `--silent N[@H]` (home counter dies after H hours, never back),
`--low-batt N` (away counter between cutoff and warn). `./build/twin -h` lists every
option (`--seed`, `--ball`, `--wire FILE` logs every request and answer, `-v` device logs).

Device ids: `fb-747700TTTTRR` (TTTT = table number in hex, RR = 01 home, 02 away). No Espressif MAC
starts with `74:77:00`, so they never collide with real devices.

## How time works

All devices share one virtual clock that jumps from event to event, so 50 h of heartbeats take
milliseconds. HTTP is real; while a request is in flight virtual time stands still, so a slow server
never causes a timeout unless a scenario injects one. Requests at the same virtual instant reach the
server concurrently.

Server-side timers run in real time, so a backend that ages goals by its own clock sees durations
compressed. The exception is `goal_undo`'s late-undo step, which switches the twin to real time.

`--seed` makes the inputs repeatable. On purpose, the queue's random epoch inside `event_id` varies per
run, so a backend that remembers event ids doesn't dedupe the next run's goals.

## Layout

| File | What |
|------|------|
| `src/device.h` | `app::Hal` on simulated parts: clock, NVS, RTC, sleep/wake, power pull, USB, Wi-Fi/NTP, buzzer, OLED, §11 secret |
| `src/devices.h` | The goal counter's beam, receiver, ball and undo button |
| `src/link.*`, `src/http.*` | Per-device network over libcurl, fault injection, a record of everything sent |
| `src/sim.h`, `src/sim_kv.h`, `src/run.h` | Event scheduler, NVS with power pulls, virtual-time runner |
| `src/scenarios.cpp` | The scenarios and their assertions |
| `src/main.cpp` | CLI, `devices` registry, `play` |

Adding a scenario: write `static void myCase(Ctx& c)` in `src/scenarios.cpp`, drive the table
(`goalInto`, `holdButton`, `pull`, `link.faults`, `battery_mv`, `runFor`), assert with `c.check(...)` and add
it to the list. A scenario that needs devices registered differently returns them from `regs`.
