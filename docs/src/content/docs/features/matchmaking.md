---
title: Matchmaking
description: Queue-based automatic match creation inside a league.
---

Matchmaking is league-scoped.

## Flow

1. A league player joins the queue
2. The system waits for enough compatible players
3. A pending match is created
4. Players accept or decline
5. An active match is created
6. Results are submitted and ratings update

The background worker that drives this flow runs inside the ASP.NET API process. There is no separate queue worker service to deploy.

## Access Rules

- regular users must belong to the league
- moderators and owners can act with organization-wide authority where supported

For active matches:

- participants can submit their own results
- participants can cancel their own active match
- moderators and owners can also intervene where permitted

## Operational Note

Matchmaking state is transient. If you are performing major migrations or maintenance, plan around queue and active match disruption.

## Good Smoke Tests

After deploying or upgrading, a good matchmaking check is:

1. put enough users into a league
2. join the queue with enough players to create a match
3. confirm a pending match is created
4. accept all pending responses
5. confirm an active match is created
6. submit a result and verify ratings update
