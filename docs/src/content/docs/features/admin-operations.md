---
title: Admin operations
description: What organization owners and moderators can manage, where it lives in the beta, and the role each action needs.
---

Owners and moderators manage their organization from the admin area at `/admin`. They reach it from **Admin** in the account menu, which also shows how many match flags are waiting. Regular members don't see the entry, and the organization admin pages refuse them.

The beta's admin routes are in [`frontend-beta/src/routes/admin/`](https://github.com/office-rivals/mmr-project/tree/main/frontend-beta/src/routes/admin) and the controllers in [`api/MMRProject.Api/Controllers/V3/`](https://github.com/office-rivals/mmr-project/tree/main/api/MMRProject.Api/Controllers/V3).

## Admin pages

| Page | What it's for |
| --- | --- |
| `/admin` | The organizations you can administer, with your role and open flag count in each |
| `/admin/<org>` | Overview: league count, active members by role, open match flags, your role |
| `/admin/<org>/members` | Invite links, email invites, and the member list |
| `/admin/<org>/leagues` | All leagues in the organization. Owners create leagues here |
| `/admin/<org>/leagues/<league>` | League overview: current season, players, format, open flags, five most recent matches |
| `/admin/<org>/leagues/<league>/matches` | Edit, delete and recalculate matches in the current season |
| `/admin/<org>/leagues/<league>/match-flags` | Review and resolve flagged matches |
| `/admin/<org>/leagues/<league>/seasons` | List seasons and start new ones |

Organization settings (name and slug) live outside the admin area, at `/<org>/settings`, and only owners can open them.

## Role matrix

Roles are ordered Owner, then Moderator, then Member, and each role can do everything the roles below it can. Paths are relative to `/api/v3/organizations/{orgId}`.

| Action | Minimum role | Endpoint |
| --- | --- | --- |
| View the organization | Member | `GET /` |
| Rename the organization or change its slug | Owner | `PATCH /` |
| List members | Member | `GET /members` |
| Invite a member by email | Moderator | `POST /members` |
| Edit a member's display name, username or email | Moderator | `PATCH /members/{membershipId}/profile` |
| Change a member's role | Owner | `PATCH /members/{membershipId}` |
| Remove a member | Owner | `DELETE /members/{membershipId}` |
| List, create and delete invite links | Moderator | `/invite-links` |
| List leagues | Member | `GET /leagues` |
| Join a league | Member | `POST /leagues/{leagueId}/players` |
| Create or edit a league | Owner | `POST /leagues`, `PATCH /leagues/{leagueId}` |
| Start a season | Owner | `POST /leagues/{leagueId}/seasons` |
| List all seasons, including scheduled ones | Moderator | `GET /leagues/{leagueId}/admin/seasons` |
| Edit or delete a match | Moderator | `PATCH`, `DELETE /leagues/{leagueId}/matches/{matchId}` |
| Recalculate ratings | Moderator | `POST /leagues/{leagueId}/matches/recalculate` |
| List, view and resolve flags | Moderator | `/leagues/{leagueId}/admin/match-flags` |
| Submit matches, flag matches, read league data | League access | `/leagues/{leagueId}/...` |

"League access" means you've joined the league, or you're a moderator or owner. Queueing for matchmaking is the exception: everyone, owners included, has to join the league first. The API enforces all of this with the `RequireOrgMember`, `RequireOrgModerator`, `RequireOrgOwner` and `RequireLeagueAccess` policies in [`V3AuthorizationPolicies.cs`](https://github.com/office-rivals/mmr-project/blob/main/api/MMRProject.Api/Authorization/V3/V3AuthorizationPolicies.cs). Some beta pages show owner-only controls to moderators too. The API rejects the action when a moderator uses them.

## Members

`/admin/<org>/members` has three sections.

**Invite links.** Create a link with an optional maximum number of uses and an optional expiry date, copy its `/join/<code>` URL, or delete it. Anyone who redeems a link joins as a member, unless a pending email invite for their address already gives them a role.

**Invite by email.** Enter an email, a role, and optionally a display name and username. No email is sent. The membership waits until someone signs in with that address and then becomes theirs. You can only invite at your own role or below, so moderators can't invite owners.

**Current members.** For each member you can:

- edit the display name and username, and the email of a membership that isn't linked to an account yet (a linked member's email comes from their account)
- change the role (owners only)
- remove the member (owners only)

