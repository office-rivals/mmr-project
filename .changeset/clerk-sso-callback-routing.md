---
"frontend": patch
---

Actually fix GitHub (and other OAuth) sign-up by mounting Clerk's `<SignIn />` and `<SignUp />` under SvelteKit rest routes (`/login/[...rest]` and `/sign-up/[...rest]`). The earlier fix added a `/sign-up` page but kept `/login` as an exact-match route, so after GitHub OAuth the browser was redirected to `/login/sso-callback` — which 404'd. Clerk's prebuilt components own their own internal sub-routes (`sso-callback`, `factor-one`, `verify`, …); the `signUp.create({ transfer: true })` call that converts a transferable OAuth verification into a real sign-up lives in the `sso-callback` UI, so without that sub-route mounted it never runs and first-time GitHub users stay stuck on `external_account_not_found`. Also wires `signUpUrl="/sign-up"` and `signInUrl="/login"` props explicitly so the link between the two flows doesn't depend on dashboard configuration.
