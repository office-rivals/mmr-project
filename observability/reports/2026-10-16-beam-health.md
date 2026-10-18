# Beam health in Grafana (2026-10-16)

The goal counters' beam health (`firmware/beam-health-firmware-2026-10-16.md` §4) is now on the dashboards and has
four alerts. Metric names are as `firmware/lib/core/otlp.cpp` emits them: `foosball_beam_{ambient,lit,ball}_uA`,
`foosball_beam_{health,mode,margin}_ratio` in Prometheus. Lead reviewed the INTERFACES §10 row and accepted it.

## What changed

- **Device dashboard:** stats for beam health, mode, margin and ambient light; *Ambient light by hour of day*
  (panel 15); *Beam light and margin* over time.
- **Fleet dashboard:** a *Beam* column in the device table.
- **Alerts** (`grafana/provisioning/alerting/foosball.yaml`):
  - daylight on the beam two days running;
  - beam blocked for 10 min during play;
  - beam sensor dead;
  - beam margin low for over a day.
- **README** and the INTERFACES §10 alerting row are updated.

## Ambient by hour of day

The panel draws the highest `amb_na` from the `beam` *summary* log record for each hour. That record comes every
`beam_report_s` and at each session end. The panel shows the last 24 h, with yesterday, 2 days ago and 7 days ago
laid over the same clock times. Hours with no play have no summaries, so they are empty.

**Link for admin-ui:** `<grafana base URL>/d/foosball-device?var-device=<device_id>&viewPanel=panel-15`. The base
URL is deployment config on admin-ui's side, and the panel id is fixed.

## How each alert decides

| Alert | Source | Rule |
| --- | --- | --- |
| Daylight two days running | Loki, `health ambient_high` records | one in the last 2 h **and** one in the same 2 h yesterday (`offset 1d`) |
| Blocked 10 min | Loki, `health <state>` and `idle, reporting before sleep` records | state 10 min ago was `blocked`, and no other state or end of session since. The log flush is 5 min, so in practice 10–15 min |
| Sensor dead | Prometheus `foosball_beam_health_ratio` | last report == 4 (36 h window) |
| Low margin > 1 day | Prometheus `foosball_beam_health_ratio` | last report == 1, the last report the day before == 1, and none in the last day < 1 |

The device logs `health <state>` only on a change. A new session starts from `ok`, so a state that clears while
the device is asleep is never logged. That is why the blocked rule also ends at the end of a session, and why
sensor_dead and low_margin use the metrics, which give the current state at every report.

## Verified

I tested in a throwaway `grafana/otel-lgtm:0.34.0` with these files mounted, pushing OTLP JSON in the firmware's
shape. The twin has no beam ADC yet. Each alert fired on exactly its intended device:

| Alert | Fired on | Did not fire on |
| --- | --- | --- |
| Daylight | `sun` (onset 30 min ago and 24 h 15 min ago) | `once` (today only), `other-hour` (6 h apart) |
| Blocked | `stuck` (20 min) | `cleared` (5 min, then ok), `slept` (session ended), `fresh` (4 min). `fresh` fired on the next evaluation, once it was past 10 min |
| Sensor dead | `dead` | `fixed` (dead, then ok) |
| Low margin | `dirty` (30 h) | `wiped` (ok in between), `new-dirt` (5 h) |

The dashboards render: `screenshots/device-beam.png` shows the beam panels, the fleet table showed the Beam column
for every test device, and the `viewPanel=panel-15` link opens the panel on its own.

## Not used / open

- Firmware dropped the `foosball.beam.state_changes` / `.mode_changes` counters on purpose: the log records carry
  each change. Nothing here depends on them. Firmware confirmed the log strings the rules match, and will tell
  observability before changing them.
- The summary's `ball_na` is -1 when no ball passed in that window. The panels don't use it; they read ball light
  from the `foosball.beam.ball` metric.
- The summary record carries the max (worst) ambient and ball light, not min/avg. The panel uses the max, which is
  what decides `ambient_high`.
- Thresholds are server config (µA, per mode), so no threshold lines are drawn.
