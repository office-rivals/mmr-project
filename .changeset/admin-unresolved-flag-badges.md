---
"frontend": minor
"api": minor
---

Show admins a red badge wherever match flags are waiting to be resolved — the
account menu, the admin nav, and each affected organization and league — backed
by a new `GET /api/v3/me/badges`. The flagged-matches filter now defaults to
Open.
