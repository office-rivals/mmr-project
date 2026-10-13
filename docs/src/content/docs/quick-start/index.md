---
title: Quick start
description: Run MMR Project locally and sign in to the frontend.
---

:::caution[Based on the beta]
These docs describe the beta frontend in `frontend-beta/`, the React 19 and TanStack Start rewrite. The SvelteKit app in `frontend/` still runs alongside it and isn't covered here.
:::

This is the shortest path to a local, signed-in instance. The .NET Aspire AppHost runs the backend, and you run the frontend from `frontend-beta/` next to it.

## Prerequisites

- .NET 10 SDK
- Node.js 24 (the version in the repository's `.nvmrc`)
- Go 1.26 or later (the version in `mmr-api/go.mod`)
- Docker, for PostgreSQL
- A Clerk application. A free development instance is enough.

You don't need a separate Aspire workload or CLI; the AppHost restores its packages from NuGet.

## 1. Prepare Clerk

Create an application at [clerk.com](https://clerk.com). From **API Keys** in the Clerk Dashboard, note:

- the publishable key (`pk_test_...`)
- the secret key (`sk_test_...`)
- the issuer URL (for example `https://your-app.clerk.accounts.dev`)

The API reads the user's email address from the session token, and Clerk's default session token doesn't include it. Under **Sessions → Customize session token**, add:

```json
{
  "email": "{{user.primary_email_address}}"
}
```

## 2. Start the backend

Store the Clerk values as AppHost user-secrets:

```bash
cd local-dev/MMRProject.AppHost
dotnet user-secrets set "Parameters:clerk-publishable-key" "pk_test_..."
dotnet user-secrets set "Parameters:clerk-secret-key" "sk_test_..."
dotnet user-secrets set "Parameters:clerk-issuer" "https://your-app.clerk.accounts.dev"
```

The API uses the issuer. The two keys are for the SvelteKit app in `frontend/`, which the AppHost also starts.

From the repository root, start the stack:

```bash
dotnet run --project local-dev/MMRProject.AppHost
```

The AppHost starts PostgreSQL, the MMR API, the API and the SvelteKit app, and prints the URL of the Aspire dashboard. The API applies database migrations on startup. The dashboard lists each service's address; you need the `api` one next.

## 3. Run the frontend

In a second terminal:

```bash
cd frontend-beta
cp .env.example .env
```

Edit `.env`:

- `API_BASE_PATH`: the `api` URL from the dashboard. The example value, `http://localhost:8081`, is the port in the API's `http` launch profile, which the AppHost uses.
- `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: your Clerk keys.

Keep `CLERK_SIGN_IN_URL=/login`, `CLERK_SIGN_UP_URL=/sign-up` and `TRUST_PROXY=false` as they are, and leave `APP_ORIGIN` and `CLERK_AUTHORIZED_PARTIES` unset.

Then install and start the dev server:

```bash
npm ci
npm run dev
```

The frontend runs on `http://localhost:5173`. The dev server exits instead of picking another port if 5173 is taken.

## 4. Create your first organization

Open `http://localhost:5173` and sign up. Until you belong to an organization, the home page asks you to join one with an invite code.

The app has no screen for creating an organization yet, so create it through the API. In the browser's developer console on the frontend, get a Clerk token:

```js
await window.Clerk.session.getToken();
```

Then call the API with it:

```bash
curl -X POST "http://localhost:8081/api/v3/organizations" \
  -H "Authorization: Bearer <clerk_token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Local Organization", "slug": "local-org" }'
```

You become the organization's owner. Some slugs are reserved because they clash with app routes, for example `admin`, `api`, `join` and `settings`.

Reload the frontend, then:

1. Create a league at `/admin/<org-slug>/leagues`.
2. Create a season for it on the league's **Seasons** admin page. Matches can't be recorded until the league has an active season.
3. Invite people from `/admin/<org-slug>/members`, by email or with an invite link.
4. Join the league from the organization page, `/<org-slug>`, and start submitting matches or queueing for matchmaking.

## Good first checks

- `http://localhost:8081/swagger` shows the API's Swagger UI.
- `curl -i http://localhost:8081/api/v3/me` returns `401 Unauthorized`, not a server error.
- `curl -i http://localhost:8081/ready` returns `200` once the API can reach PostgreSQL.
- Opening `http://localhost:5173` while signed out redirects to `/login`.
- `GET /api/v3/me` with your Clerk token returns your user. A `400` with `Email claim is required` means the session token is missing the `email` claim from step 1.

To run the stack on your own server, continue to [Self-hosting](/self-hosting/). For more on the AppHost, see [Local development](/reference/local-development/).
