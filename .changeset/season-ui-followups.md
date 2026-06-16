---
"frontend": patch
---

Hide the "Report match" affordance on a league with no active season (e.g. a
league whose only seasons are not yet started), and reuse the shared
`selectCurrentSeason` helper in the admin seasons page so current-season
selection has a single, order-independent definition.
