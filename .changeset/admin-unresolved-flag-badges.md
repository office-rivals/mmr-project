---
"frontend": minor
"api": minor
---

Surface unresolved match flags to admins with red badges across the nav. A new `GET /api/v3/me/badges` endpoint returns open-flag counts (total plus per-organization and per-league) for the organizations a user administers, so the account/settings control, the Admin menu item, the admin organization list, the org sidebar, the leagues list, and the league sub-nav all show a count when there is something to handle. The frontend fetches it alongside the existing profile load, replacing the previous per-league flag fan-out. The flagged-matches filter now defaults to Open and moves All to the end.
