---
title: Authentication
description: Configure Clerk sign-in for the frontend and JWT validation in the API.
---

MMR Project uses [Clerk](https://clerk.com) for sign-in:

- the frontend shows Clerk's sign-in and sign-up components at `/login` and `/sign-up`, and sends signed-out visitors to `/login`
- the frontend's server calls the API with the user's Clerk session token
- the API validates that token against your Clerk issuer

## What you need from Clerk

Take these from one Clerk application, under **API Keys** in the Clerk Dashboard:

- the publishable key
- the secret key
- the issuer URL, for example `https://your-app.clerk.accounts.dev`

Use the same application for the frontend and the API.

### Add the email claim

The API identifies users by the token's subject and requires an `email` claim. Clerk's default session token doesn't include one. Under **Sessions → Customize session token**, add:

```json
{
  "email": "{{user.primary_email_address}}"
}
```

Without it, the API answers `GET /api/v3/me` with `400` and `Email claim is required`, and the frontend shows a signed-in user with no organizations.

## Frontend configuration

```bash
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_SIGN_IN_URL=/login
CLERK_SIGN_UP_URL=/sign-up
```

All four are read at runtime, so you don't need credentials to build the image. Signing in or up returns the user to `/`, and signing out returns them to `/login`.

### Behind a public hostname

When the frontend runs behind a TLS-terminating proxy, also set:

```bash
APP_ORIGIN=https://app.example.com
CLERK_AUTHORIZED_PARTIES=https://app.example.com
TRUST_PROXY=false
```

- `APP_ORIGIN` is the public HTTPS origin. The frontend uses it for Clerk and form origin checks instead of trusting the request's host headers.
- `CLERK_AUTHORIZED_PARTIES` lists the origins allowed to mint session tokens. If one Clerk instance serves several of your origins, you may need to list each of them.
- `TRUST_PROXY` stays `false` when `APP_ORIGIN` is set. See [Environment variables](/configuration/environment-variables/) for the other values.

Leave `APP_ORIGIN` and `CLERK_AUTHORIZED_PARTIES` unset in local development.

## API configuration

```bash
Authorization__Issuer=https://your-app.clerk.accounts.dev
```

The API checks the token's issuer, signature and expiry, but not its audience. It fetches Clerk's signing keys from the issuer URL, so it needs outbound HTTPS access to Clerk.

If `Authorization__Issuer` is missing, the API still starts, but requests fail with a server error and the log shows `Missing Authorization:Issuer configuration`.

For local development, the Aspire AppHost takes the issuer from its `clerk-issuer` parameter; see the [Quick start](/quick-start/).

## Verification

After configuring Clerk, check that:

1. signed-out visits to the frontend redirect to `/login`
2. signing in returns you to the app
3. `GET /api/v3/me` without a token returns `401 Unauthorized`, not a server error
4. `GET /api/v3/me` with your Clerk token returns your user
5. the API logs no `Missing Authorization:Issuer configuration` errors

## Personal access tokens

The API also accepts personal access tokens for scripts and integrations. They supplement Clerk sign-in rather than replace it: you create them while signed in, and some endpoints refuse them. See [Access control and tokens](/features/access-control-and-tokens/).

## Limitation

The codebase has no identity provider other than Clerk. Self-hosting without Clerk would mean replacing the frontend's Clerk integration and the API's issuer validation.
