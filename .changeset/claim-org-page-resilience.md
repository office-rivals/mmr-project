---
"frontend": patch
"api": patch
---

Keep the organization page working when player-claim data can't be loaded, and return no candidates from `GET /api/v3/organizations/{orgId}/members/claimable` to members who can't claim.
