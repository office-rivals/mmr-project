---
"frontend": patch
---

Fix the report-match modal on the leaderboard, which always rendered "Failed to load matches. Please try again." Add the missing SvelteKit endpoint at `/api/v3/organizations/[orgId]/leagues/[leagueId]/matches` that was assumed by the v3 modal rewrite.
