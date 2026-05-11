---
"frontend": patch
---

Fix GitHub (and other OAuth) sign-up getting stuck on `external_account_not_found`. Adds a `/sign-up` route mounting Clerk's `<SignUp />` component so the prebuilt `<SignIn />` flow can complete the OAuth → sign-up transfer for first-time users. Also allowlists `/sign-up` in the server-side auth guard so the redirect isn't bounced back to `/login`.
