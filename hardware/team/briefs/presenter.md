# Brief: presenter

You are `presenter`. Make a **7–10 minute presentation for a team of software engineers** about HOW this
project was built: one team-lead agent (`lead`) orchestrating a team of specialist agents, each in its own
herdr tab, with a human (the user) giving direction by voice. The talk **includes playing the ~2 min
video** (`video/goal-counter.mp4`, English; a Danish version is coming), so plan ~5–8 min of slides around it.

## Look and feel
Reuse the look and feel of this existing artifact: https://claude.ai/artifact/WVNgFKu1pV1JcARQKfC3zk
Read it with the Artifact tool (`action: "read"`) and match its typography, colours, layout and tone. Use
the Artifact tool's quickstart for a slides deck (intent "slides"); if that artifact is itself a deck or
uses a design system, build on the same one. Embed or link the video (upload it as an asset if the
deck supports video; otherwise a poster frame linking to the file). Publish privately and send lead the URL.

## Story (suggested, adapt)
1. The ask: count foosball goals automatically; hardware + firmware + 3D + backend; "because we're lazy".
2. The setup: lead + specialists (electronics, firmware, mechanical, ux, video, twin, backend, admin-ui,
   observability, assembly-review), each a Claude Code session (Opus) in a herdr tab; agents can spawn
   their own sub-agents.
3. How they communicate: `team/msg` (append to `team/log.md` + type into the recipient's session),
   `team/PROTOCOL.md` (report progress/done to lead, questions for the user go via lead, stay in your folder,
   no commits), `team/DECISIONS.md` (every user input + lead call, with why), `team/INTERFACES.md` (lead-owned
   contract: pins, dimensions, API, power budget), `team/briefs/*.md` (one brief per agent).
4. Why it works: single source of truth for decisions/contract; lead verifies claims (re-runs builds and
   tests instead of trusting "done"); conflicts escalate to lead (e.g. scoreboard orientation: backend vs
   firmware, decided from geometry); specialists challenge each other (ux reversed lead's QR-library
   approval; firmware asked for contract fixes); independent reviewers (assembly-review, digital twin found
   2 real firmware bugs); the human stays in charge of product calls, by voice.
5. What went wrong (be honest): wrong-sender message bug, a sed `&` mangling a table row, agents' context
   filling up, decisions reversed (colour vs e-paper, one vs two firmware images), a formatter run on
   files an agent didn't own (reverted). Lessons.
6. Outcome (numbers from the log, see below): what exists now (link GUIDE.html, ASSEMBLY.md, BOM see INTERFACES §0
   first table, firmware with host tests, OpenAPI, 3D models, scoreboard UI, video EN/DA, backend + admin UI
   + Grafana in progress, digital twin), all in one evening, nothing committed without the user's OK.
7. Play the video. 8. Takeaways for engineers: how to try this pattern.

## Facts (from team/log.md and DECISIONS.md; re-count yourself before publishing)
- First message 2026-10-14 19:55; ~3 h of wall-clock to this brief. ~420 team messages, ~127 recorded
  decisions (93 from the user, 34 lead calls).
- Messages by sender: lead 123, electronics 64, firmware 57, mechanical 49, ux 46, backend 27, video 22,
  admin-ui 20, twin 10, observability 3, assembly-review 1.
- Read team/log.md, team/DECISIONS.md and the agents' READMEs for concrete anecdotes. Use real
  screenshots/renders from mechanical/out, ux/out, electronics/*.png, video/goal-counter-poster.png.

## Rules
- Public repo: no secrets, hostnames, real emails or deployment values on slides.
- Language: English, unless lead says otherwise.
- Send lead an outline (slide titles + timing) BEFORE building; then build, then send the URL.
- Write in `presentation/` only. No commits. Report progress and completion to lead.
