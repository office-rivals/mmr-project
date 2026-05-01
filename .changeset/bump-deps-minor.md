---
"frontend": patch
"api": patch
"mmr-api": patch
---

Bump frontend, api, and mmr-api dependencies to the latest minor/patch
within their current major. Includes Clerk JS SDK updates that pull in
patches for GHSA-vqx2-fgx2-5wq9 (middleware route protection bypass)
and GHSA-w24r-5266-9c3c (authorization bypass).
