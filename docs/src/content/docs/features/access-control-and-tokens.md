---
title: Access control and tokens
description: How the API checks organization and league access, and how to create, use and revoke personal access tokens.
---

## Access model

The API checks access at the organization level and the league level:

- an active organization membership gives access to the organization
- joining a league gives a regular member access to that league's data
- moderator and owner roles apply across the whole organization, so they can reach every league in it without joining

In other words, regular members are limited to the leagues they've joined, while moderators and owners can administer and oversee every league in their organization. See [Admin operations](/features/admin-operations/#role-matrix) for the role each action needs.

## How the API authenticates requests

Every API request carries an `Authorization: Bearer <token>` header. The token is one of:

- **a session token (JWT)** from Clerk, which the frontend sends for you when you're signed in
- **a personal access token (PAT)**, for scripts and integrations

If the header value starts with `Bearer pat_`, the API treats it as a PAT. Anything else is validated as a Clerk JWT.

## Personal access tokens

A PAT lets a script call the API as you. It's a string that starts with `pat_` followed by 64 hex characters. The API stores only a SHA-256 hash of it.

### Create and revoke tokens in the beta

Open the account menu and choose **Personal Access Tokens**, which goes to `/settings`.

1. Choose **Create New Token**.
2. Give it a name and, optionally, an expiry date.
3. Copy the token from the "Save your token now!" box. It's shown only once.

The token table lists each token's name, when it was last used, when it expires and when it was created. **Revoke** deletes a token permanently, and requests using it fail straight away.

### Use a token

Send it as a bearer token:

```bash
curl -H "Authorization: Bearer pat_<your-token>" \
  https://api.example.com/api/v3/organizations/<org-id>/leagues/<league-id>/leaderboard
```

A PAT acts as the user who created it, so your role and league memberships still apply. A member's token can't reach a league the member hasn't joined, and only an owner's token can perform owner actions.

### Scope

PATs have a single scope, `write`, and the API rejects any other scope. A `write` token can call every endpoint that accepts PATs, for reading and writing alike.

### Organization and league restrictions

A PAT can be created:

- with no restriction
- restricted to one organization
- restricted to one organization and one league within it

Tokens created in the beta have no restriction. To create a restricted token, call `POST /api/v3/me/tokens` with `organizationId`, and optionally `leagueId`, in the body. That endpoint only accepts a session token, not a PAT. You must be an active member of the organization, and the league must belong to it.

A PAT is only accepted on routes under `/api/v3/organizations/{orgId}`. On those routes:

- an organization-restricted token only works for that organization
- a league-restricted token only works on routes for that league, so organization-level endpoints such as listing members or leagues reject it

### Endpoints that don't accept PATs

These endpoints accept only a signed-in session:

- `GET /api/v3/me`
- `GET /api/v3/me/badges`
- `GET /api/v3/me/tokens`
- `POST /api/v3/me/tokens`
- `DELETE /api/v3/me/tokens/{tokenId}`
- `GET /api/v3/invites/{code}`
- `POST /api/v3/invites/{code}/join`
- `POST /api/v3/organizations`

As a result, a PAT can't create or revoke tokens, accept invites, or create organizations on your behalf.

## Security expectations

Non-admin users can't:

- read data from a league they haven't joined
- write into a league they haven't joined
- cross organization boundaries

A PAT can't do anything its owner couldn't do with a session, and it can't leave the organization or league it's restricted to. Invite lookups and redemptions are limited to 10 attempts per minute per user, which makes guessing invite codes impractical.

For more on how the API is structured, see [API design](/reference/api-design/).
