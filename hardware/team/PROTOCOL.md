# Team protocol

Every agent runs in its own herdr tab in this workspace. The user talks only
to **lead**. Everyone else talks to lead and to each other.

## Roster

| Name          | Owns                                                   | Folder         |
|---------------|--------------------------------------------------------|----------------|
| `lead`        | Overall design, interfaces, decisions, user contact    | `team/`        |
| `electronics` | Sensor choice, BOM, schematic, wiring, assembly guide  | `electronics/` |
| `firmware`    | ESP32 firmware: detection, Wi-Fi, REST, config         | `firmware/`    |
| `mechanical`  | 3D-printable insert (ball channel + MCU enclosure)     | `mechanical/`  |
| `video`       | Presentation video (hyperframes skill)                 | `video/`       |
| `ux`          | Scoreboard UI + interaction design, physical UX        | `ux/`          |
| `twin`        | Digital twin: simulated devices for backend testing    | `twin/`        |
| `backend`     | MMR API: device API, tables/devices, unclaimed matches | `../api/`      |
| `admin-ui`    | frontend-beta: device admin + claim/live score         | `../frontend-beta/`, `../docs/` |
| `observability` | OTel/Grafana in AppHost, dashboards + alerts as code | `../local-dev/`, `../observability/` |
| `assembly-review` | Independent review: hardware into printed parts     | `assembly-review/` |
| `presenter`   | Presentation about how this team works                 | `presentation/` |
| `analytics`   | New player/match performance metrics (research + spec) | `analytics/` |
| `coach`       | How the team works: audits communication, suggests process changes | `coach/` |

## Messaging

```sh
AGENT_NAME=<you> ../team/msg <to> "<message>"   # <to>: lead | electronics | firmware | mechanical | video | ux | twin | backend | admin-ui | observability | assembly-review | presenter | analytics | coach | all
```

`team/msg` appends to `team/log.md` (the permanent record) and types the
message into the recipient's session. If delivery fails, the message is still in
the log. When you start a task, skim `team/log.md` for anything addressed to you.

Keep messages short. Put long material in a file and send the path.

## Rules

1. **Report to lead** when you finish a milestone ("progress: …") and when a
   task is finished ("done: …", with the files produced). No silent work.
2. **Questions for the user go to lead**, never directly to the user. Lead
   answers or asks the user; answers land in `team/DECISIONS.md`.
3. **Contracts.** `team/INTERFACES.md` is the contract between disciplines (pins, dimensions, numbers). The
   **owner of a row edits it** (say so in the log) and lead reviews the diff; tell the affected agents. The
   device API contract is `firmware/openapi.yaml` (owner firmware, checked by `check_openapi.py`) plus
   `api/docs/hardware-api.md` (owner backend). Headline numbers (battery life, costs, ball size, test counts)
   live once, in INTERFACES §0 "Numbers", with an owner per row; other docs **cite** it ("≈ 4.4 months, see
   INTERFACES §0") instead of copying. Don't build against a value you changed unilaterally. Lead posts `reviewed: §…` on INTERFACES edits; **no objection from lead within 30 min = accepted**.
4. **Stay in your folder.** Write only in your own folder (plus `team/log.md`
   through `msg`). Read anything. Exception: `electronics` owns the top-level
   `ASSEMBLY.md` (compiled from all three disciplines). Backend-side agents work in the folders
   listed in the roster (outside `hardware/`), following the repo's `CLAUDE.md`.
5. **No git commits, pushes, or PRs.** The user approves commits.
6. **Public repo.** No Wi-Fi credentials, real hostnames, URLs or secrets in
   files. Use placeholders; real values come from a gitignored file.
7. You may spawn your own sub-agents (Agent tool) for parallel work.
8. Install tools without global changes when possible (`uv tool run`, `uvx`,
   project-local venvs). Ask lead before installing anything system-wide (brew).
9. **Never wait silently on lead.** A message that needs an answer from lead starts with
   `QUESTION:` (or `BLOCKED:` if you can't continue without it). Right after sending it, run
   `team/await-reply <you> 10` in the background. If it exits with NO REPLY, re-send the same
   question starting with `REMINDER:` and wait again. Keep working on anything that isn't blocked.
   (Lead checks `team/unanswered --open` and watches the log, but a message typed into a busy
   session can still be lost: the reminder is your guarantee.)
10. **Decisions reach every copy.** Every DECISIONS entry ends with `→ update: <file> (<owner>), …`. Lead sends
    the decision to every owner listed (or `all`), and each owner replies `updated: <file>` when done. A
    reversal or caveat goes to the **same recipients** as the original. Before reporting done, grep for the
    old value.
11. **Measure before geometry.** Before CAD that depends on the physical world, send lead the 2–3
    make-or-break measurements as one batch for the user. Mark any unmeasured value `EST` in docs and models
    until it's measured.
12. **Prefixes.** `QUESTION:`/`BLOCKED:` (rule 9) need an answer; `DECIDE:` asks lead for a decision;
    `ACTION:` asks another agent to change something it owns. Long or quote-heavy messages: pipe them into
    `team/msg <to>` on stdin.
13. **Short messages, long files.** A `done:`/`progress:` report longer than ~5 lines goes into a dated file in your
    folder (e.g. `mechanical/reports/2026-10-15-v5.md`); the message is ≤ 5 lines: the result, the decision
    needed (if any), and the path.
