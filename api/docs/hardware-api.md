# Foosball hardware API

The API serves the table hardware (goal counters and scoreboards) and the app screens around it.

- **Device API**: what the devices call. The contract is
  [`hardware/firmware/openapi.yaml`](../../hardware/firmware/openapi.yaml), which uses snake_case.
  The API serves it under `/api/v3/hardware`, so the devices' `API_BASE_URL` is
  `https://<api-host>/api/v3/hardware`.
- **App API** (below): the usual v3 conventions, with camelCase JSON, enums as strings, and Clerk JWT
  or PAT auth. Errors are ProblemDetails.

## Concepts

- **Table**: a foosball table in an organization. It has two ends, `A` and `B`. **Team names**
  `endLabelA`/`endLabelB` name the team defending each end (at most 12 characters, default
  **`Red`/`White`**, editable, e.g. "Blue" / "Yellow"). They must differ, ignoring case (400). The app
  shows them for teams whose players are unknown. An admin assigns a goal counter to the goal of team
  A or B and sees those names; the firmware only knows `A`/`B`.
- **League**: every table belongs to one league of its organization (`leagueId`, required), and so do
  its devices. Its games are scanned in, claimed, linked and auto-rated only in that league (another
  league → 400), and it gives the winning score of unclaimed games. An admin can move a table to
  another league only while it has no live or unclaimed game (409 "finish or discard the current
  game first"); matches already rated stay in their league.
- **Table sound**: `soundVolume` per table, `0` off, `1` low, `2` medium (default), `3` high
  (admin control "Table sound: Off / Low / Medium / High"). It reaches every device of the table
  (scoreboard and goal counters' buzzers) as the config key `sound_volume`. Changing it bumps the table's devices' `config_version`. Devices pull config
  once per wake, so the new volume applies from the next wake.
- **Beam health** (goal counters; `hardware/firmware/beam-health-firmware-2026-10-16.md`): an admin
  sets a goal counter's `beamConfig` (mode, health thresholds in µA, fitted resistors). It reaches the
  device as the config keys `beam_<snake_case field>` (`ledMa` → `beam_led_ma`, `mode: 'ABoost'` →
  `beam_mode: "a_boost"`). Fields left out are omitted, so the firmware default applies. A change bumps
  `config_version`, and a reset keeps it, because the resistors stay fitted. The device reports
  `lastStatus.beam` (`health`: `ok` | `low_margin` | `ambient_high` | `blocked` | `sensor_dead`, the µA
  readings, baselines and mode, snake_case as sent). It also sends `reason: beam` at once when the
  health gets worse.
- **Team A** defends goal A. The goal counter at end A watches goal A, so its goals count for
  **team B**. `scoreA` is team A's score.
- **Device**: `deviceId` is `fb-` plus 12 hex digits. A device enrols into the organization whose
  enrolment token it sends, and it starts out **unclaimed**. An admin claims it by assigning a role
  (`Goal` | `Scoreboard`), a table and an end. A goal counter's end is the goal it watches. A
  scoreboard's end is the table end it sits on. An unclaimed or unassigned device's goals are stored
  but do not affect any match.
- **Table match**: a game on a table. It is created by the first goal (or by a "New game" or a link)
  and has the status `Live` → `Finished` → `Submitted`, or `Discarded`.
  - It is **unclaimed** while nobody knows who played. Players pick the teams when they claim it.
  - It is **linked** when an active matchmaking match was linked to the table, or the scoreboard made
    teams from its scanned-in roster (see [Scan-in](#scan-in-device-api)). The roster then comes from
    that match.
  - Scoreboard "New game": on a live match, **Save** finishes it (the board shows the result and its
    claim QR) and **Discard** throws it away (a linked match restarts at 0 : 0 with the same teams).
    On a finished linked match it is a **rematch**: the same teams at the same ends, at 0 : 0. On a
    finished unlinked match it starts a new game: the lobby when the table can scan players in,
    otherwise a live 0 : 0 match.
  - It **finishes** when a team reaches the league's winning score, on "New game → Save", on a
    "sleep" status from a table device (no activity for 2 min), or after
    `Hardware:LiveMatchTimeoutMinutes` (default 30) with no activity. A match that ends at 0 : 0 is
    discarded.
  - A finished, unsubmitted match **can be claimed** for `Hardware:ClaimWindowDays` (default 7).
    After that it expires and drops out of the claimable list.
  - A linked match that **reaches the winning score is submitted automatically**,
    `Hardware:AutoSubmitDelaySeconds` (default 10, 0 = off) after the winning goal. Until then an undo
    on the board cancels it (the match is live again), and the board counts down (`submit_in_s`). Once
    submitted, an undo gets 422, while scorers can still be picked (board and app) and Rematch still
    works. The submit runs on a 1 s check, under the table's row lock, and only from `Finished`, so
    several replicas never submit it twice. A failed submit retries every minute (an invalid result is
    left to the players instead). Otherwise players confirm a linked match in the app (claim), or by
    pressing "New game" (or tapping a card) on the scoreboard once it is finished with a valid result.
    A table-made match with an invalid result is unlinked at that point instead, and stays claimable
    as an unclaimed match.
  - **Rated on the board**: a finished match with `needs_claim == false` is in MMR. Don't use
    `claim_url == null` for that: it is also null when no public frontend URL is configured.
- **Goal attribution — an accepted goal is never dropped** (deduplicated on `event_id`):
  1. The **server receipt time** decides. A goal goes to the table's live match, or opens a new one.
  2. The device's `occurred_at` (NTP, or null when not yet synced) is only used to spot a **queued**
     goal: one that is more than **60 s** older than where its receipt would put it, i.e. older than
     the live match's start, or older than now when no match is live. A queued goal goes to the
     claimable finished match whose span (±60 s) contains it, and that match's score changes.
  3. A goal that fits nowhere is kept as an **orphan**. That covers a queued goal that matches no
     game, a goal from an unassigned device, and a goal tagged with another table. Each orphan is
     logged as a warning (`Orphan goal ...`, exported as an OTel log record) and listed under
     `GET /admin/orphan-goals`.
- **Scoreboard orientation**: a reader faces the board, so they look towards its end. Players keep
  their own goal on their left hand (the goalie rod), so the team that **defends the board's end is
  on its left half**. `scoreboardLeftEnd` (= the scoreboard's end) gives that end, so the app can
  order its columns the same way.
- **Device enrolment keeps pre-assignment**: a device pre-registered, or reset, in the same org
  keeps its role, table and end when it enrols. Enrolling into another org clears them.

## Configuration

| Key | Default | Purpose |
|-----|---------|---------|
| `Hardware:PublicFrontendBaseUrl` | unset | The base URL of frontend-beta, used to build the short links `{base}/t/{code}` (the scoreboard's `table_url`/`claim_url`, and `TableResponse.tableUrl`). When it is unset, those are null. |
| `Hardware:ClaimWindowDays` | 7 | How long a finished match can be claimed. |
| `Hardware:LiveMatchTimeoutMinutes` | 30 | A live match with no activity for this long is closed. |
| `Hardware:DeviceUndoWindowSeconds` | 10 | A goal counter's undo button may undo its own goal this long after the goal arrived. Sent to the counters as `undo_window_s`. |
| `Hardware:AutoSubmitDelaySeconds` | 10 | A linked match won outright is submitted this long after the winning goal; 0 = off. |
| `Hardware:CardUidKey` | unset (**set it per deployment, never in the repo**) | Base64, at least 32 bytes (e.g. `openssl rand -base64 32`). The key for the NFC card hashes (see [Cards](#cards)). A malformed key stops the API at startup. Without one, the API logs a warning and card scans are unavailable. Changing it unlinks every card. |
| `Kestrel:Limits:KeepAliveTimeout` | `00:10:00` | How long an idle HTTP connection is kept open (Kestrel's own default is 2 min 10 s). It applies to the whole API. |

**Keep-alive.** The goal counters and scoreboards keep their TLS connection open between calls. A
new handshake under Wi-Fi power save adds 0.5–1.2 s to the first goal after a pause, so the API
keeps idle connections for 10 minutes (covering a whole wake, since devices sleep after
`idle_timeout_s`, 300 s by default). An ingress or load balancer in front of the API usually ends
the device's TLS connection itself, with its own idle timeout. **Deployments should raise the
ingress's idle timeout towards the devices to match** (where the platform allows). Its idle timeout
towards the API should stay below the API's keep-alive, so the proxy never reuses a connection the
API has just closed.

**Replicas.** Scoreboard long-polls are woken in-process, and also re-check the database every 2 s.
With more than one API replica (or during a revision swap), a change made on another replica reaches
a held long-poll within about 2 s instead of at once. The repo doesn't set the Container Apps replica
count (it's configured in Azure), so check it if display latency matters.

## Short links

The frontend route `/t/{code}` resolves a link printed on the hardware.

- **Table code** (`TableResponse.shortCode` / `tableUrl`, written once onto the table's NFC sticker):
  **permanent**. The claim window, renames and default-league changes don't affect it. An admin can
  replace it with `POST /admin/tables/{tableId}/short-code`, either random or a **readable custom
  code** (`{ "code": "table-1" }`: 3–32 of `[a-z0-9-]`, stored lowercase, matched
  case-insensitively, 409 if it reads as any other table, match or card code). After that the old
  code returns 404.
- **Match code** (the scoreboard's `claim_url`, shown only while `needs_claim`): one per table match.

**Where a table or match code leads** follows the game. A table code means the table's latest game,
or, once the board is back in the lobby, its latest game still to claim:

| The game | `path` |
|----------|--------|
| Table code only: ended (finished or rated) less than 2 min ago | `/<org>/<league>/tables/<tableId>`, so the result shows first (`tableMatchId` / `matchId` set as below) |
| Live (being played, or teams made at 0:0) | `/<org>/<league>/tables/<tableId>` (the live table page) |
| Finished, linked, waiting for the auto-submit or a confirm | `/<org>/<league>/tables/<tableId>` |
| Finished, unlinked, within the claim window | `/<org>/<league>/submit?table=<tableId>&match=<tableMatchId>` (prefilled; `tableMatchId` set) |
| Rated (submitted) | `/<org>/<league>/match/<matchId>` (the match page with its goals; `matchId` set) |
| None, discarded or expired | `/<org>/<league>/submit?table=<tableId>` |
- **Card code** (shown on the scoreboard after an unknown card is scanned): links that card to the
  viewer (see [Cards](#cards)). Valid for 10 minutes, and used up once the card is linked. A code is
10 Crockford base32 characters (unguessable and case-insensitive), so a short link is about
`https://<host>/t/XXXXXXXXXX`.

`GET /api/v3/short-links/{code}` needs a signed-in user (Clerk or PAT) who is an active member of
the code's org. Otherwise, or for an unknown code, it returns 404.
It returns `200 ShortLinkResponse`. For `kind: "Table"`, `path` is as in the table above. For
`kind: "Card"`, it is
`/<orgSlug>/cards?code=<code>` (the code `POST /me/cards` takes), and `cardLinkExpiresAt` is set.
A card code resolves until it is used (then 404) or expires (then 410: scan the card again).
The league is the rated match's league, else the table's league.

## Scan-in (device API)

Contract: `hardware/firmware/openapi.yaml` (`scan`, `remove_player` and `generate_teams` actions,
`state.roster`, `state.scan`); ux flow: `hardware/ux/SCOREBOARD-UI.md` §Scan-in. Server rules:

- **Can scan** when `Hardware:CardUidKey` is set and the table's league has a team size
  of 1 or 2. Otherwise `roster` is null, and a scan answers `unavailable` (no key) or `no_league`.
- **`roster` is present** (possibly with no players) whenever no game is on: no match, a 0:0 linked
  match (teams made), or a finished one (always empty there; a card starts a new lobby). It is null
  from the first goal, and a scan then answers `locked`. Undoing back to 0:0 shows it again.
- **Scan** (no `expected_version` check, always 200 with `scan`): the card's member joins in join
  order with a colour, unless already in (`already_in`), the roster is full (`roster_full`, also while
  teams are made), or they play in a live linked match on another table (`busy`). An unknown card
  puts up the link QR (`roster.link`, 10 min, one per table). A card tapped on a finished game confirms
  it like "New game", then starts a new lobby with that player (`match` null).
- **`generate_teams`**: exactly 2 × team size players, no teams yet (else 422). `mode` picks the split:
  `fair` (the default; by MMR, snake draft, deterministic), `random` (uniform), or `manual` with
  `teams` = [left, right] player ids as the sending board shows them (422 unless each has team size
  players and every roster player appears once). The teams go into a new active match, linked to the
  table at 0:0 (fair: the first-drafted team at end A; random: random ends), and the link QR goes.
  `match.teams_mode` is the mode (kept by a rematch and a discard back to teams; null when linked in
  the app). **Again**: `{mode: random}` while random teams are at 0:0 replaces them with a different
  pairing (a new active match; 1v1 has only one, so just the ends are re-drawn); on fair or manual
  teams it is a 422.
- **`remove_player`**: removes a roster player (404 if not on it, 422 once the game is on). From made
  teams, it dissolves them (the table's own active match is deleted) and returns to the lobby.
- **Colour**: palette index 0–5 (red, yellow, green, cyan, blue, magenta; `colorHex` in the app). It
  comes from the member ID; on a clash in one roster the later joiner takes the next free one, and a
  player keeps it through the game and rematches.
- **Expiry**: a lobby nobody has joined for 30 min is cleared (not during a game). Made teams with no
  goal close with the live-match timeout and go back to the lobby.
- **Auto-submit countdown**: `match.submit_in_s` (finished, linked, won outright) is the seconds left
  until it is rated; null when nothing is pending. After the submit: `needs_claim` false, `claim_url`
  null, `can_undo` false, players kept, version bumped; `undo_last_goal` → 422.
- **Finished summary**: on a finished match, `match.summary { duration_s, mvp_name }` for the board's
  line ("9:26 · MVP Alice"). `duration_s` is first to last counted goal (METRICS T1: event times, each
  gap capped at 5 min), null below 2 goals. `mvp_name` is the top contributor (METRICS §4.1–4.2:
  contribution, on a tie the impact, still tied → null), 2v2 only, and null unless ≥ 70 % of the counted
  goals have a known scorer (own goals included). The maths is in `Services/V3/TableMatchStats.cs`
  (a port of `hardware/analytics/example.py`; its worked example is a unit test).
- **Players** are league players of the table's league, created on the first scan if
  needed. Moving the table to another league clears its roster, and removing a member deletes their
  roster places.

## Undo button (device API)

`POST /api/v3/hardware/undo-events` (`UndoEvent` in `firmware/openapi.yaml`): a goal counter's undo
button. It's queued and retried like a goal, with its own `event_id` and `undoes_event_id` (this
counter's goal).

1. **Dedupe first:** a seen undo `event_id` → 409 (done), whatever else holds. So the retry of an undo
   that worked never reads as too late. The undo is stored on the goal (`table_goals.undo_event_id`).
2. **Refusals:** each is a 422 ProblemDetails with a `code`, and the counter knocks "no" for every one:
   - `not_yours`: the goal isn't one this device sent, or is unknown;
   - `already_undone`: by this counter or the scoreboard;
   - `closed`: its match is submitted or discarded, or isn't the table's newest match;
   - `too_late`: more than `Hardware:DeviceUndoWindowSeconds` (`undo_window_s`, default 10) passed
     between the goal's arrival and the undo's (server receipt times).
   A refused undo isn't stored, so a retry gets the same answer.
3. **Otherwise** → 201: the goal is undone as by the scoreboard's undo, so a finished match goes live
   again and a pending auto-submit is cancelled.

An unclaimed or unassigned counter's undo → 201 with no effect.

## Device auth (device API only)

Every device request carries:

```
X-Device-Id: fb-a0b1c2d3e4f5
Authorization: Device <64 lowercase hex>   # random secret created on first boot
X-Enrolment-Token: <org enrolment token>
```

| Situation | Result |
|-----------|--------|
| Known device, secret matches its stored SHA-256 hash (constant-time compare) | OK. The enrolment token is not checked, so rotating or revoking it never locks out a registered device. |
| Unknown device (or reset), valid enrolment token | Registered as unclaimed in the token's org with this secret, then OK |
| Anything else | 401 |
| Path or body `device_id` ≠ `X-Device-Id` | 403 (path) / 422 (goal event body) |

Unclaimed/unassigned: `config` → 404, `scoreboard` → 404, undo events → 201 (no effect), goal events → 201 (stored, no match
effect), status → 204.

## App API

Base: `/api/v3/organizations/{orgId}`. Policies: **Member** = active org member, **League** = league
access (league player, or moderator and up), **Mod** = Moderator or Owner, **Owner** = Owner.

### Tables (players)

| Method | Path | Policy | Body → Response |
|--------|------|--------|-----------------|
| GET | `/tables` | Member | → `TableResponse[]` (ordered by name) |
| GET | `/tables/{tableId}/live?since=&wait=` | Member | → `LiveTableResponse`. `version` changes on every change. **Long-poll** (the phone's live score): pass the `version` you have as `since`. The answer is held until it changes (at once in-process, ≤ 2 s across replicas) or for `wait` seconds (default 25, 0–60), and it's the current state either way. Re-request with the new `version`. Without `since`, or with an older one, it answers at once. |
| POST | `/tables/{tableId}/new-game` | Member | `TableNewGameRequest` → `LiveTableResponse`. The scoreboard's "New game": `save: true` finishes the game (claimable), `false` throws it away. A finished linked game is confirmed and rematched as on the board, and a 0 : 0 game is unchanged. Records the member (`table_matches.ended_by_membership_id`). 409 when stale. |
| GET | `/tables/{tableId}/stats?from=&to=&tz=` | Member | → `TableStatsResponse` (see Occupancy and stats) |
| GET | `/tables/stats?from=&to=&tz=` | Member | → `TablesStatsOverviewResponse`: every table's headline numbers |
| GET | `/table-matches?tableId=` | Member | → `TableMatchResponse[]`: claimable matches (finished, unsubmitted, unlinked, within the claim window), newest first. `tableId` is optional. |
| POST | `/leagues/{leagueId}/table-matches/{tableMatchId}/claim` | League | `ClaimTableMatchRequest` → `MatchResponse` (the new match, `source: "Table"`). 400 when `leagueId` isn't the table's league. |
| POST | `/leagues/{leagueId}/active-matches/{activeMatchId}/link-table` | League | `LinkTableRequest` → `LiveTableResponse`. 400 when the table plays in another league. |

**Claim**: you can claim a `Live` or `Finished` match. A live one is finished first.
- **Unclaimed** match: `teams` is required, with exactly one entry for end `A` and one for end `B`.
  `players` uses the same player-ref union as `POST /leagues/{leagueId}/matches`
  (`leaguePlayerId` | `organizationMembershipId` | `newPlayer`), checked against the league's team
  size. The scores come from the table, never from the client. The usual match rules apply (for
  example, the winner must reach the league's winning score), and a match that breaks them gets a
  400.
- **Linked** match: `teams` is ignored. `leagueId` must be the active match's league. The caller
  must be a participant or a moderator, as for `POST active-matches/{id}/submit`.
- Errors: 404 for an unknown match, 409 if the match is already submitted or discarded, 400 if it
  has expired or the request is invalid.

**Link**: if the table's live match has no link yet, it gets this roster and keeps its score.
Otherwise a new live match starts at 0 : 0. Errors: 409 if the table is playing another linked
match, or this active match is live on another table.

### Occupancy and stats

Definitions: `hardware/analytics/METRICS.md` §8. Everything comes from what the devices already send.

**Occupancy** (`TableResponse.occupancy`, so in `GET /tables`, `/live` and the admin tables). The first
state that matches wins:

| `status` | Rule | `since` |
|----------|------|---------|
| `Unknown` | No goal counter (`reason: NoDevices`), or every device is out: a cut-off battery (`LowBattery`), a wrong-board image or 36 h of silence (`Offline`). Never shown as free. | null |
| `InUse` | A live game with a goal in the last 5 min (`Game`); players scanned in, the newest ≤ 10 min ago or the board awake (`Gathering`, with `rosterCount` of `rosterSize`); teams made ≤ 10 min ago with the board awake (`TeamsMade`). | The first goal or scan, backdated to an awake device's wake when that's ≤ 15 min earlier. |
| `JustFinished` | The newest game finished, its last goal ≤ 3 min ago, a device still awake. | When it ended. |
| `ProbablyInUse` | A live game paused 5–15 min with a device awake (`LongPause`), or the board awake longer than a bump (idle timeout + 60 s, `DevicesAwake`). | The game's first goal, or the board's wake. |
| `Free` | Anything else. `reason: Touched` when a device woke recently (someone's nearby). | The last counted goal ever; null if none. |

"Awake": the last request wasn't a status (a `beam` status doesn't count: it comes mid-wake), and the scoreboard asked within 90 s (it long-polls) or the
goal counter within 6 min (it's silent between goals). `Device.awake_since` is set on a wake's first
request and cleared by a status other than `beam`. `scoreA`/`scoreB` come with a live game's goals and `JustFinished`.

**Busy intervals** (§8.3): each match with a counted goal (any status, Discarded too) is busy from 60 s
before its first goal to 60 s after its last; each device wake is busy from waking until its idle timeout
began. A wake comes from the `sleep` status (`device_wakes`: woke at = status − `uptime_ms`, idle from =
status − 300 s); wakes under 60 s (bumps) are dropped. Overlaps are merged per table. Until a table has
wake rows, `utilisationIsLowerBound` is true (play without goals is missed: show "≥ 23 %").
`device_wakes` isn't pruned (about 20 small rows per busy table per day).

**Stats** take `from`/`to` (ISO, default the last 30 days up to now) and `tz` (IANA, the viewer's zone,
default UTC; 400 if unknown, or if `from ≥ to` or the range is over a year). Days, ISO weeks (Monday
first), hours and the office hours (Mon–Fri 08:00–18:00) are in `tz`. A **game** is a submitted match,
or a finished unclaimed one with ≥ 5 goals or a winner at the winning score; the rest are fragments
(data quality only). A game's day is the local date of its first goal. Fractions are 0..1, durations
seconds. Each number is a `StatValue`: `value` is sent even below the minimum sample (`enough` false),
and is null only when nothing was measured.

| Field | Stat | Sample (`n`) | `minN` |
|-------|------|--------------|--------|
| `games`, `gamesPerDay` (every local day, zeros included), `weeks[]` | TS1 games, split submitted / unclaimed | games | 1 |
| `averageGamesPerWeek` | TS1 mean of the window's full weeks (the trend base) | full weeks | 4 |
| `busyHours` | TS2 7 × 24 (Mon first) average busy minutes per weekday-hour, 0–60 | games (and ≥ 4 weeks of data) | 30 |
| `matchDurationS` | TS3 median first-to-last-goal time of games that reached the winning score; `low`/`high` = 25th/75th percentile | those games | 10 |
| `utilisation`, `weeks[].utilisation` | TS4 busy share of the office hours | full weeks | 1 |
| `claimRate`, `claimRateLinked`, `claimRateUnlinked` | TS5 submitted share of the games whose claim window has closed (admin) | those games | 20 |
| `endBias` | TS6 share of goals credited to end A; `low`/`high` = 95 % Wilson interval (admin) | games | 30 |
| `dataQuality` | TS7 per goal counter undo and fast-gap (< 3 s) rates, orphans, fragments and discarded per week, scorer picks on linked games (admin) | goals | 30 |

The overview has each table's `occupancy`, `games`, `gamesThisWeek`, `utilisation` and
`matchDurationS`, the combined `busyTables` heatmap (the average number of tables busy) and
`allTablesBusy` (TS8, admin): the share of office hours with every table busy (`n` = full weeks,
enough from 2 and with ≥ 2 tables) and the longest such stretch.

### Goals (fix scorers)

For any table match, submitted or not. Scorers aren't rated, so editing never changes ratings. A board
showing the match redraws.

| Method | Path | Policy | Body → Response |
|--------|------|--------|-----------------|
| GET | `/leagues/{leagueId}/matches/{matchId}/goals` | League | → `MatchGoalsResponse` for a rated match. 404 when it wasn't played on a table (`MatchResponse.source` is `Table` exactly when it was). |
| PUT | `/leagues/{leagueId}/matches/{matchId}/goals/{goalId}/scorer` | League | `SetGoalScorerRequest` → `MatchGoalResponse`. 400 when the player isn't in the match, 403 when the caller isn't a player of the match or Mod+, 404 for an unknown or undone goal. |
| GET / PUT | `/table-matches/{tableMatchId}/goals[/{goalId}/scorer]` | Member | The same, for a table match that isn't submitted yet (players: `TableMatchResponse.playersA/B`). |

- The goals are the **counted** ones (not undone), ordered by event time (METRICS §1.4); `at` is that
  time, and `scoreA`/`scoreB` the running score after the goal (A = team index 0 = end A).
- Pick a player of **either** team, or null to clear. A player of the conceding team records an **own
  goal** (`ownGoal`). `teamIndex` (the team credited) never changes, so neither does the score. 1v1
  works the same.
- The players are the rated match's teams once it's submitted, else the linked roster's. An unclaimed
  match has none, so nothing can be picked until it is claimed.

### Cards

A member can link NFC cards (badges) to themselves, then tap one on a scoreboard to join its
roster (see [Scan-in](#scan-in-device-api)). Linking a card from the scoreboard's QR also joins that
table's roster at once: `PlayerCardResponse.rosterResult` says how (`Joined`, `AlreadyIn`,
`RosterFull`, `Locked`, `Busy` or `NoLeague`).

- **Stored:** only `HMAC-SHA256(Hardware:CardUidKey, orgId ‖ UID bytes)`, the member it belongs to,
  and who linked it (`linkedBy` in responses, shown to the owner and to admins; null when the owner
  linked it).
  The org ID in the hash means one badge can't be matched across organizations. No raw UIDs, scan
  history or last-used times are kept.
- **Unknown card:** a scan creates a link request (one per table; a new scan replaces it). It is
  deleted when the card is linked, or 10 minutes later.
- **Deleted when:** the member unlinks it, an admin deletes it (one, or all as Owner), the member is
  removed from the organization, or the key changes. Changing the key leaves the stored hashes
  matching nothing.

| Method | Path | Policy | Body → Response |
|--------|------|--------|-----------------|
| GET | `/me/cards` | Member | → `PlayerCardResponse[]` (the caller's, oldest first, including ones others linked for them) |
| POST | `/me/cards` | Member | `LinkCardRequest { code, membershipId? }` → 201 `PlayerCardResponse`. Links the card behind the scoreboard's card code to the caller, or to `membershipId` (any active member of the org: any member may link a badge for someone), and uses up the code. The card's owner joins the table's roster (`rosterResult`). 404 unknown code or not an active member, 410 expired (scan again), 409 card already linked to someone else. |
| DELETE | `/me/cards/{cardId}` | Member | → 204 (404 if it isn't the caller's). The owner can always delete a badge, whoever linked it. |

### Admin (Mod unless noted)

| Method | Path | Body → Response |
|--------|------|-----------------|
| POST | `/admin/tables` | `UpsertTableRequest` → 201 `TableResponse`. 400 when `leagueId` isn't a league of the org. |
| PUT | `/admin/tables/{tableId}` | `UpsertTableRequest` → `TableResponse`. 400 as on create; 409 when changing `leagueId` while the table has a live or unclaimed game. |
| POST | `/admin/tables/{tableId}/short-code` | `SetTableShortCodeRequest?` (no body = random) → `TableResponse` with the new `shortCode`. 400 bad format, 409 taken. The old link returns 404 from now on, so rewrite the NFC sticker. |
| DELETE | `/admin/tables/{tableId}` | → 204. Unassigns its devices and deletes its table matches. Submitted matches are kept. |
| GET | `/admin/devices` | → `DeviceResponse[]` (unclaimed first) |
| GET | `/admin/orphan-goals?tableId=` | → `OrphanGoalResponse[]`: the newest 200 accepted goals that fit no match |
| PUT | `/admin/devices/{deviceId}` | `AssignDeviceRequest` → `DeviceResponse`. Claims the device and sets its role, table and end. Returns 409 if another goal counter already watches that goal. |
| PUT | `/admin/devices/{deviceId}/beam-config` | `BeamConfig` → `DeviceResponse`. Replaces a goal counter's beam config. A field left out or null goes back to the firmware default, and `{}` clears it. Returns 400 when a value is out of range or the device is a scoreboard. |
| POST | `/admin/devices/{deviceId}/reset` | → `DeviceResponse`. Forgets the device's secret and assignment, so it re-enrols as unclaimed on its next request. Use it after a device's storage was wiped (it then gets 401s). |
| GET | `/admin/device-enrolment-token` (Owner) | → `{ exists, createdAt }` |
| POST | `/admin/device-enrolment-token` (Owner) | → `{ token, createdAt }`. Creates or replaces the token. **The token is shown only once.** It goes into the devices' gitignored secrets file. |
| DELETE | `/admin/device-enrolment-token` (Owner) | → 204. Revokes the token. Devices that are already registered keep working. |
| GET | `/admin/cards?membershipId=` | → `AdminPlayerCardResponse[]` (oldest first; `membershipId` is optional) |
| DELETE | `/admin/cards/{cardId}` | → 204 |
| DELETE | `/admin/cards` (Owner) | → `{ deleted }`. Unlinks every card in the organization. |

### Shapes

```ts
type TableEnd = 'A' | 'B';
type TableMatchStatus = 'Live' | 'Finished' | 'Discarded' | 'Submitted';

TableResponse        { id, name, leagueId, endLabelA, endLabelB, soundVolume: 0 | 1 | 2 | 3,
                       scoreboardLeftEnd: TableEnd | null, hasScoreboard /* a claimed scoreboard is assigned */,
                       shortCode, tableUrl: string | null /* {base}/t/{shortCode} */, createdAt,
                       occupancy: TableOccupancyResponse }
TableOccupancyResponse { status: 'Unknown' | 'InUse' | 'JustFinished' | 'ProbablyInUse' | 'Free', since: string | null,
                       reason: 'Game' | 'Gathering' | 'TeamsMade' | 'LongPause' | 'DevicesAwake' | 'Touched'
                             | 'NoDevices' | 'LowBattery' | 'Offline' | null,
                       scoreA?, scoreB?, rosterCount?, rosterSize? }

StatValue            { value: number | null, n, minN, enough, low?, high? }
TableStatsResponse   { tableId, from, to, timeZone, officeHours: { days: string[] /* 'mon'.. */, start: 'HH:mm', end: 'HH:mm' },
                       games, averageGamesPerWeek: StatValue,
                       gamesPerDay: { date /* yyyy-MM-dd */, games, submitted, unclaimed }[],
                       weeks: { weekStart /* Monday */, fullWeek, games, submitted, unclaimed, utilisation: number | null }[],
                       busyHours: TableHeatmap, matchDurationS, utilisation: StatValue, utilisationIsLowerBound: boolean,
                       claimRate, claimRateLinked, claimRateUnlinked, endBias: StatValue,
                       dataQuality: { devices: { deviceId /* 'fb-…', as DeviceResponse */, role?, end?, goals,
                                                 undoRate, fastGapRate: StatValue, lowBatt, out }[],
                                      orphansOtherTable, orphansNoMatch, fragmentsPerWeek: number, discardedPerWeek: number,
                                      scorerPickRate: StatValue } }
TableHeatmap         { values: number[7][24], unit: 'busy_minutes' | 'busy_tables', n, minN,
                       weeksOfData: number /* fractional, 1 decimal */, enough }
TablesStatsOverviewResponse { from, to, timeZone, officeHours, games: StatValue, busyTables: TableHeatmap,
                       tables: { tableId, name, occupancy, games, gamesThisWeek, utilisation, utilisationIsLowerBound,
                                 matchDurationS }[],
                       allTablesBusy: { share: StatValue, longestS: number | null } }
UpsertTableRequest   { name (≤100), leagueId /* required, same org */, endLabelA? (≤12, blank = 'Red'), endLabelB? (≤12, blank = 'White'; ≠ A ignoring case),
                       soundVolume?: 0..3 /* omitted: unchanged, 2 on create */ }

LiveTableResponse    { table: TableResponse, version: number,
                       match: TableMatchResponse | null,          // null: none yet, or discarded
                       previousMatch: PreviousTableMatchResponse | null,  // last submitted, for "same players"
                       roster: TableRosterResponse | null,   // the scoreboard's scan-in line-up (see Scan-in)
                       devices: TableDeviceResponse[] }      // the table's claimed devices
TableDeviceResponse  { role: 'Goal' | 'Scoreboard', end?: TableEnd, lowBatt, lastSeenAt? /* offline after 36 h */,
                       beamHealth?: 'ok' | 'low_margin' | 'ambient_high' | 'blocked' | 'sensor_dead'
                       /* goal counters: the last status's beam.health; 'blocked' / 'ok' from beam_blocked on older firmware */ }
TableNewGameRequest  { save: boolean, expectedVersion }
TableRosterResponse  { leagueId, teamSize, players: TablePlayerResponse[] /* join order */, canGenerate }
TableMatchResponse   { id, tableId, status: TableMatchStatus, startedAt, endedAt?,
                       scoreA, scoreB, activeMatchId?, leagueId?,  // leagueId: linked match's, else table default
                       playersA: TablePlayerResponse[], playersB: TablePlayerResponse[],  // empty unless linked
                       lastGoal?: { id, end: TableEnd /* team credited */, scorerLeaguePlayerId?, occurredAt },
                       matchId?, claimableUntil?, autoSubmitAt? /* finished linked: rated automatically then */ }
PreviousTableMatchResponse { id, matchId, leagueId, playersA: TablePlayerResponse[], playersB: TablePlayerResponse[] }
TablePlayerResponse  { leaguePlayerId, displayName?, username?, color?: 0..5, colorHex?: '#rrggbb' }  // colour: scanned-in players

ClaimTableMatchRequest { teams?: { end: TableEnd, players: SubmitMatchPlayerRequest[] }[] }
LinkTableRequest       { tableId, teamIndexAtEndA?: 0 | 1 }   // which active-match team plays at end A

OrphanGoalResponse   { id, eventId, deviceId, tableId?, end?: TableEnd /* team it would have counted for */,
                       occurredAt?, receivedAt, reason: 'UnassignedDevice' | 'OtherTable' | 'NoMatch' }
ShortLinkResponse    { kind: 'Table' | 'Card', path, organizationId, orgSlug, leagueId, leagueSlug, tableId,
                       tableName, tableMatchId? /* claimable */, matchId? /* rated */, cardLinkExpiresAt? /* Card only */ }
SetTableShortCodeRequest { code?: string /* 3–32 of [a-z0-9-], case-insensitive; omitted = random */ }

MatchGoalsResponse     { tableMatchId, matchId?, tableName, canEdit /* player of the match, or Mod+ */,
                         goals: MatchGoalResponse[] }
MatchGoalResponse      { id, teamIndex: 0 | 1 /* credited */, at, scoreA, scoreB, scorerLeaguePlayerId?, ownGoal }
SetGoalScorerRequest   { leaguePlayerId: string | null }

LinkCardRequest        { code, membershipId? /* the badge's owner; omitted = the caller */ }
CardLinkedByResponse   { membershipId, displayName?, username? }
PlayerCardResponse     { id, createdAt, linkedBy: CardLinkedByResponse | null /* someone else linked it */, rosterResult? /* POST only: Joined | AlreadyIn | RosterFull | Locked | Busy | NoLeague */ }
AdminPlayerCardResponse { id, membershipId, displayName?, username?, linkedBy: CardLinkedByResponse | null, createdAt }

DeviceResponse       { id, deviceId /* fb-<12 hex> */, claimed, claimedAt?, role?: 'Goal' | 'Scoreboard',
                       tableId?, end?: TableEnd, lastSeenAt?, batteryMv?, lowBatt, firmwareVersion?,
                       lastStatusAt?, lastStatus? /* last status body as sent, snake_case */,
                       beamConfig?: BeamConfig /* null: all firmware defaults */, createdAt }
BeamConfig           { mode?: 'A' | 'ABoost' | 'B' | 'Auto', checkS? /* 0 off, 10–3600 */, settleMs? /* 1–20 */,
                       ambientMaxPct? /* 1–100 */, marginMin? /* 1–20 × */, driftPct? /* 0–100 */,
                       deadDeltaUa? /* 0–1000 */, deadChecks? /* 1–100 */, baselineMin? /* 0–1440 */,
                       reportS? /* 60–86400 */, ambientSwitchUa?, ambientReturnUa? /* 0–100 */,
                       modeMinDwellS? /* 0–86400 */, rPuAOhm?, rPuBOhm? /* 1000–10000000 */,
                       ledMa?: [number, number] /* [D9 LED, D10 boost] mA, 0.1–20 each */ }
AssignDeviceRequest  { role: 'Goal' | 'Scoreboard', tableId?, end?: TableEnd /* required with tableId */ }
```

Battery and heartbeat alerting live in the observability stack (OTLP metrics, see
`hardware/team/INTERFACES.md` §10). `lastSeenAt`, `batteryMv` and `lowBatt` are only there for the
admin view.
