# Coach audit

## 2026-10-15 19:30 — first audit

Scope: all of `team/log.md` (1,269 messages, 10-14 19:55 → 10-15 19:26), DECISIONS, INTERFACES, briefs, the
helper scripts, and a cross-check of numbers across the deliverables. Times below are log timestamps.

**Headline.** The team is fast and responsive. Lead's median reply is 2–13 min for most agents, and every `QUESTION:`
since rule 9 (10:51) was answered within 0–16 min. Peers catch each other's drift, and twin and assembly-review
act as real gates. Messages are not getting lost. **Decisions are**: a decision lands in one message and one
DECISIONS line, and the 5–10 files that repeat the old value are never updated. Most of the waste comes from
that, from designing before measuring, and from decisions that were framed as final and then reversed.

### Findings, ranked by impact

**1. Decisions don't reach the files and agents that hold the old value (DRIFT, high).**
- `INTERFACES.md` was last saved at 08:38. About 80 DECISIONS lines came after it. It is wrong on: auth (`:123`
  "Bearer token", real: `Authorization: Device` + headers in `openapi.yaml`), scoreboard battery (`:150`
  "~190 days"), sound (`:154` "small buzzer, 3 events"), and the drawer and insert (`:100-110`). It has no
  scoreboard pin map. ux flagged the Sound row at 15:15, with no fix logged.
- Scoreboard battery life has 6 values in 9 places. In ASSEMBLY.md alone: `:429` "about 6 months" and `:540`
  "≈ 4.4". The goal counter is at `:390` "3–4 months" (current ~5). DECISIONS:236 still says 4.6; electronics
  corrected it to 4.4 at 15:29.
- **Costly physical error:** `ASSEMBLY.md:737` tells the builder to write `…/submit?table=<tableId>` onto the
  NFC sticker. The decided link is the permanent `/t/<code>` (DECISIONS:204). A sticker is written once.
- Ball diameter: 35 mm is still in GUIDE.html:120, electronics/README:39, dimensions:78 and mechanical/README:59.
  Two briefs say 30 mm. Current: 31–36 mm (DECISIONS:170).
- Corrections and reversals go to one agent:
  - The 14:11 "listen interval 1" reached electronics, firmware and ux docs as "≈ 3 months". Lead's 14:26
    "NOT approved" went to firmware only, and reverts followed at 14:52.
  - The MX-switch answer (11:39, to ux) never reached mechanical, which still listed it as open at 12:18.
  - analytics' "TS4 needs 12 weeks" (14:51, to lead) never reached admin-ui, which shipped a default of 8.
- Lead's 19:20 v5 calls (3 mm PC window, panel USB-C, mirror deferred) are not in DECISIONS, which still says
  "~2 mm" (`:246`).
- **Suggest:** every DECISIONS entry ends with `→ update: <file> (<owner>)`. Lead sends the decision to everyone
  in the original thread (or `all`), and each owner replies `updated: <file>`. A reversal or caveat goes to
  the same recipients as the original. Testable: the next 10 DECISIONS entries all carry `→ update:`, and a
  grep for the old value finds nothing.

**2. The contract is frozen because only lead can edit it, and numbers are copied rather than referenced
(BOTTLENECK + DRIFT, high).**
- Rule 3 makes INTERFACES lead-only, and lead is the busiest session (it handles ~35% of all messages), so the
  file froze for 11 h. Agents
  report stale rows; mechanical at 08:17/08:18, firmware at 08:29 and ux at 15:15 got no ack.
- In practice the live contracts are `firmware/openapi.yaml` (with `check_openapi.py`) and
  `api/docs/hardware-api.md`. They agree with each other, and that is why the device API has had the least
  drift. Rule 3 doesn't say so.
- `GUIDE.html` has no owner in the roster (lead edits it). Electronics flagged it as stale at 09:11 and 15:33.
- Costs: `bom.md` has 5 different totals with no scope stated. GUIDE, slides, premium-sound.md and the
  presenter brief each show an older one.
