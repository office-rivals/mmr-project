---
'frontend': patch
---

Fix submit-page preview to render the same player name (short handle / username) as every other match card. The preview now populates both `displayName` and `username` and lets the match-card pick its own priority, so a player previously shown as `Foo Bar` in the preview now correctly matches the `foob` rendered after submit.
