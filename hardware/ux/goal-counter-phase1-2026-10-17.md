# Phase 1: goal counters + the phone live view (joint proposal, 2026-10-17)

Owner: `ux` (compiles). User decision 2026-10-17 (DECISIONS): phase 1 = goal counters only, score
watched live on the phone; the scoreboard is parked, not dropped. User, later the same day: "The live
scoreboard on the phone makes sense even without the scoreboard device as well." So:

- **Part A, the phone live view,** is a **permanent** feature. It works with or without a scoreboard
  and goes ahead now. admin-ui builds it, backend feeds it.
- **Part B, the undo button + buzzer on the goal counter,** was approved by lead on 2026-10-17, and
  the owners are building it. The undo rule is decided (user via lead): only the counter that counted the goal,
  within `undo_window_s` (default 10 s).

Inputs: admin-ui (draft 2026-10-17), backend (merged into `api/docs/hardware-api.md`: 'Undo button', App API),
electronics (`electronics/goal-counter-button-buzzer-2026-10-17.md`), firmware
(`firmware/goal-counter-phase1-firmware-2026-10-17.md`), mechanical (Part B placement, answered 2026-10-17).

---

## Part A: the phone live view (APPROVED by lead 2026-10-17; admin-ui + backend building)

**It's the existing table page, made phone-first:** `/<org>/<league>/tables/<tableId>`
(`frontend-beta/src/routes/_authed/$orgSlug/$leagueSlug/tables/$tableId.tsx`). No new route.

### A1. Who sees it, and how they get there