- **Suggest:** (a) owners edit their own INTERFACES rows, and lead reviews the diff instead of typing it.
  (b) One home per headline number (battery, cost, ball size, test counts), e.g. an INTERFACES §0 "numbers"
  table with an owner per row. Other docs write `≈ 4.4 months (INTERFACES §0)` instead of a copy.
  (c) Name an owner for GUIDE.html. (d) Amend rule 3 to name openapi.yaml and hardware-api.md as the API
  contracts.

**3. Geometry is designed before the physical facts are measured (WASTE, high).**
- Insert v3: ~30 min of work by 3 agents, stopped at 08:28 ("does NOT fit"). Mechanical (08:17) and
  assembly-review (08:26) had asked for the measurements first.
- The drawer sled and roll test were redone ~4× as photo estimates were overturned: the "left block" and
  "trim strip" (14:02, gone at 14:09), the width (14:35), the shelf at 95 not ~102 (19:13).
- Scoreboard v4 was gated twice through the day at 147 D before the shelf envelope was checked (19:00), so v5 is
  a full re-layout.
- **Suggest:** before a geometry round, the owner lists the 2–3 measurements that could invalidate it, and lead
  asks the user for them in one batch. Values not yet measured are marked `EST` in INTERFACES, and a design
  that rests on an `EST` value is labelled draft. Testable: no gated design is invalidated by a measurement
  that was already on the list.

**4. Decisions were framed as final, then reversed within minutes (WASTE, medium-high).**
- 21:21 → 21:35, colour scoreboard: ~4 agents rebuilt and then reverted.
- 22:19 → 22:27: one firmware image vs two, and custom logs vs OpenTelemetry.
- 10:28–10:32: the 65° angle, and the drill hole.
- 09:15–10:18: polish on the right wing before the user had seen the layout.
- These came from the user changing their mind, which is fine. The gap is that agents treated each message as
  "go".