The API refuses to demote or remove the last owner.

Removing a member keeps their history. The membership is marked as removed, so their league players, matches and rating history stay attached. If they come back through an invite link or a new email invite, the same membership is reactivated. See [Organizations and leagues](/features/organizations-and-leagues/#removed-and-rejoined-members).

## Leagues

Owners create leagues at `/admin/<org>/leagues` with:

- a name and a slug (unique within the organization)
- a format: 2v2 or 1v1
- a winning score: 10 by default, or blank for free-form scoring

The beta has no screen for editing a league. Owners can change the name, slug, format or winning score with `PATCH /api/v3/organizations/{orgId}/leagues/{leagueId}`. The winning score can't change while the current season has recorded matches.

## Seasons

A league needs a current season before anyone can submit a match. A season has only a start date. The current season is the one with the latest start date that has already passed, so starting a new season ends the previous one.

At `/admin/<org>/leagues/<league>/seasons`, an owner can start a season now or schedule one for a later date. The list marks each season as current, scheduled or past. Members only see seasons that have started.

Ratings carry over between seasons with a soft reset. In a player's first match of a new season, their rating is rebuilt from a fresh starting point that keeps a third of the distance between their previous skill estimate and the default. Recalculation applies the same rule, so replaying a season gives the same numbers as the original submissions.

## Matches: edit, delete, recalculate

`/admin/<org>/leagues/<league>/matches` lists the league's matches, newest first. Edits, deletions and recalculation only apply to matches in the current season.

- **Edit** replaces the players or corrects the scores, under the same rules as a [new submission](/features/match-submission/#rules-the-api-enforces). Editing doesn't touch ratings. Recalculate from that match afterwards to carry the correction through to the leaderboard.
- **Delete** removes the match and any flags on it. For the latest match, the players' ratings roll back to what they were before it. For an earlier match, later ratings stay wrong until you recalculate.
- **Recalc** on a match replays ratings from that match forward. **Recalculate season** replays every match in the current season.

API (`/api/v3/organizations/{orgId}/leagues/{leagueId}/matches`):

- `PATCH /{matchId}`: edit
- `DELETE /{matchId}`: delete
- `POST /recalculate`: replay the current season, or from the match in the optional `fromMatchId` query parameter

## Match flags

League players flag a match they think is wrong with **Report match** on the league page, or with the flag button next to a match on a player's profile. Each person can have one open flag per match, and can edit or delete it until it's resolved. Open flags are counted in the account menu and the admin navigation.

At `/admin/<org>/leagues/<league>/match-flags` you can filter flags by status, look at the flagged match, edit it and recalculate on the same page, then resolve the flag as **Resolved** or **Dismissed** with an optional note.

**League player endpoints** (`/api/v3/organizations/{orgId}/leagues/{leagueId}/match-flags`):

- `POST /`: flag a match
- `GET /`: list flags in the league, optionally filtered with `?status=`
- `GET /me`: your own open flags
- `PUT /{flagId}`: change the reason on your own open flag
- `DELETE /{flagId}`: delete your own open flag

**Admin endpoints** (`/api/v3/organizations/{orgId}/leagues/{leagueId}/admin/match-flags`):

- `GET /`: list all flags, optionally filtered with `?status=`
- `GET /{flagId}`: view a flag
- `PATCH /{flagId}/resolve`: set the status to `Resolved` or `Dismissed`, with an optional `resolutionNote`

## Limits

- Moderators and owners only have authority inside their own organizations. There's no platform-wide admin role yet.
- Any signed-in user can create an organization through the API. Nothing restricts this to a super-admin, so keep it in mind on a shared deployment.
- Some identity-sensitive endpoints, such as redeeming invites and managing tokens, don't accept personal access tokens. See [Access control and tokens](/features/access-control-and-tokens/).

For how the endpoints are organized, see [API design](/reference/api-design/).
