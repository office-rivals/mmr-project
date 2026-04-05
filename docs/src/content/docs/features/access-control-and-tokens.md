---
title: Access Control and Tokens
description: Understand roles, tenant boundaries, and PAT behavior.
---

## Access Model

Office Rivals enforces access at both the organization and league layers.

- organization membership grants tenant access
- league membership grants regular-user access to league-scoped resources
- moderator and owner roles are organization-scoped

In other words:

- regular members are league-bound for league data
- moderators and owners are org-scoped for administration and oversight

## Personal Access Tokens

PATs are intended for scoped automation.

Current design points:

- PATs are tenant-scoped
- PATs currently support only the `write` scope
- unsupported scopes are rejected
- selected endpoints are intentionally JWT-only
- request-time authorization still honors org and league boundaries

## PAT Scope And Boundaries

PATs can be created with:

- no tenant restriction
- an organization restriction
- an organization plus league restriction

The token carries those bounds into request-time authorization.

## JWT-Only Endpoints

Some endpoints intentionally reject PAT authentication. Today that includes:

- `GET /api/v3/me`
- `GET /api/v3/me/tokens`
- `POST /api/v3/me/tokens`
- `DELETE /api/v3/me/tokens/{tokenId}`
- `GET /api/v3/invites/{code}`
- `POST /api/v3/invites/{code}/join`

## Security Expectations

Non-admin users should not be able to:

- read another league they have not joined
- write into another league they have not joined
- cross organization boundaries

PATs should not be able to escape their tenant bounds either.

## Implementation References

For deeper architectural notes, see [API Design](/reference/api-design/).
