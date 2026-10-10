# MMR Project

Matchmaking and rating system: players, teams, matches, and MMR calculation across
a frontend, an API, and an MMR calculation service.

## Language

**Hardware**:
A physical Randomizer Box installation tracked by the platform. Hardware is
identified independently of its changing network address and is bound
permanently to the league chosen at its Hardware Registration — moving it to a
different league is not an operation on the existing Hardware; it requires a
new Hardware Registration.
_Avoid_: Device, hardware model

**Hardware Registration**:
The one-time administrative action (Moderator/Owner) that creates a Hardware
record for a specific league and mints its Hardware Secret.
_Avoid_: Pairing, provisioning, onboarding

**Hardware Secret**:
The credential a Hardware presents to authenticate its own requests
(heartbeat). Issued once at Hardware Registration or Hardware Secret Rotation
and shown in that response only — never retrievable
again, stored only as a hash. Exactly one Hardware Secret is valid for a
Hardware at any time.
_Avoid_: Device token, API key, hardware PAT

**Hardware Secret Rotation**:
An administrative action that mints a new Hardware Secret for an existing
Hardware, invalidating the previous one immediately. Does not affect the
Hardware's league binding or history.
_Avoid_: Refresh, renewal

**Hardware Revocation**:
An administrative action that permanently disables a Hardware's ability to
authenticate. The Hardware record and its heartbeat state are kept;
only future authentication is blocked.
_Avoid_: Deletion, deactivation

**Hardware Heartbeat**:
An authenticated periodic report from Hardware that confirms it can reach the
backend and supplies its current LAN address. The platform keeps the latest
heartbeat state so administrators can see whether the Hardware is still online.
The reporting Hardware's identity and league come from its Hardware Secret, never
from the report's own body.
_Avoid_: Hardware ping, health check
