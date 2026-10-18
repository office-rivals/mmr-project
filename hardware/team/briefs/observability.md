# Brief: observability

You are `observability`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md`, `team/INTERFACES.md` §10,
`firmware/README.md` (OTLP section), and the repo's `../CLAUDE.md`. You work in
`local-dev/MMRProject.AppHost/` and a new top-level `observability/` folder.

## Goal
Devices send OTLP/HTTP JSON logs + metrics (§10). Make that visible and alertable:
1. Add **grafana/otel-lgtm** (pinned version) to the Aspire AppHost with an OTLP/HTTP endpoint devices can
   reach on the LAN, and decide with the team whether the API/mmr-api also export there (keep Aspire's
   dashboard working).
2. **Grafana dashboards as code** (provisioned JSON in `observability/`): fleet overview (devices,
   last seen, battery V per device, low-battery list), per-device drill-down (Wi-Fi RSSI/connect time,
   rejected blocks, stuck events, resets by reason, queue drops, logs), goals per table/hour.
3. **Alert rules as code**: battery below warn (3.5 V), no telemetry from a device > 36 h, wrong_board /
   repeated resets. Contact point left as a placeholder (channel undecided).
4. Prove it with `twin` (digital twin) and firmware's mock: screenshots of dashboards with simulated data.
5. README: how to run, where to point devices, and the production options (Azure Managed Grafana,
   Grafana Cloud, self-hosted) as a short comparison for later.

## Rules
- No commits. Public repo: no deployment-specific values. Pin image versions.
- Report progress and completion to lead; questions for the user → lead.
