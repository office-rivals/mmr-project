# Changelog

## 0.5.0

- Update React and React DOM to 19.3.1, Base UI to 1.9.0, TanStack Query to 5.104.3 and cn to 0.5.0.
- On phones, tapping a player slot on Submit match now opens a full-screen search, so typing no longer moves the page.
- The matches partner filters and the admin selects (match players, league format, member roles) now open the app's own styled list instead of the browser's, and the four note fields share one styled Textarea.
- Patch security advisories in zod, dompurify, vitest and ip-address, and update TanStack Router and Start in the beta.
- On phones the top and bottom bars are slimmer, and the queue and live-match status collapse into a pill in the top bar that opens on tap. A match found opens the accept dialog in the middle of the screen on any page.
- chore(deps): bump the tanstack-query group in /frontend-beta with 2 updates
- chore(deps-dev): bump shadcn from 4.21.3 to 4.21.4 in /frontend-beta
- chore(deps-dev): bump @types/node from 26.6.3 to 26.6.5 in /frontend-beta
- chore(deps-dev): bump dotenv from 18.0.6 to 18.0.7 in /frontend-beta
- chore(deps-dev): bump hono from 4.13.10 to 4.13.13 in /frontend-beta
- fix(frontend-beta): update dompurify and zod past new advisories
- chore(deps-dev): bump @vitejs/plugin-react from 6.1.1 to 6.1.2 in /frontend-beta
- On an iPhone with the app installed to the home screen, pages now start right below the top bar instead of leaving a gap the height of the status bar.

## 0.4.0

- The show-MMR toggles, the winner and score pickers, and the random-teams mode tabs now use shared Switch, ToggleGroup and Tabs components, so they work with arrow keys. The league page's MMR checkbox is now a switch, like the matches page's.
- On phones, the Teams touch draw now fills the whole screen with smaller finger markers numbered by team, and the matchmaking queue card no longer appears on Teams.

## 0.3.0

- Follow the redesign's labels and layout: "Live now" and "Report result" for live matches, "Looks right?" before submitting, the top of the standings on Home, Profile in the sidebar, and a new rating chart on profiles.
- Keep the bottom bar steady while scrolling on phones.
- Stop the matches page dropping or repeating matches after a refresh, and let a match submit when the browser blocks storage.
- Fix picking a player or season by tapping on iPhones, where the list closed without selecting anything. Both pickers are now built on shadcn's Combobox and Select.
- Draw the home leaderboard sparklines as the same lightweight trend lines as Standings, and start loading fonts sooner.

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
