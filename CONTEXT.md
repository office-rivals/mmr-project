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

**Pending Match**:
A proposed match whose selected players must respond before it becomes an Active
Match.
_Avoid_: Match offer, provisional game

**Active Match**:
A match with fixed teams that is ready for its result to be recorded.
_Avoid_: Live match, confirmed game

**RFID Team Assignment**:
An ordered array assigning each presented RFID Tag to a team side in a league.
It does not create a match, expose player details, or reserve any player.
_Avoid_: RFID match, match result, scan match

**Team Side**:
The physical or display designation assigned to a team in an RFID Team Assignment.
The Randomizer Box interprets side `0` as white and side `1` as red.

**Match Temperature**:
A value from 0 to 1 controlling how much team assignment favors randomness over
MMR balance; 0 is fully MMR-based and 1 is fully random.
_Avoid_: Randomness, shuffle level
