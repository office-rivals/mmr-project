---
title: Organizations and leagues
description: How organizations, roles, invites and league membership work.
---

## Organizations

An organization is the tenant boundary in MMR Project. It contains:

- members, each with a role
- leagues
- invite links

Its slug is the first part of every app URL, as in `/acme/friday-foosball`. These slugs are reserved because they clash with app routes: `submit`, `player`, `admin`, `statistics`, `matchmaking`, `random`, `profile`, `login`, `api`, `new-player`, `active-match`, `join` and `settings`.

Neither frontend has a screen for creating an organization yet. Any signed-in user can create one with `POST /api/v3/organizations`, sending a signed-in session token (personal access tokens are rejected there). The creator becomes its owner. Owners can rename the organization or change its slug at `/<org>/settings`.

If you belong to exactly one organization with exactly one league, the app opens that league directly. Otherwise the home page lists your organizations and the leagues you've joined.

## Roles

Every membership has one of three roles:

- `Owner`
- `Moderator`
- `Member`

Roles belong to the organization, not to a league. In practice:

- owners manage the organization, its leagues, seasons and roles
- moderators manage members, invites, matches and match flags across the organization
- members play: they join leagues, submit matches, queue and report matches

An organization always keeps at least one owner. The API refuses to demote or remove the last one. For the full list of who can do what, see [Admin operations](/features/admin-operations/).

## Joining an organization

There are two ways in:

- **Invite link.** A moderator or owner creates a link from the admin area, optionally with a maximum number of uses and an expiry date. The invitee opens `/join/<code>`, or enters the code at `/join`, and joins as a member (or with the role from a pending email invite for their address).
- **Email invite.** A moderator or owner invites an email address with a chosen role. No email is sent. The membership waits until someone signs in with that address, and then it's claimed automatically.

Invite codes are 12 characters long. Looking up or redeeming an invite is limited to 10 attempts per minute per user.

## Leagues

A league is a competitive space within an organization, such as a foosball table or a table tennis ladder. Each league has:

- a name and a slug
- a format: 1v1 or 2v2
- a winning score: a fixed target the winner must reach (10 by default), or none for free-form scoring

Owners create leagues from the admin area. Members can belong to the organization without joining every league.

Any active organization member can join any league. There are no private leagues.

## Joining leagues

The league directory at `/<org>` lists every league in the organization, marked "Joined" or "Available". Choose **Join League** to join one.

You can also be added to a league without joining it yourself. When someone submits a match and picks an organization member who isn't in that league yet, the member is added to the league as part of the submission. See [Match submission](/features/match-submission/).

The API route for joining is `POST /api/v3/organizations/{orgId}/leagues/{leagueId}/players`. It requires active organization membership but not prior league membership.

## What regular members can access

Regular members can:

- list the leagues in their organization
- list the organization's members
- join any league

They can't read or write a league's data until they join it. League data includes:

- league players
- matches
- leaderboards and rating history
- statistics
- the matchmaking queue and active matches
- match flags

## What moderators and owners can access

Moderators and owners can read and write league data in every league of their organization without joining each one. They also get the admin area at `/admin/<org>` for members, invite links, leagues, seasons, match corrections and match flags. See [Admin operations](/features/admin-operations/) for the role each action needs.

In the beta, the player-facing league pages (leaderboard, submit, matchmaking) only open for leagues you've joined, whatever your role. For other leagues, moderators and owners work through the admin area or the API.

## Removed and rejoined members

Removing a member marks the membership as removed instead of deleting it. Their league players, matches and rating history stay where they are.

If the same person comes back, the old membership is reused:

- joining through an invite link reactivates it as a `Member`
- a new email invite to the same address resets it to invited, with the role in the invite

Either way, the person keeps one membership and one history instead of being split across two identities.
