# Store Hardware heartbeats in the ASP.NET API

Hardware reports its identity, selected league, and LAN address to a fixed
ASP.NET API heartbeat endpoint, using a personal user PAT and the firmware's
existing single API configuration. The backend stores one current record per
Hardware, updates its league when the Wi-Fi portal configuration changes, and
derives online status from the server-side last-seen time; the admin UI exposes
the current state within the Hardware's league. We chose this lightweight
latest-state model for diagnostics and deferred a dedicated Hardware credential
or heartbeat history.

The firmware keeps one configured base URL and hardcodes the heartbeat path, so
the deployed base URL must route both the existing MMR requests and the ASP.NET
heartbeat request. The heartbeat sends the configured credential as a bearer
PAT; existing MMR requests keep their `X-API-Key` header, so shared routing must
preserve both authentication contracts. The heartbeat carries `hardwareId`, `leagueId`, and
`localIpAddress`, and returns no body on success. Heartbeats run at startup and
periodically; the initial online window is fifteen minutes for a five-minute
heartbeat interval.
