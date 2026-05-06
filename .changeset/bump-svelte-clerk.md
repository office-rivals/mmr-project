---
"frontend": patch
---

Bump svelte-clerk from 0.20.6 to 1.1.5 (Clerk Core 3 alignment). Pulls in
@clerk/backend 3.x and @clerk/shared 4.x. The 1.0.0 breaking change
(removal of `<Protect>`, `<SignedIn>`, `<SignedOut>` in favour of `<Show>`)
does not affect this codebase — none of those components were in use.
