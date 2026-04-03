---
title: Match Submission
description: Report matches using existing players, org members, or new provisional players.
---

Office Rivals supports low-friction match entry.

## Basic Rules

To submit a match successfully:

- the league must have an active season
- the caller must have league access
- each submitted player slot must resolve to exactly one player reference
- the same player cannot appear twice across teams

## Supported Player Sources

When submitting a match, a slot can resolve to:

- an existing league player
- an organization member who is not yet in the league
- a brand-new provisional player

## Automatic League Enrollment

If a selected player already belongs to the organization but not the league, match submission can add them to the league automatically.

The UI should make this explicit so the reporter understands the side effect.

This is the current low-friction path for the common case where someone already belongs to the org but has not joined the specific league yet.

## Provisional Players

If someone plays before they create an account, a provisional player can be created during match entry.

That flow should:

- capture a display name
- optionally capture an email
- create the organization membership and league player needed for the match
- allow later claim or reconciliation

If an email is supplied and it already maps to an existing user or invited org member, the system can reuse that organization identity instead of creating a duplicate person record.

## Submission Payload Shape

At the API level, each player slot can currently be one of:

- `leaguePlayerId`
- `organizationMembershipId`
- `newPlayer`

This keeps match entry atomic: the API resolves the player identities and records the match in one operation.

## Why This Matters

This keeps score entry fast and avoids blocking on account creation at the worst possible moment: right after people finish a game.