- **Signed-in org members** (backend's `Member` policy, as today). The page shows player names, so
  it stays behind sign-in. A phone signs in once and stays signed in.
  - Anonymous score-only view: **no** (lead 2026-10-17).
- **Way in: the table's link `/t/<code>`,** on a **sticker on the table** (QR + NFC, the same
  permanent table code that would go on the scoreboard's NFC tag). Without a board, the sticker goes
  on the end rail's top at the right end, where the board would sit. Signed-out phones go via
  `/login` and come back (exists).
- **Where the sticker leads:** backend's resolver table already sends a *Live* game and a
  *finished linked* game to the live page, and a *finished unlinked* game to the prefilled claim
  page. Keep that rule, with one change: a game that **finished less than 2 minutes ago** opens
  the live page too (the result shows there, with "Who played?" as its main button). Someone who
  scans right after the winning goal wants to see the result first.
  → backend: one extra branch in the resolver.
- The league list `/<org>/<league>/tables` keeps linking to each table page (exists).

### A2. What it shows (top to bottom, at 390 px, no horizontal scroll)

1. **Table name + occupancy badge** (exists).
2. **The score:** two columns, one per team. The teams carry the **table's team names**,
   default **Red** and **White** (A7). The examples below use the defaults.
   - **Header:** the team name ("Red"). When the players are known (a linked or claimed match),
     the header shows their names instead ("Anna & Ben"), with the team name small above them.
   - There's no colour swatch, because the names are free text. The word is the cue.
   - **Body:** the score in huge digits, in the page's text colour.
   - **Column order:** with a scoreboard, the scoreboard's order (`scoreboardLeftEnd`, exists).
     Without one, the **first team name (end A) on the left**, always. The names identify the
     teams, so a phone held at either end still reads right.
3. **The status line** (one line under the score):
   - Live: **"First to 10 · 7 min"**. The winning score is the match league's, and the minutes
     count from `startedAt`. No ticking seconds: the game runs on goals, not on a clock.
   - Finished, auto-submit pending: **"Game over · saving in 6 s"** (from `autoSubmitAt`), then
     **"Saved to MMR"**.
   - Finished, needs players: **"Game over"** + the **Who played?** button (exists below).
   - No game: **"No game running. The next goal starts one."**
   - Won: **"Game over · Red won"** (the score is right above).
4. **The last goal:** **"Goal for White · 12 s ago"**, plus " · Anna" when a scorer is known
   (`lastGoal`). It refreshes every 10 s (the age), and after 5 min it reads "Last goal 14:07".
5. **Actions** (A3), below the score, never next to the digits.
6. Roster / claim / link sections (exist), with the **scoreboard copy hidden when the table has no
   scoreboard**: "Tap your badge on the scoreboard to join" and "Make teams on the scoreboard".
   → backend: `TableResponse.hasScoreboard` (a claimed scoreboard is assigned to the table).

**Feedback on change (no sound, no vibration):**

- **New goal:** the scoring team's digits pulse once (scale 1 → 1.15 → 1, ~400 ms). Honour
  `prefers-reduced-motion` (a colour flash instead).
- **Undone goal:** for 4 s, the line under the score reads **"Goal for White undone · now 2 : 3"**
  (the new score, in column order), and the digit changes with a short fade, no pulse. This tells
  the players that the undo worked, from whichever end it came: phone, board or counter button.
- **Game won:** the winner's column gets a check mark, and the status line changes (above).
  Nothing else.
- **No phone sound by default.** Autoplay needs a tap first, and the counters' buzzer (Part B)
  covers it. No vibration either: there's none on iOS, and a goal isn't urgent.

**Keep the screen on:** request the Screen Wake Lock while a game is live, and release it when the
game finishes or the tab is hidden. Browsers without it fall back silently (native API, no library).

**Device trouble, shown to the players (must on a table with no scoreboard, should otherwise):** when a goal counter at this table is offline
(> 36 h), has a low battery, or reports `beam: blocked`, one quiet line goes at the bottom. A counter
is named by the goalkeeper in front of it (A7):
**"Goal counter behind the Red goalkeeper: battery low"**,
**"Goal counter behind the Red goalkeeper is offline"**, or **"Ball stuck behind the White goalkeeper?"**
("the <name> goalkeeper", so a free-text name needs no possessive). Without a board,
nothing else at the table tells the players why goals stopped counting.
→ backend: a small `devices: { end, role, lowBatt, beamHealth, lastSeenAt }[]` on `/live`, if it's
cheap. It's the only low-battery cue the players get (B3: no low-battery beep).

### A3. Actions on the phone

These come in because nothing else at a board-less table can start a new game. **There's no
Undo on the phone** (user, 2026-10-18): a goal is undone only with the counter's button, for its
own goal, within 10 s (B1).

| Action | Shown when | What it sends | Guard |
|---|---|---|---|
| **New game** | Live with a score above 0 : 0 | Opens a small sheet: **"Save 4 : 3"** (`new-game {save: true}`: finishes it, then it can be claimed) and **"Throw it away"** (`{save: false}`), plus Cancel | A two-step sheet, because a wrong tap loses a game |
| **Who played?** | Finished, needs players | Exists (claim) | Exists |
| **Playing a matchmade game here?** | Exists | Exists (link) | Exists |

- **Who may press them:** any member who can see the page (backend's `Member`), as anyone can at
  a board. The table is a shared object in a trusted office, and a log of who did what is enough.
  → backend: the new-game rows record the user.
- **A miscount noticed after the 10 s window stands.** The only way out is New game → Throw it
  away (the user accepts this). The phone still shows **"Goal for White undone · now 2 : 3"** when
  a counter's button undoes a goal, so everyone sees it worked.

### A4. How it updates

- **Long-poll `GET /tables/{id}/live?since=<version>&wait=25`** (**built** by backend 2026-10-17):
  - It answers at once when the version differs. Otherwise it holds until the next change, or
    until `wait` runs out, and then returns the same `LiveTableResponse`.
  - It reuses the scoreboard's wake, so a goal shows in well under a second.
  - Without `since`, it behaves as before.
- **Fallback:** the current 2 s poll while live, 15 s otherwise. The page uses that until the
  long-poll ships, and whenever the long-poll errors.
- Stop when the tab is hidden; refetch at once when it shows again or the phone comes back online.
- If the last good answer is older than 10 s, grey the score and show **"Reconnecting…"**. A
  stale score must never look live.
- Rejected: SSE/WebSockets (new proxy infrastructure, same result; backend + admin-ui agree).

### A5. Decisions taken here (ux), and what's left for lead

- Taken: Member only. Team A's name left / B's right without a board (A7). "First to N · m min" with no seconds.
  Pulse on a goal, text on an undo, no sound or vibration. Wake lock while live. No Undo on the
  phone (user 2026-10-18). New game in a two-step sheet. Long-poll
  with a 2 s poll as the fallback.
- **The idle close stays at 30 min:** an abandoned 4 : 3 is closed sooner anyway. Each counter
  sends its sleep status after `idle_timeout_s` (300 s) without motion, and a "sleep" status
  finishes the live match (hardware-api.md). So it closes ~5–7 min after the last touch, and New
  game covers the rest.
- **Anonymous score view: no** (lead 2026-10-17). Members only.
- Build cost (admin-ui): ≈ 1–1.5 days + e2e. Backend: (long-poll done)
  `/new-game` (`/tables/{id}/undo` was dropped, backend 2026-10-18), `hasScoreboard`, the resolver's 2-minute branch, and optionally `devices`.
  Contract rows: `api/docs/hardware-api.md` (backend).

### A6. Check before shipping (admin-ui, extends MANUAL-TEST row 8)

At 390 px with the twin playing:

- The score updates in < 1 s (long-poll), or ≤ 2 s (fallback).
- A goal pulses the right column.
- An undo from the twin shows "Goal for … undone · now …".
- The teams read the table's names everywhere (headers, last goal, undo, device lines, claim
  slots). Rename them to Blue / Yellow in admin, and the phone follows on its next update. Player
  names replace the header once the players are known.
- Admin: setting a counter to "Red" shows "A ball in this goal is a goal for White."
- There's no Undo button on the phone.
- New game → Save makes the game claimable, and Throw it away discards it.
- Wifi off: "Reconnecting…" within 10 s.
- The screen stays on during a game.
- A table with no scoreboard shows no badge or board copy.
- `/t/<code>` right after a win shows the result page.

### A7. Team names: per table, default Red / White (DECIDED, user via lead 2026-10-17)

When the players aren't known, the teams go by the **table's two team names**:
- The default is **Red** and **White**. An admin can change them per table, e.g. to "Blue" /
  "Yellow", to match the table's figures.
- They're names, not colour codes: nothing is hardcoded, and nothing name-related lives in the
  firmware. The counter only reports its end, A or B.

**Storage (lead's proposal, backend decides):** reuse the table's existing `endLabelA/B` as these
names.
- Defaults: **Red** (A) and **White** (B).
- Limits: ≤ 12 characters (as now), not empty, and the two names must differ (ignoring case; 400).
- No migration: the schema hasn't shipped (backend).
- A goal counter's assignment still picks end A or B. Team A defends goal A, so scores, claims and
  the same-end 409 don't change.

**The rule:** a goal counter's end names the **team whose goalkeeper guards that goal**. A ball in
that goal is a **goal for the other team**.

**Admin wording** (admin-ui; decider: ux). `<A>` / `<B>` are the table's current names, never
"end A/B":

| Where | Text |
|---|---|
| Table form: the two fields | **Team names** with the hint "What players call the two teams when nobody's signed in: usually the colour of the figures." Fields **First team** (default Red) and **Second team** (default White) |
| Table form: the names are the same | **The two teams need different names.** |
| Goal counter assignment, next to Table | **Whose goalkeeper guards this goal?** · **<A>** / **<B>** (radio buttons; picking one sets end A / B) |
| Line under it, live as you pick | **A ball in this goal is a goal for <the other name>.** |
| Device row in the Hardware list | **Table 1 · guarded by <name> · counts for <other>** |
| The other counter at the table already has that team | **The other goal counter at Table 1 is already guarded by <name>. Set it to <other> first.** |

- **Why not "This counter sits in the goal of team: Red"** (lead's draft): "the goal of team Red"
  also reads as "Red's goals", the ones Red scored, which is backwards. "Whose goalkeeper guards
  this goal?" points at a figure you can check by looking at the table. The live line under it
  then says the result out loud before anyone saves.
- **Same phrasing on the phone:**
  - "Goal for White" means White scored.
  - A counter is "behind the Red goalkeeper".
  - The phone never writes "Red's goal", because it reads both ways. It also never writes
    possessives of names, so any name works.
- **Renaming:** the names live on the table, so a rename relabels past and live games alike. A
  rename never changes which counter guards which goal.

**Backend:**
- Defaults Red / White (done, backend 2026-10-17).
- Validation: different names, as a **400** like the form's other validation errors (done).
- `devices[].end` on `/live`. The frontend shows the name of that end.

**admin-ui:**
- The table form fields and the counter's assignment radio, as above.
- The claim form's team slots ("Who played?" / the prefilled Submit page) are titled **"<A> team"**
  / **"<B> team"**.
- The admin label "Scoreboard sound" becomes "Table sound" (B3).
- The parked scoreboard already shows end labels, so it picks up the names when it comes back.
  ux checks its copy then.

---

## Part B: undo button + buzzer on the goal counter (APPROVED by lead 2026-10-17; owners building)

Inputs: `electronics/goal-counter-button-buzzer-2026-10-17.md`, `firmware/goal-counter-phase1-firmware-2026-10-17.md`,
`api/docs/hardware-api.md` ('Undo button', App API). Mechanical: placement in B4.

### B1. Which goal the button undoes (DECIDED, user via lead 2026-10-17)

**Only a goal that this counter counted, and only within `undo_window_s` of it** (a server config
value, default 10 s). This replaces lead's earlier "last goal anywhere" default.

- **The server enforces it.** It owns the clock, and the window runs from the goal's arrival at the
  server to the undo's arrival. The device checks it locally too, so it can say "no" at once.
- **Why this is right for a button in a drawer:**
  - A false count (a ball bouncing back in, a hand in the gate, a double count) is noticed within
    seconds, at the drawer that counted it.
  - A real goal at the other end can't be removed by mistake. There's no cross-goal race, so no
    `expected_version`.
  - The counter stays match-agnostic.
- **Pressing again** undoes this counter's goal before that, if that one is still inside the window
  too (a double count). firmware keeps a ring of its last 4 goals.
- **Outside the window, or nothing of its own to undo → the "no" knock.** The goal then stands.
  There's no phone undo (user, 2026-10-18); the only way out is New game → Throw it away (A3). The user said "~10 s or something like that". 10 s leaves ~8 s
  after the 1 s hold, and the bench or the first week can tune it without a firmware change.
- **A press while the counter is in deep sleep** can never be inside the window (it sleeps 300 s
  after the last activity). The press wakes the counter and shows the debug screen (B5),
  silently. Only if it's held to 1 s does it play "no" and show `Undo: too late`, as when awake.
  This way a status look never knocks. (firmware, confirmed by ux 2026-10-17.) electronics wires
  the button as an ext1 wake source, at 0 µA.
- **How it's sent (firmware):** an `UndoEvent` in the same NVS queue as the goals, with its own
  `event_id` and `undoes_event_id`. It's ordered after its goal, survives power loss, and is never
  doubled. An undo of a goal still queued offline is sent after it. If it arrives late, the server
  refuses it (422), by design.
  - backend dedupes on `event_id` *before* the window check (a seen undo → 409 = done), so a
    retried good undo never buzzes "no".
  - Agreed by backend: `POST /undo-events`. Each refusal is a 422 with a `code`:
    `not_yours` / `too_late` / `already_undone` / `closed`. **All four play the same "no"
    knock.** The phone's unchanged score shows the goal still stands. The contract goes in `openapi.yaml`
    (firmware) + `hardware-api.md` (backend).
- Same server rules as the scoreboard's undo: it reopens a finished match, cancels a pending
  auto-submit, and `undoRate` counts it.

### B2. Guard against accidental presses

- **Placement (mechanical, B4):** out of the ball's path (balls queue at y < −81.4, so anywhere on
  L's front face is clear), recessed, with a plastic cap in a contrasting filament and **no label**
  (user 2026-10-18). Reachable with a finger through the frame opening.
- **Hold for 1 s** (`UNDO_HOLD_MS`, a board knob). A ball or a bump can't hold it, and a deliberate
  press easily fits inside the 10 s window. **ux: 1 s, confirmed.**
- **A `scan` tick on press-down** (when awake) says "the button works, keep holding". Releasing
  before 1 s does nothing.
- **One undo per press.** Holding it down never chain-undoes.
- **Stuck button:** still LOW after 10 s → log `button stuck`, no sound, and the button is left out
  of the deep-sleep wake sources until released (firmware).

### B3. Feedback

| What happened | Buzzer (`BUZZER` in `ux/sounds.py`) | Phone (Part A) |
|---|---|---|
| A goal is counted (beam, locally, instantly) | **`goal`** (220 ms, A6→D7). **On by default** | the score pulses |
| Button down (awake) | **`scan`** tick (30 ms) | — |
| Hold reached, and a goal of its own is inside the window: undo queued | **`undo`** (300 ms, D7→A6, down) | "Goal for White undone · now 2 : 3" |
| Hold reached, but nothing of its own is inside the window (local check) | **`not_joined`** knock (140 ms, flat), at once | unchanged |
| The server refuses it (422/404: late, not ours, already undone), while still awake | **`not_joined`** knock, ~1–3 s later | unchanged |
| Button stuck | none (log only) | — |

- **The goal chirp is on by default (answering firmware's open item).** With no board, the beep is
  the only sign at the table that a goal counted. **No beep = not counted**, so a miss is noticed at
  once, inside the undo window too. Each counter beeps for its own goal, so the sound comes from the
  end that conceded. A table that wants quiet sets "Table sound: Off".
- **Low battery: no sound (answering firmware's `LowBatt`).** I'm declining it:
  - A beep at wake ("what was that?") tells players nothing they can act on.
  - SOUNDS-V2 rule 1 says sound only for what just happened, never at wake.
  - The admin alert and the phone's device line (A2, upgraded to **must** for board-less tables)
    cover it.
  - At cutoff the goal beep stops, which is itself a cue.
- **Not in phase 1:**
  - `won`: the counter doesn't know the match, and the phone shows it. A later option is a
    `match_won` flag in the goal-event's 201 body.
  - `joined` and `saved`.
- **Volume:** the table's `sound_volume` (Off / Low / Medium / High, default Medium) now reaches the
  goal counters too (DeviceConfig, firmware). It uses the duty formula and steps from SOUNDS-V2,
  with ~3 / 12 / 50 % duty. The admin label "Scoreboard sound" becomes **"Table sound"** (admin-ui).
- **Reused from the scoreboard, unchanged:**
  - 4 of the 7 `BUZZER` sounds, the duty formula, the volume steps, the 5 ms ramps and the
    "new cuts old" rule.
  - The sound driver and the key-wake code (firmware), the buzzer circuit option B (electronics).
  - The undo rules and code (backend), and `sound_volume`.
  - Nothing new to design. `sounds.py` needs no change.

### B4. Hardware, cost, battery, contract

- **Electronics:**
  - Button: GPIO4 (MTMS back pad), 100 k pull-up + 1 k, active LOW, ext1 wake, 0 µA released.
  - Buzzer: the scoreboard's option B (CMT-1209 + BC337 from VSYS) on GPIO7 (MTDO), base
    pull-down so it's silent at boot.
  - GPIO5 stays spare. The parts fit right of the LIS3DH.
- **Battery:** ≈ +0.1–0.4 mAh/day, so the §0 goal-counter battery is unchanged within its range.
- **Cost:** ≈ +25–30 kr, so the goal counter goes from ≈ 140 to ≈ 165–170 kr. With the scoreboard
  parked, the §0 first-table / three-table totals drop by the scoreboard.
  → update: §0 (electronics, after lead's OK) + presenter + video.
- **Firmware:** the button state machine, `UndoEvent` + `undo_window_s` + `sound_volume` for the
  goal role in `openapi.yaml`, the sound driver in the goal image, ~8 native tests and a twin undo
  scenario.
- **Mechanical (as built in the sled CAD, corrected 13:47 on 2026-10-17; EST until the parts are in hand):**
  - **Button:** a front-loaded cartridge **over the USB-C**, centre y −34, z 35.5. Ø10 plastic cap,
    recessed 1 behind the face. A button doesn't fit under the mouth bay, so the first answer's
    button and buzzer spots were swapped.
    - Balls stay at y < −81.4, and the frame can't touch a recessed cap.
    - **Inside the frame opening: yes.** e_L was measured at 10–15 (mechanical, 2026-10-17), and
      the button works up to ~23.
  - **Buzzer:** under the mouth bay, y −62.7, z 17, port on a 7-hole grille facing the frame
    opening. electronics checked it: ~31 from the LIS3DH (needs ≥ 15), ~17 from the antenna (≥ 10),
    ~65 from the cells. Both leads ~110, routed along the board's channel edge.
  - The finger cup is gone: L is now pulled out by a cord in the mouth bay. The lid's front snap
    tab is mechanical's to place.
  - **Findability: a contrasting cap only** (a separate part, printed in a contrasting filament).
    - **No label on the cap or beside it, and no replacement:** the user decided this on
      2026-10-18, because the button may get another job when the scoreboard returns. The ↶ is
      dropped.
    - Hallway check: someone who was told "there's an undo button in the drawer" finds it and
      undoes within the 10 s window, first try.
- **The sled build goes on.**
- **Bench (when built):**
  - The goal chirp is audible from the playing position with the sled in the tunnel (open the
    grille if not).
  - The duty steps are even in loudness.
  - 3.45 V + buzzer High + a Wi-Fi burst gives no brown-out.
  - A press from deep sleep → "no" every time.

### B5. Debug display (the trigger stands; the 0.96" content is superseded by B5a's 0.91" 2-line layout, 2026-10-18)

It's a debug view for whoever sets the table up or fixes it, read through the frame opening at
30–50 cm. Players don't need it: the phone, the buzzer and admin cover them. Hardware:
`electronics/debug-display-2026-10-17.md`.

**Font and layout:** 8 × 16 px characters, giving **4 lines × 16 characters**. Glyphs are ≈ 2.7 mm
tall, readable at 50 cm. Each line has a fixed place and stays left-aligned, so the eye learns where
to look. **Faults are shown in inverse video** (a white bar, black text).

| Line | Normal | Other states (inverse = fault) |
|---|---|---|
| 1 Wi-Fi + server | `WiFi -61 srv ok` (RSSI dBm, last server reply) | `WiFi off` · `WiFi -61 srv 401` · `… srv 404` · `… srv err` (5xx / timeout) · `WiFi …` while connecting (not inverse) |
| 2 Battery + queue | `Batt 3.92V  Q 0` | inverse when the battery is below the warn level (§3) or `Q` > 5 |
| 3 Beam | `Beam a ok 6.1x` (mode, health, margin) | `Beam a low 1.8x` · `Beam b amb 2.0x` · **`Beam BLOCKED`** (live, the moment the beam is blocked: a hand in the gate tests detection) · `Beam DEAD` |
| 4 Assignment + version | `End A   v1.4.2` (the config's `goal` as sent; backend sends `A`/`B`) | **`NO TABLE v1.4.2`** (the config is 404, the usual setup fault) |

- **Undo results** replace line 4 for 5 s, inverse for a refusal:
  - `Undo queued` at the hold, then `Undo ok` on 201/409. `Undo failed` if it can't be stored
    locally.
  - `Undo: too late` (the local check, or `too_late`).
  - `Undo: not mine` (`not_yours`).
  - `Undo: was undone` (`already_undone`).
  - `Undo: game over` (`closed`).
- Beam health words: ok, low (`low_margin`), amb (`ambient_high`), BLOCKED, DEAD (`sensor_dead`).
- **No team names**: the firmware knows only A/B.
- It updates live at 1 Hz while on, and at once for the beam and undo lines.

**Trigger** (the undo button, B2):
- **Press-down:** the screen turns on at once, plus the `scan` tick when awake.
- **Released in < 1 s:** no undo. The screen stays on for 10 s from the release. Another short press
  restarts the 10 s.
- **Held to 1 s:** the undo, as before (B1–B3). The screen shows the result on line 4 and stays on
  10 s.
- **From deep sleep:** the press wakes the counter. The screen comes on at boot and stays until 10 s
  after Wi-Fi settles (connected or failed, at most 30 s in all).
- **After a battery swap** (a power-on boot: cells just pushed into the drawer): the same, so the
  swapper sees the new voltage and Wi-Fi come up without pressing anything. No sound.
- **Otherwise it's off** (panel sleep, 0xAE), including on USB. There's no always-on mode: it would
  cost battery, and an OLED burns in.
- Brightness: the panel default; the bench turns it down if it glares in a dark drawer.

#### B5a. The display is now the slim 0.91" (128 × 32, upright) (ux + mechanical, 2026-10-18)

This replaces the 0.96" in B5. **The B5 trigger stays. The content becomes the 2-line layout
below.** Mechanical: `mechanical/reports/2026-10-18-slim-display-proposal.md`. L grows to 54, and the
0.96" would have to tilt ~45° there.

**Why the 0.91":**
- People see the screen through the 35-deep frame from **level up to ~23° above it**, not from
  above as I'd assumed.
- Foreshortening at a level view:

  | | Apparent 8 × 16 glyph, level view | at 20° up | Lines at once |
  |---|---|---|---|
  | 0.96" tilted 45° | ≈ 1.9 mm | ≈ 2.4 mm | 4 |
  | **0.91" upright** | **≈ 2.8 mm** | ≈ 2.6 mm | 2 |

- The upright 0.91" reads **~45 % taller at a level view**.
- With a verdict line, 2 lines carry what matters at once.
- It also prints more simply, with no tilted pocket, and frees ~19 of depth.
- 4 lines at 6 × 8 (1.4 mm, no row gap) stay **rejected**: marginal at 50 cm.
- The cost: the receiver bay sits under the display, which is fine for service only.

**The 2-line layout** (8 × 16 font, 2 × 16 characters; faults in inverse video):

- **Line 1 is the verdict:** the worst fault in inverse video, else **`OK      End A`**. Faults, worst
  first:
  - `NO TABLE`
  - `WiFi off`, `srv 401` / `srv 404` / `srv err`
  - `Beam BLOCKED` / `Beam DEAD` / `Beam amb 2.0x` / `Beam low 1.8x`
  - `Batt low 3.48V`
  - `Queue 12`
- **Line 2 cycles through the details**, 2 s each, while the screen is on (10 s):
  - `WiFi -61 srv ok`
  - `Batt 3.92V  Q 0`
  - `Beam a ok 6.1x`
  - `End A   v0.1.0`
- **Undo results** replace line 1 for 5 s (the same texts as B5).
- **`Beam BLOCKED` is live on line 1** the moment the beam breaks, so the hand-in-the-gate test
  still works. It ranks just under an undo result and **above `NO TABLE`**, so the test works on an
  unassigned counter too (firmware, accepted by ux 2026-10-18). Built: native 89/89.
- The trigger is unchanged (B5).