- **Suggest:** lead uses `TENTATIVE:` (estimate impact only, don't build) until the user confirms, and
  `DECISION:` once it is in DECISIONS. For look-and-feel, lead shows the user 2–3 options before anyone edits
  docs.

**5. Requests that need lead to act are buried in "done" reports (NOT-HEARD, medium).**
- presenter's republish request (10:00, again at 10:52): no reply by 11:06.
- backend's CardUidKey question (09:06), inside a long report: answered at 10:52, only after a REMINDER.
- video's script question (09:38): 69 min. This was before rule 9, and it is what prompted rule 9.
- The full-width beam / TSAL6100 recommendation (mechanical and electronics, 14:14 and 14:56) has had no
  decision for 5 h. Each agent waits on the other, and firmware's latency numbers assume the beam at 240.
- **Suggest:** extend rule 9's prefixes with `ACTION:` (lead must do something, e.g. publish or update GUIDE)
  and `DECIDE:` (a recommendation that needs a choice). `team/unanswered --open` already keys off prefixes, so
  only the regex changes.

**6. The frontend has never run (STUCK, medium; acknowledged, outside the team's control).**
- admin-ui has been waiting on Clerk keys since 22:42 (~21 h). Every report since then ends "Not run in the app"
  (latest 15:02). The repo's CLAUDE.md requires an e2e run before shipping.
- Lead's handling is right: the user owns the keys, and admin-ui prepared a manual test script. The risk is the
  growing untested backlog.
- **Suggest:** lead keeps one standing "waiting on the user" list (Clerk keys, measurements, beam decision) and
  puts it at the top of each user check-in.

**7. Tooling: small script fixes (WASTE, low; cheap).**
- 10:26: a shell quoting slip removed two field names from a firmware → twin message; a correction followed at
  3101. Backticks and `$` in `team/msg "<…>"` get expanded.
- 20:46: lead's message was logged as `electronics -> electronics`.
- `unanswered` and `await-reply` count *any* later lead message to that agent as the answer. An unrelated
  "thanks" closes a question, which is why the latency figures are optimistic.
- **Suggest (lead to edit `team/`):**
  - `team/msg` reads the body from stdin when no message argument is given, so agents can use
    `team/msg x <<'EOF'` and avoid shell expansion.
  - `team/msg` rejects from == to and `AGENT_NAME` unset.
  - Lead's answers start `RE <HH:MM>:` naming the question's time, and `unanswered` treats only those as
    answers.

**8. Message size and fan-out (WASTE, low-medium).**
- 72 messages are over 1,500 characters: mechanical 19, electronics 13, video 12, firmware 9, backend 9.
- The same text went to 3–5 agents verbatim: sound_volume at 08:38, twin at 14:58, admin-ui at 14:27/14:29.
- Fan-out creates parallel deciders. The quick-tap finding at 10:53–10:54 gave firmware two different specs in
  one minute.
- **Suggest:** keep messages to ≤ 5 lines plus a file path. A finding sent to several agents names one decider
  ("decider: ux"), and only that agent sends the follow-up.

**9. Shared resources have no lock (WASTE, low).**
- 23:15–23:22: backend reseeded the twin stack (:8091) during twin's run, and twin chased the 401s.
- 08:46: a half-finished edit in the shared lib broke the twin build.
- **Suggest:** announce `TAKING :8091 until done` / `RELEASED :8091`, and keep shared code building between
  edits.

**10. Stale briefs (DRIFT, low).**
- mechanical (150×80, Ø30, screws); electronics and firmware ("one goal device"); ux (points to the missing
  `firmware/scoreboard-mockups.md`); presenter ("what went wrong", dropped by DECISIONS:151); observability (LAN
  endpoint); twin ("backend not built yet").
- **Suggest:** when a decision reverses a brief's premise, lead adds a one-line `Superseded:` note to it.

### Voice / fairness
I found no agent overruled without a reason. Lead's overrules cite DECISIONS: USB-C on the face at 08:34, the
bare-wood floor at 08:33. Agents pushed back with reasons and were heard: mechanical's fixed bridge (14:56), ux's
rejected options (13:45), analytics' review of backend (14:51 → fixed 15:02). Quieter agents (observability,
presenter, analytics) got slower replies (median 57 min for analytics), but nothing was dropped.

### Keep doing
- Lead refused to let a 0:1 one-off go unexplained (23:14). That found a real silent goal drop, and 771 stress
  runs later there were 0 lost goals.
- assembly-review's `check.py` gate, run by mechanical before every hand-back.
- Escalations that carry a default ("until you decide I keep mine").
- Blameless incident notes (mechanical's file corruption, 23:10).
- Honest "not run on hardware / in the app" lines.
- The twin reads `ui_text.h` instead of copying strings (19:20). That is the "reference, don't copy" fix in
  miniature.
- mechanical's 19:26 QUESTION: options, a pick, and work continuing on everything else.

### Open right now (for lead)
- `ASSEMBLY.md:737` has the wrong NFC URL (electronics).
- INTERFACES needs a sweep: auth, scoreboard §8, the pin map.
- DECISIONS:236 should be 4.4 months, and the 19:20 v5 calls need adding.
- The full-width beam / TSAL6100 decision.
- analytics' 8/12-week windows need to reach admin-ui.
- Phone toast: the 19:26 decision moves it back to "left side". ux is to tell firmware, and twin now reads it
  from `ui_text.h`, so it should follow automatically.

Method note: the log was read in four slices by sub-agents and cross-checked by a script (reply latencies,
prefix use, message sizes). Rule 9 started at 10:51, so its absence earlier isn't counted as a finding. Lead
reply latencies above use the "any later lead message" heuristic, so they are lower bounds.

## 2026-10-15 20:35 — re-audit (one hour after rules 3, 10-12)

Method: `coach/reaudit.sh` (the `updated:` replies, an old-value grep, and cost totals diffed against
INTERFACES §0) plus a read of every message from 19:29 to 20:31 (67 messages).

### Adoption: worked
- **Every owner replied `updated:`** (12/12, all between 19:29 and 19:40).
- **Old values are gone.** The NFC sticker step is fixed: ASSEMBLY S6 now says to use `/t/<code>`, warns
  against `submit?table=` and adds a tap-test. Battery, ball size and auth are fixed in INTERFACES and the docs.
  The grep's remaining hits are history notes (`scoreboard-display-options.md` is labelled, `REVIEW.md:300` is a
  gate log), API rows that are correct (`hardware-api.md:119-121`, the QR claim URL) or false positives (user
  `Bearer` auth in `../docs`). firmware's `~5 -> ~3-4 months` is the fast-RX-on case, which is correct.
- **The prefixes are in use:**
  - backend → firmware ACTION at 19:30 (Bearer row): fixed by 19:33.
  - video DECIDE at 19:30: answered in the same minute.
  - ux named itself the decider for LED5 (20:07).
  - mechanical's and assembly-review's ACTIONs closed S20 in 3 min.
  - `unanswered` now matches `DECIDE`.
- **Rule 10's reversal path worked once.** Lead withdrew the TS4 action and told admin-ui directly (19:30).
  analytics closed my "12-week window" finding: it was a mix-up between TS2 and TS4, and 8 weeks is right.
  I was wrong to call it a missed hand-off.
- **Rule 11 is being followed.** Items are marked EST and "measure first" (S20, the USB extension). mechanical
  lists what to measure on arrival.

### Remaining gaps (ranked)
1. **Copies of §0 go stale when §0 changes.**
   - presenter synced GUIDE and the deck at 19:38 using §0 values older than electronics' 19:31 edit. It then
     reported `bom.md` as the wrong side. Lead caught it at 19:39.
   - GUIDE, the deck and the films are public pages, so they have to *copy* the numbers, not cite them.
   - **Suggest:** one line under the §0 heading: "Copied into GUIDE.html and the deck (presenter) and the films
     (video): whoever changes a row tells them." Copiers re-read §0 right before writing.
2. **Lead's INTERFACES review is a silent queue.**
   - Seven owners edited rows and said "please review": observability §10, backend §11, ux §8, firmware §6/§8,
     mechanical §0/§5/§8, assembly-review and electronics. Lead acknowledged only electronics.
   - Nothing is blocked, but rule 3 doesn't say whether silence means accepted.
   - **Suggest:** lead does one sweep (`git diff team/INTERFACES.md`) and posts one "reviewed: §…" line, or rule 3
     says "no objection within 30 min = accepted".
3. **Messages are getting longer.**
   - 12 of 67 messages (18%) are over 1,500 characters, up from 6% before. mechanical's v5 done report at 20:06
     is 4,455 characters, and electronics' at 20:20 is 2,165.
   - The content is good, but it's a spec in the log.
   - **Suggest:** "done" reports go in the owner's folder (e.g. `mechanical/CHANGES.md`, dated), and the
     message is ≤ 5 lines plus the path.
4. **Briefs are still stale (lead's files).**
   - `briefs/mechanical.md:13-15`: ~150×80 drawer, Ø30 ball.
   - `briefs/ux.md:5`: points to the missing `firmware/scoreboard-mockups.md`; ux flagged it at 19:30.
   - **Suggest:** the one-line `Superseded:` notes from finding 10.
5. **Known and deferred, so no action:**
   - The goal-counter film (EN+DA) still says "about four months" and shows the v3 insert. The deck embeds it.
     Both wait for the sled CAD. video and presenter both track it.
   - The deck's "≈ 4.7 months" at 09:07 is a historical anecdote, so it can stay.

### New in the last hour: good process
- v5 went from CAD to gate to fixes to closed in 26 min (19:58 → 20:07, 66/0). This was peer-to-peer:
  mechanical, assembly-review, electronics and ux each confirmed in their own lane, and lead wasn't needed.
- The window-border fix answered the user's question with a measured cause (a 10.3 vs 3.1 mm inactive border).
  The fix follows ACTIVE_DX/ACTIVE_BOTTOM, so the real panel can be tuned on arrival.
- R keeper: lead set the priority at 20:12, the files were ready at 20:19, and electronics' fit check turned
  into a drop-in cradle by 20:23. Two numbers were corrected in the open: mechanical's 4.5 → 3.9 mm, and
  presenter's "checks" vs "printed".
- The USB-C straight → right-angle change was settled by mechanical and electronics with evidence from the
  gate. They named the decision in `bom.md` S25 and told lead.

**20:45 follow-up.** All four gaps are closed:
- §0 changes now go to presenter and video (rule 3).
- Lead reviewed every INTERFACES row edit, and no objection within 30 min now means accepted.
- Rule 13: reports longer than ~5 lines go into a dated file.
- The mechanical and ux briefs are fixed.

Next: check in the next audit that rule 13 brings the message length back down.
