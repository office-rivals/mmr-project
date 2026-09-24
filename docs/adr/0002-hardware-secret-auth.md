# Dedicated Hardware Secret replaces PAT for device authentication

Hardware devices authenticated as a human user via a personal access token
(PAT), reusing the firmware's single API configuration slot. This let a device
impersonate its owner (no independent identity), shared PAT's only scope
(`write`) with human automation, and trusted a self-reported `hardwareId`/
`leagueId` in the request body rather than the authenticated principal —
exactly the class of gap fixed ad hoc for PAT in general (see the
`PatAuthorizationHandler` re-derivation logic and its allowlist test). We
introduce a device-only credential instead: a Hardware Secret, bound
permanently to one league at Hardware Registration, presented as
`Authorization: Bearer hw_<secret>` on `/hardware/heartbeat`,
`/hardware/pairing`, and `/hardware/matchmaking`. These routes carry no
tenant IDs; the league is derived solely from the authenticated secret, never
from the request body or URL, closing the impersonation gap by construction
rather than by re-checking claims per request.

We considered mTLS and HMAC request signing; both were rejected as
out-of-proportion to the firmware's capabilities and the ESP32 TLS setup
(which does not verify the server's certificate — a separate, already-flagged
risk, unaffected by which bearer scheme rides over it). We also considered
keeping PAT but adding a narrower device-only scope; rejected because it does
nothing about the missing device identity or the self-reported payload
problem, only shrinks blast radius.

Because no hardware is deployed in production yet, this is a hard cutover: PAT
support is removed outright from these three endpoints, with no dual-auth
transition window. Hardware secrets are single-slot (one hash + `RevokedAt` on
the `Hardware` row, no separate credential-history table) since nothing yet
requires keeping past secrets; add that table if rotation auditing becomes a
real requirement rather than a hypothetical one.

**Status**: accepted, supersedes the auth and league-mutability decisions in
[0001](./0001-hardware-heartbeat.md) — Hardware no longer authenticates via PAT,
and its league is now fixed at Hardware Registration rather than following
Wi-Fi portal reconfiguration.
