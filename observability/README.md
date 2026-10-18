# Observability: foosball devices

Grafana dashboards and alert rules, as code, for the foosball goal counters and
scoreboards (`hardware/`). The devices send OpenTelemetry logs and metrics as
OTLP/HTTP JSON (`hardware/team/INTERFACES.md` §10). Locally they go to
[`grafana/otel-lgtm`](https://github.com/grafana/docker-otel-lgtm), which bundles
an OTel Collector, Prometheus, Loki and Grafana in one container. The AppHost
runs it as the `grafana` resource.

The api and mmr-api still export to the Aspire dashboard. Only the devices use
this stack.

| Path | What |
| --- | --- |
| `prometheus.yaml` | Replaces the image's Prometheus config. Every OTLP resource attribute becomes a label (`device_id`, `foosball_role`, `foosball_table_id`, …), and a 14-day out-of-order window lets the digital twin backfill history |
| `grafana/dashboards/*.json` | **Foosball — fleet** and **Foosball — device** (folder *Foosball*) |
| `grafana/provisioning/dashboards/foosball.yaml` | Loads the dashboards above |
| `grafana/provisioning/alerting/foosball.yaml` | Alert rules plus a placeholder contact point |
| `screenshots/` | The dashboards and alerts with data from the digital twin (`device-beam.png`: synthetic beam data) |

## Run it

```bash
dotnet run --project local-dev/MMRProject.AppHost
```

The `grafana` resource does **not** start automatically. Most developers never
need it, and the image is large. Click **Start** on it in the Aspire dashboard,
and once it is running (about 30 s) open its `http` link. The login is
anonymous admin, which is fine for local use only. Data lives in the
`grafana-lgtm-data` Docker volume. To start empty, stop the AppHost and run
`docker volume rm grafana-lgtm-data`.

Dashboards and alert rules are loaded from these files at startup. You can edit
a dashboard in the UI, but save the change by exporting the JSON (*Export → Save
to file*) over the file here. Otherwise it is lost when the volume is removed.
Alert rules are read-only in the UI. Edit the YAML and restart the resource.

### Pointing devices at it

The OTLP/HTTP endpoint is `http://<host>:4318`. Devices append `/v1/logs` and
`/v1/metrics` themselves.

- **Digital twin / mock (same machine):** use `--otlp http://127.0.0.1:4318`.
  This works by default. Example with three days of history and every alert
  scenario:

  ```bash
  cd hardware/twin && make
  ./build/twin --base <rest-base-url> --otlp http://127.0.0.1:4318 \
    --start -3d play --tables 5 --hours 72 --silent 1@24 --low-batt 1 --crash 1 --wrong-board 1
  ```

- **Real devices on the LAN:** by default the AppHost binds port 4318 to
  `127.0.0.1` only. The endpoint has **no authentication**, so open it to the
  network only on a trusted network:

  ```bash
  FOOSBALL_OTLP_LAN=true dotnet run --project local-dev/MMRProject.AppHost
  ```

  Then set `OTLP_ENDPOINT` to `http://<your-machine's-LAN-IP>:4318` in the
  firmware's gitignored `include/secrets.h`, and leave `OTLP_HEADER_NAME` empty.
  Make sure your OS firewall allows inbound TCP 4318.

## What's on the dashboards

Devices export metrics once per session end and on the heartbeat (at least every
24 h), not continuously. Every "current value" is therefore the last sample in a
long window (`last_over_time(…[14d])`), and counters are shown as
`increase(…[1d])`.

- **Fleet:** devices reporting, silent > 36 h, low battery, and goals in the
  time range. A device table shows role, table, goal/end, battery, last seen,
  RSSI and firmware, with a link to the drill-down. It also has a low-battery
  list, battery voltage per device, and goals per table per hour. Goals per hour
  come from the `goal counted` log records, and the table is the device's
  `table_id`, or its `device_id` until it is configured.
- **Device:** battery, last seen, RSSI, wake count, and identity. It also shows
  battery and Wi-Fi (RSSI and connect time) over time, problems per rolling 24 h
  (rejected beam blocks, stuck-beam events, queue drops, Wi-Fi retries and
  dropped logs), boots by reset reason, and the device's logs with a level
  filter. Goal counters also get beam health, mode, margin and ambient light,
  the beam readings over time, and **ambient light by hour of day**: the last
  24 h with yesterday, 2 days and 7 days ago laid over the same clock times
  (from the beam summary log record). Link straight to that panel with
  `/d/foosball-device?var-device=<device_id>&viewPanel=panel-15`.

Beam health is decided on the device from server config
(`firmware/beam-health-firmware-2026-10-16.md` §4). The fleet table shows it as
the *Beam* column.

## Alerts

| Rule | Condition | Severity |
| --- | --- | --- |
| Battery low | last voltage in 36 h below the warn level (low-battery thresholds, INTERFACES §3) | warning |
| No telemetry for 36 h | sent metrics in the last 14 days, none in the last 36 h | critical |
| Wrong firmware image for the board | a `wrong board` boot log in the last 25 h (the device reports, then sleeps 24 h) | critical |
| Repeated abnormal resets | ≥ 3 boots with reset reason panic / *wdt / brownout / other in 24 h | warning |
| Daylight on the beam two days running | `health ambient_high` began within the last 2 h and within the same 2 h of the clock yesterday | warning |
| Beam blocked for 10 min during play | the state was `blocked` 10 min ago, with no other state and no end of session since (10–15 min with the 5-min log flush) | critical |
| Beam sensor dead | `sensor_dead` at the last report | critical |
| Beam margin low for over a day | `low_margin` at the last report and at the last report the day before, never `ok` in between | warning |

All rules route to the `foosball-placeholder` contact point. It is a webhook to
`alerts.example.invalid`, because the channel isn't decided yet. Once it is,
replace the receiver in `grafana/provisioning/alerting/foosball.yaml`. Grafana
supports Slack, e-mail, Teams, webhooks and others.

Limits:

- "No telemetry" can only fire for a device that reported at least once in the
  last 14 days. A device that never reports, or has been dead for longer than
  that, needs the backend's device list (last seen) to catch it.
- A device in a fast crash loop never reaches its report, so it shows up as
  "No telemetry", not as "Repeated resets".
- The beam alerts match the firmware's log text (`health <state>`, `summary`,
  `idle, reporting before sleep`). If firmware rewords them, update the rules.

