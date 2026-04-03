---
title: Organizations and Leagues
description: How tenant boundaries, roles, and league membership work.
---

## Organizations

An organization is the main tenant boundary in Office Rivals.

Organizations contain:

- members
- leagues
- invite links
- role assignments

## Roles

Current organization roles are:

- `Owner`
- `Moderator`
- `Member`

Roles are organization-scoped, not league-scoped.

In practice:

- owners can manage the organization and leagues
- moderators can perform moderation actions across the organization
- members can participate in the organization and join leagues

## Leagues

A league is a competitive space within an organization. Members can belong to the organization without belonging to every league.

Today, leagues are joinable by any active org member. There is no private-league access model yet.

## Joining Leagues

Users can join leagues themselves from the league directory. They may also be added to a league implicitly when match submission references an existing organization member who is not yet in that league.

The current API path for self-join is:

- `POST /api/v3/organizations/{orgId}/leagues/{leagueId}/players`

That route requires active org membership but not prior league membership.

## What Regular Members Can Access

Regular members:

- can list leagues in their organization
- can self-join leagues
- cannot read or write league-scoped data until they are in that league

This includes things like:

- league players
- matches
- leaderboards
- rating history
- queue and matchmaking state

## What Moderators And Owners Can Access

Moderators and owners are org-scoped. They can access league-scoped data across the organization without being individually enrolled in every league.

## Removed and Rejoined Members

Membership removal preserves history instead of hard-deleting the relationship.

If a user rejoins:

- the existing organization membership can be reactivated
- existing league-player rows can stay attached
- historical matches and ratings remain associated with the same profile trail

This avoids the common failure mode where one real person ends up split across multiple identities after leaving and rejoining.
