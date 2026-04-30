---
"mmr-api": major
---

Align mmr-api with the v3 release. The release script enforces a shared
major across frontend, api, and mmr-api; without this bump the release
PR job fails because frontend and api are moving to 1.0.0 while mmr-api
would otherwise stay on 0.x. No behaviour changes in mmr-api itself.
