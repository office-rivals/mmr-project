# Changelog

## 0.2.1

- Fix leaderboard sparklines staying blank after navigating away and back.

## 0.2.0

- Run the frontend-beta container on Node 26 (`node:26-bookworm-slim`) instead of Node 24.
- chore(deps): bump the tanstack-query group across 1 directory with 2 updates
- chore(deps): bump @tanstack/react-start from 1.168.59 to 1.168.60 in /frontend-beta
- chore(deps): bump @tanstack/react-router from 1.170.40 to 1.170.41 in /frontend-beta
- chore(deps-dev): bump vite from 8.3.1 to 8.3.3 in /frontend-beta
- chore(deps-dev): bump shadcn from 4.21.0 to 4.21.3 in /frontend-beta
- chore(deps-dev): bump pixelmatch from 7.2.0 to 8.0.0 in /frontend-beta
- chore(deps): bump @carbon/charts-react from 1.27.20 to 1.27.21 in /frontend-beta
- chore(deps-dev): bump dotenv from 18.0.4 to 18.0.6 in /frontend-beta
- Let members claim the player their matches were recorded under from the organization page, and follow the request until a moderator decides it.
- Redesign the beta frontend with a desktop sidebar, a live matchmaking bar, and new layouts for home, leaderboard, matches, submit, matchmaking, random teams and player profiles. Add dedicated leaderboard and matches pages, with Form and This week sorts, teammate and opponent filters, and a rematch shortcut on submit.

## 0.1.1

- chore(deps): bump seroval and solid-js in /frontend-beta
- chore(deps-dev): bump @modelcontextprotocol/sdk from 1.30.1 to 1.32.1 in /frontend-beta
- chore(deps): bump @clerk/tanstack-react-start from 1.6.1 to 1.7.1 in /frontend-beta
- chore(deps): bump lucide-react from 1.48.0 to 1.55.0 in /frontend-beta

## 0.1.0

- Add the React beta frontend with shared Clerk sign-in and the existing organization, league, match, and admin workflows. Ship a standalone container with consistent date rendering across timezones and `/health`, `APP_ORIGIN`, and `CLERK_AUTHORIZED_PARTIES` configuration.
