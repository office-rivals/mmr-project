---
"api": patch
---

Rate limit invite-code lookups and joins per user (10/minute), so codes can't
be brute-force enumerated even though the lookup endpoint reveals validity.
Rejected requests return 429 with a Retry-After header.
