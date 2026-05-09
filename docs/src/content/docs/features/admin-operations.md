---
title: Admin Operations
description: What organization owners and moderators can manage from the /admin surface.
---

The frontend exposes a dedicated admin surface at `/admin/[orgSlug]/...` for organization owners and moderators. Regular members do not see this surface.

This page summarizes what lives there, who can do what, and how it maps to the V3 API. The corresponding frontend lives under [`frontend/src/routes/admin/[orgSlug]/`](https://github.com/office-rivals/mmr-project/tree/main/frontend/src/routes/admin) and the controllers under [`api/MMRProject.Api/Controllers/V3/`](https://github.com/office-rivals/mmr-project/tree/main/api/MMRProject.Api/Controllers/V3).

## Role Matrix At A Glance

| Operation | Required role |
| --- | --- |
| List org members | Org Member |
| Invite a member | Org Moderator |
| Update a member's profile | Org Moderator |
| Change a member's role | Org Owner |
| Remove a member | Org Owner |
| List, create, delete invite links | Org Moderator |
| Create a season | Org Owner |
| Edit a match | Org Moderator |
| Delete a match | Org Moderator |
| Recalculate the current season | Org Moderator |
| List, view, and resolve match flags | Org Moderator |

These are enforced server-side via the `RequireOrgMember`, `RequireOrgModerator`, and `RequireOrgOwner` authorization policies.

## Members

Admin members view: `/admin/[orgSlug]/members`.

From here moderators and owners can:

- invite new members by email — creates an `OrganizationMembership` with an invite email and a nullable user ID (the user record is linked when the invitee signs in)
- update a member's display name and other profile fields
- change a member's role (owner-only)
- remove a member (owner-only)

API surface (`api/v3/organizations/{orgId}/members`):

- `GET /` — list members
- `POST /` — invite member
- `PATCH /{membershipId}` — update role (owner-only)
- `PATCH /{membershipId}/profile` — update profile
- `DELETE /{membershipId}` — remove member (owner-only)

Removing a member preserves history. The membership is retained so existing league players, match participations, and rating history stay attached. If the same person rejoins, the existing membership can be reactivated rather than splitting their identity across two records.

## Invite Links

Admin invite links view is part of the org admin area. Moderators manage shareable invite links that any new user can redeem to join the organization.

API surface (`api/v3/organizations/{orgId}/invite-links`):

- `GET /` — list active invite links
- `POST /` — create a new invite link
- `DELETE /{linkId}` — revoke an invite link

The redeem side lives under `api/v3/invites/{code}` and is used by the frontend `(authed)/join/[code]` flow when an invitee opens an invite URL. Both invite endpoints are JWT-only — PATs cannot redeem invites on a user's behalf.

## Leagues

Admin leagues view: `/admin/[orgSlug]/leagues`. From here owners and moderators can configure leagues and drill into a specific league at `/admin/[orgSlug]/leagues/[leagueSlug]/...`, which exposes:

- matches admin
- seasons admin
- match flags admin

## Seasons

A league must have an active season before matches can be submitted. Seasons are managed at `/admin/[orgSlug]/leagues/[leagueSlug]/seasons`.

API surface (`api/v3/organizations/{orgId}/leagues/{leagueId}/seasons`):

- `POST /` — create a season (owner-only)
- `GET /` — list seasons (any league member)
- `GET /current` — the league's currently active season

When a new season is created, ratings carry over via a soft reset rather than starting from zero. The reset is applied uniformly across both initial match calculation and bulk recalculation, so a recalc that crosses a season boundary produces the same numbers as the original linear submission.

## Matches: Edit, Delete, Recalculate

Match-management operations live at `/admin/[orgSlug]/leagues/[leagueSlug]/matches`.

Moderators can:

- edit an existing match (correct teams, scores, or other fields)
- delete a match
- recalculate the current season's ratings, optionally from a specific match ID forward

API surface (`api/v3/organizations/{orgId}/leagues/{leagueId}/matches`):

- `PATCH /{matchId}` — edit
- `DELETE /{matchId}` — delete
- `POST /recalculate` — recalc the current season; accepts an optional `fromMatchId` query parameter

Recalculation walks the match history forward and rewrites rating deltas. It is the right tool when an earlier match was edited or deleted and downstream ratings need to be brought back into sync. Match submission itself remains a write reserved for league members; only the moderation operations require a higher role.

## Match Flags

Match flags let league members raise an issue with a specific match (incorrect score, wrong players, etc.). Admins triage and resolve them.

There are two endpoint groups:

**League-member endpoints** (`api/v3/organizations/{orgId}/leagues/{leagueId}/match-flags`):

- `POST /` — flag a match
- `GET /` — list flags in this league
- `GET /me` — list the caller's own flags
- `PUT /{flagId}` — update the reason on a flag the caller created

**Admin endpoints** (`api/v3/organizations/{orgId}/leagues/{leagueId}/admin/match-flags`):

- `GET /` — list all flags, optionally filtered by `?status=...`
- `GET /{flagId}` — view a flag
- `PATCH /{flagId}/resolve` — resolve a flag

Resolution carries a status update plus moderator notes. The admin queue lives at `/admin/[orgSlug]/leagues/[leagueSlug]/match-flags`.

## What Admins Cannot Do

A few intentional limits worth knowing:

- moderators and owners are organization-scoped, not platform-scoped — they have no authority outside their own organizations
- creating an organization is open to any signed-in user today, not gated to a "super admin" role; this is something to be aware of in shared deployments
- match submission is still gated on league access, not org role; an owner who has never joined a specific league cannot submit a match into that league themselves, but can edit matches that exist
- PATs intentionally cannot perform a handful of identity-sensitive operations, including invite redemption and PAT lifecycle (see [Access Control and Tokens](/features/access-control-and-tokens/))

For deeper architectural context on how these endpoints are organized, continue to [API Design](/reference/api-design/).
