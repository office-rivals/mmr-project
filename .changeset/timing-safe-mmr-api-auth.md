---
"mmr-api": patch
---

Use `crypto/subtle.ConstantTimeCompare` for admin key validation to prevent timing-based key enumeration, and explicitly reject an empty `ADMIN_SECRET` to make the fail-closed property clear.
