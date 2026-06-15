---
"api": minor
"frontend": patch
---

Hide not-yet-started seasons from members. `GET .../seasons` now returns only seasons that have already started, and a new moderator/owner-only `GET .../admin/seasons` returns the full list (including upcoming) for admin management. The frontend selects the current season defensively and the admin seasons page uses the new endpoint so upcoming seasons stay visible to admins.
