---
title: Authentication
description: Configure Clerk for the frontend and API.
---

Office Rivals currently uses Clerk for authentication.

That means:

- the browser signs in through Clerk
- the frontend validates sessions using `svelte-clerk`
- the API validates JWTs against the configured Clerk issuer

## Required Clerk Values

You need three values from a single Clerk application:

- publishable key
- secret key
- issuer URL

Use the same Clerk app for both the frontend and API.

![Office Rivals sign-in screen](/screenshots/login.png)

_With valid Clerk configuration in place, the local `/login` route renders the real Office Rivals sign-in flow instead of throwing a key-validation error._

## Frontend Configuration

Set these values for the frontend:

```bash
API_BASE_PATH=http://api:8080
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
```

`PUBLIC_CLERK_PUBLISHABLE_KEY` is also passed as a Docker build arg in the example Compose setup because the checked-in frontend Dockerfile injects it during the build.

## Sign-Up Experience

In development mode, the same Clerk application also serves the sign-up flow:

![Office Rivals sign-up screen](/screenshots/signup.png)

This is useful as a smoke test for confirming that:

- the publishable key is valid
- Clerk-hosted pages can load correctly
- the frontend is linked to the intended Clerk application

## API Configuration

Set the Clerk issuer URL on the API:

```bash
Authorization__Issuer=https://your-instance.clerk.accounts.dev
```

If this value is missing, the API will fail to start.

## Verification

After configuring Clerk, verify:

1. the frontend redirects to Clerk for login
2. a successful login returns the user to the app
3. `GET /api/v3/me` returns `401 Unauthorized` when called without a token instead of a server error
4. `GET /api/v3/me` succeeds for a signed-in browser session
4. the API no longer logs `Missing Authorization:Issuer configuration`

## PATs Are Supplemental

Personal access tokens are not a replacement for Clerk login.

Today:

- PATs can only be created by a normal Clerk-authenticated session
- PATs currently support only the `write` scope
- PATs are scoped to an organization or league when requested
- some routes intentionally reject PAT authentication, including:
  - `/api/v3/me`
  - `/api/v3/me/tokens`
  - `/api/v3/invites/{code}`
  - `/api/v3/invites/{code}/join`

## Current Limitation

The current codebase does not ship a non-Clerk auth provider for self-hosting. If you need fully self-hosted identity, you would need to replace the Clerk-dependent frontend and issuer validation pieces.
