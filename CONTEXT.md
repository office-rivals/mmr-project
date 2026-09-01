# MMR Project

Matchmaking and rating system: players, teams, matches, and MMR calculation across
a frontend, an API, and an MMR calculation service.

## Language

**RFID Tag**:
A physical NFC card/fob a player carries, identified by its raw hardware UID. A
tag exists independently of any player until it is paired.
_Avoid_: Card, chip, device

**Pairing**:
The one-time process that links an RFID Tag to a Player: the player requests a
Pairing Code from their profile, then scans the tag and enters that code on the
box. A tag has at most one player; a player may hold several tags.
_Avoid_: Linking (as a verb for the process), registration, binding

**Pairing Code**:
A short-lived, player-specific code (a sequence of colors) generated on request
and required to complete a Pairing. It expires 24 hours after issue or is
consumed the moment it is used in a successful pairing — an incorrect
submission does not consume it. Re-requesting while a code is still valid
returns the same code rather than issuing a new one.
_Avoid_: PIN, token

**Hardware**:
A physical Randomizer Box installation tracked by the platform. Hardware is
identified independently of its changing network address and is associated with
the league selected in its configuration.
_Avoid_: Device, hardware model

**Hardware Heartbeat**:
An authenticated periodic report from Hardware that confirms it can reach the
backend and supplies its current LAN address. The platform keeps the latest
heartbeat state so administrators can see whether the Hardware is still online.
_Avoid_: Hardware ping, health check
