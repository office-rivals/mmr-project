# SCRIPT — foosball goal counters: a review guide (PR walkthrough)

**Voice:** George (`bm_george`, Kokoro, local), speed 1.0. Calm, clear, a senior colleague walking a reviewer through.
**Audience:** reviewers of the four planned pull requests (no PR exists yet: built from the working tree).
**Facts:** every claim is from the working tree (paths in `tools/excerpts.py`) or INTERFACES §0 (test counts, cited).
Numbers are spelled as spoken; captions show digits. Text in `{braces}` is a sync point, not spoken.
Public repo: placeholder data only (Example Org, /acme, Table 1–3, fb-0123456789ab…), no names or hosts.

---

## Line 1 — Title (s1)
    {title}This is a review guide for the foosball goal counters: what the change adds, how to review it, and where to start reading.

## Line 2 — Four PRs (s1)
    {prs}Nothing is merged yet. The work splits into four pull requests: the API, the beta frontend and its docs, the hardware folder, and observability.

## Line 3 — Beam to API (s2)
    {beam}A ball breaks an infrared beam in the goal's drawer. {fw}The counter saves the goal, beeps, {post}and posts it to the API.

## Line 4 — API to phone (s2)
    {db}The API stores the goal, bumps the table's version, {notify}and wakes every phone that is waiting on that table.

## Line 5 — Phone (s2)
    {phone}The phone shows the new score, usually within a second of the goal.

## Line 6 — Undo (s2)
    {undo}Undo comes from one place only: {devundo}the counter's own button, for its own goal, within ten seconds.

## Line 7 — Device auth (s3)
    {auth}Pull request one is the API. Devices sign in with their own scheme. {enrol}An unknown device that holds the organisation's enrolment token registers itself, unclaimed. {verify}After that, only its own secret counts, compared in constant time.

## Line 8 — Device API (s3)
    {api}The device endpoints live under slash api slash v three slash hardware. They stay out of Swagger: their contract is the firmware's OpenAPI file.

## Line 9 — Goal codes (s3)
    {codes}A goal event returns two oh one when it is counted, four oh nine for a retry the server has already seen, and four twenty-two when the event belongs to another device.

## Line 10 — Undo rules (s3)
    {rules}The undo rules sit in one place, inside the table lock. A retry is deduplicated first. Then come the refusals: not yours, game closed, already undone, or too late. Each is a four twenty-two with a code.

## Line 11 — Long-poll (s3)
    {live}The live view is a long-poll. Send the version you have. If the table has changed, you get it at once. If not, the request waits for the next change.

## Line 12 — One path (s3)
    {mutate}Every change to a table takes one path: lock the row, apply the change, bump the version, commit, then notify. {limit}One limit to know: waiters also re-check the database every two seconds, so several API replicas still work, just a little slower.

## Line 13 — Background (s3)
    {bg}Two small background services save a won game after ten seconds, and close games that have gone quiet.

## Line 14 — Migration (s3)
    {mig}One migration adds eight tables. Two unique indexes matter: a goal event is stored only once, and only one counter can guard each goal.

## Line 42 — League binding (s3)
    {league}Every table now belongs to one league, and so do its devices. {rated}Its games are claimed and rated only in that league: another league gets a four hundred. {move}And a table can change league only when no game is live, or waiting for its players.

## Line 15 — Seed (s3)
    {seed}The seed data gives you two tables, six placeholder devices in every health state, a live game with an undone goal, and a finished game that is waiting for its players.

## Line 16 — API tests (s3)
    {tests}The API suite now has two hundred and ninety-four integration tests. Fifty-seven of them are new hardware tests.

## Line 17 — API start (s3)
    {start}Start with the hardware API document, then the device controller, the authentication handler, and the table match service.

## Line 18 — Live view (s4)
    {live}Pull request two is the beta frontend. The table page becomes the phone's live view: the score, who scored last, and when.

## Line 19 — Polling (s4)
    {hook}The page holds one request at a time, and never repeats a held one. {pulse}A goal makes the scoring column pulse. {undone}An undo shows a short line with the new score.

## Line 20 — Stale screens (s4)
    {actions}New game sends the version the phone saw. A stale screen gets a polite conflict, instead of ending the wrong game.

## Line 21 — Admin (s4)
    {admin}The admin Hardware page sets up tables, their league and team names, claims new devices, {guard}and asks one question per goal counter: whose goalkeeper guards this goal?

## Line 22 — Health (s4)
    {health}Each device shows its health: battery, silence, and the beam's own checks. {banner}The admin overview leads with whatever needs attention.

## Line 23 — Claiming games (s4)
    {claim}A game the table scored can be claimed from the submit page, or from the table's short link. Then it is rated like any other match.

## Line 24 — Frontend tests (s4)
    {tests}There are forty-five new Vitest tests, and a new Playwright spec with seven end-to-end tests for the live view and the admin page. {gap}Please run the beta's end-to-end suite before you approve.

## Line 25 — Frontend start (s4)
    {start}Start with the table page, then live dot T S, then the admin Hardware page and device health.

## Line 26 — Firmware (s5)
    {fw}Pull request three is the hardware folder. The firmware keeps all of its behaviour in a core that also builds and tests on your laptop. The device layer is thin.

## Line 27 — Detector (s5)
    {detect}A goal is a beam that stays blocked long enough. It is counted while the ball is still there, then locked out briefly, so one ball counts once.

## Line 28 — Persist (s5)
    {persist}Each goal is saved to flash before anything is sent, and the counter beeps at once. No beep means no goal.

## Line 29 — Device undo (s5)
    {undo}An undo joins the same queue, behind its goal, so the server always sees them in order. {oled}The server's answer comes back to the little screen.

## Line 30 — Twin (s5)
    {twin}The digital twin compiles that same core for your laptop, and runs nineteen scenarios against the mock server or the real API: power cuts, offline queues, stuck balls, and daylight.

## Line 31 — CAD and gate (s5)
    {cad}The sled is parametric CAD with its own self-check. {gate}An assembly gate moves every part along its real path into place: one hundred and thirty-nine checks, all passing.

## Line 32 — Hardware tests (s5)
    {tests}On the firmware side: fifty-five native tests, and thirty contract payloads checked against the OpenAPI file.

## Line 33 — Hardware start (s5)
    {start}Start with the interfaces document, then the firmware read-me and the goal app, then the twin.

## Line 34 — Observability (s6)
    {obs}Pull request four is observability. Aspire gains a Grafana container that you start when you want it. {otlp}Devices send their logs and metrics with OpenTelemetry at the end of each session.

## Line 35 — Dashboards (s6)
    {dash}There are two dashboards, one for the fleet and one per device, {alerts}and eight alert rules, from a low battery to a blocked beam during play.

## Line 36 — Local only (s6)
    {lan}The OTLP port has no authentication, so it stays on localhost unless you opt in. Nothing is deployed.

## Line 41 — Observability start (s6)
    {start}Start with the observability read-me, then the AppHost, the alert rules, and the device's OTLP code.

## Line 37 — Notes (s7)
    {notes}A few things deserve a closer look.

## Line 38 — Scoreboard (s7)
    {sb}The scoreboard is parked, not removed: its endpoints and pages are still in the API and the frontend. {chg}The two changesets also mention it, and they are longer than our usual one or two sentences.

## Line 39 — Fallback (s7)
    {poll}And check the long-poll's two-second fallback under load.

## Line 40 — Close (s8)
    {end}Four pull requests, one feature: goals counted in the drawer, and shown live on the phone. Thanks for reviewing.
