# SCRIPT — foosball goal counter (v2: followed the user's edit of the Danish script)

**Voice:** George (`bm_george`, Kokoro, local: no account, nothing leaves the machine)
**Voice settings:** speed 1.0
**Voice direction:** One narrator, dry and deadpan, a nature-documentary calm about something very silly.
Never sells. The jokes land by understatement plus a beat of silence after them.

English only since 2026-10-18 (user): the Danish script, narration and renders are archived outside the repo.
Text in `{braces}` marks a sync point (the visual or on-screen line lands 0.2–0.4 s before that word); it isn't
spoken. The VO carries the story and never reads an on-screen line word for word. Numbers are spelled the way they
should be said. The v1 render stays local as `video/goal-counter-v1.mp4` (gitignored).

---

## Line 1 — Today (s1, counter)
**On screen:** —

    This is how we keep score today: one bead per goal, pushed by hand…

## Line 2 — Squint (s1, magnifier)
**On screen:** "Was that 5 or 6?"

    {cap}After the match: a brief forensic investigation.

## Line 3 — Typing (s1, score card)
**On screen:** "Typed in from memory."

    {cap}Then someone types the result into the M M R app. {type}With great confidence. {wrong}And probably wrong.

## Line 4 — Lazier (s1, card slumps)
**On screen:** "There must be a lazier way."

    {cap}We're engineers. We can easily be lazier than this.

## Line 5 — The insert (s2, diagram + first ball)
**On screen:** "Ball blocks the beam: goal."

    So: a small box in each goal's ball drawer. {roll}Every single ball rolls through an {cap}infrared beam.

## Line 6 — Ball height (s2, front view)
**On screen:** —

    The beam sits at the ball's centre. Even the saddest roll can't sneak past.

## Line 7 — Second ball (s2)
**On screen:** "The ball does the bookkeeping."

    {cap}Nobody has to watch. Nobody has to argue.

## Line 8 — Board (s3)
**On screen:** —

    Inside sits a tiny E S P thirty-two that counts the balls. No A I involved.

## Line 9 — Motion sensor (s3)
**On screen:** —

    A motion sensor wakes it when the table moves.

## Line 10 — Wires (s3)
**On screen:** "No custom PCB. We're lazy."

    {cap}Plus an infrared LED, a light sensor, and three AA batteries.

## Line 11 — The sled (s4, exploded → in the drawer)
**On screen:** —

    It all lives in a 3D-printed sled, in two halves. {in}They go in where the balls come out.

## Line 12 — Slanted wall (s4, from above)
**On screen:** —

    A slanted wall {roll}sends every ball past the beam.

## Line 13 — Chirp (s4, the front face)
**On screen:** "No chirp, no goal."

    {chirp}Every goal gets a little chirp. {cap}No chirp? Then it didn't count.

## Line 24 — Undo button (s4, the front face)
**On screen:** "Hold to undo."
**Facts:** hold 1 s; only this counter's own goal, within `undo_window_s` (default 10 s); later fixes on the phone
(ux/goal-counter-phase1-2026-10-17.md B1–B3).

    {cap}Counted a hand by mistake? Hold the undo button {hold}for a second. {undo}Gone. You get ten seconds. After that, it's your phone's problem.

## Line 14 — Online (s5)
**On screen:** — (labels: GOAL SENSOR, WI-FI, MMR SERVER, MMR APP)

    When the table moves, it wakes and {wifi}joins the Wi-Fi. {goal}Score, and the server knows instantly.

## Line 15 — Server (s5, the app counts up)
**On screen:** —

    {tick}The server does the bookkeeping. The device itself doesn't even know the score.

## Line 16 — No gossip (s5, one table, two goals)
**On screen:** "Goal counters don't gossip."

    {cap}Even the two goal counters on the same table never talk to each other. Only to the server.

## Line 17 — Batteries (s5)
**On screen:** "Pull the batteries: nothing lost."

    {cap}Someone yanks the batteries mid-match? {saved}Every goal is saved before it's {sent}sent.

## Line 18 — Battery (s6)
**On screen:** —
**Number:** goal-counter battery life, copied on purpose from INTERFACES §0 (≈ 1.7–3.4 months EST, review 2, 2026-10-18); spoken as "about one and a half to three and a half" (lead: never round the low end up).

    Three AA batteries. By our estimate, a set lasts about one and a half to three and a half months.

## Line 19 — Sleep (s6, z z z)
**On screen:** "It sleeps more than we do."

    {cap}Only the motion sensor isn't allowed to sleep.

## Line 20 — The app (s7)
**On screen:** "The app suggests the score."

    After the match, the app already knows the score. {cap}You just tap.

## Line 21 — Was it necessary (s7)
**On screen:** —

    Was any of this strictly necessary? Nooope.

## Line 22 — Lazy (s7)
**On screen:** "Why? Because we're lazy."

    {cap}Because we're lazy.

## Line 23 — Can (s7)
**On screen:** "And because we can."

    {cap}And because we can.
