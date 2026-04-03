---
title: Features Overview
description: Understand what Office Rivals supports today.
---

Office Rivals is built around tenant-safe competitive play inside organizations.

## Main Feature Areas

- Organizations and leagues
- League joining and member management
- Match submission
- Matchmaking queue flow
- Leaderboards and rating history
- Match flags and moderation
- Personal access tokens for API access

## Tenant Model

The product separates access at two levels:

- organization membership controls access to the tenant
- league membership controls regular-user participation inside a league

Moderators and owners are organization-scoped. Regular members must join a league before reading or writing league-scoped data.

## Highlights In The Current V3 UX

- org members can browse the league directory for their organization
- org members can self-join leagues
- match submission can use:
  - existing league players
  - existing org members who are not yet in the league
  - brand-new provisional players
- if an org member is selected during match submission but is not yet in the league, they are added automatically
- invited and removed memberships can be reactivated instead of fragmenting player history

![Signed-in leaderboard view](/screenshots/leaderboard.png)

_Signed-in users can browse leaderboard standings and recent match history from the app._

![Player profile with rating history](/screenshots/player-profile.png)

_Individual player pages surface rating history, match counts, and recent results._

## Security Boundaries

The important security rule is:

- non-admins cannot read or write league-scoped data for leagues they have not joined

Organization moderators and owners retain org-wide access by design.

Continue with the feature pages in this section for the details.