## Production options (for later)

| | Azure Managed Grafana | Grafana Cloud | Self-hosted |
| --- | --- | --- | --- |
| What it is | Managed Grafana UI. Metrics in Azure Monitor managed Prometheus, logs in Log Analytics | Managed Grafana, Prometheus (Mimir) and Loki with an OTLP endpoint | This same `otel-lgtm` image (or the separate components) on a Container App or VM |
| Devices send to | An OTel Collector you run, which exports to Azure Monitor | Grafana Cloud's OTLP gateway directly (HTTPS and a basic-auth header) | Your collector, behind HTTPS and an auth check |
| Fits us | Same Azure subscription and AAD sign-in as the app | Least work. Free tier likely covers a few tables (check current limits) | Full control, no vendor. But you patch, back up and secure it |
| Effort | Medium: collector plus two data sources, and dashboards ported from Loki to KQL for logs | Low: change `OTLP_ENDPOINT` and the header, then import the dashboards and alerts | Medium: storage, auth, TLS and upgrades |
| Dashboards here | Metrics panels reuse PromQL. Log panels need rewriting | Reused as-is | Reused as-is |

Whichever we pick, devices need HTTPS and a credential. The firmware already
supports that: `OTLP_HEADER_NAME` / `OTLP_HEADER_VALUE` set the credential
header, and `OTLP_ROOT_CA` sets the CA for HTTPS.
