# Performance metrics from the goal counters

Until now a match was a result: who played, who won, the final score, the rating change. The goal
counters add **a timeline**: every goal, its time and the team it counted for. When players scanned in,
we also get **who scored**, and that includes own goals. This document lists the metrics this makes
possible, for players and for matches, and says exactly how to compute each one.

It is a spec, not code. Backend and admin-ui build the ones the user picks.
[`example.py`](example.py) is a stdlib reference implementation of the core formulas. It runs the worked
example in §7 and checks the numbers quoted there (`python3 example.py`).

**Contents:** 1 Data and shared rules · 2 Own goals · 3 Catalogue · 4 Who contributed most · 5 Data gaps
· 6 Recommended first set · 7 Worked example · 8 Tables (in use, table stats) · Appendix: maths

**Decided (user, 2026-10-15):**
- **G1 yes.** Setting and fixing a goal's scorer in the app is being built (backend + admin-ui).
- **Own goals are playful only:** player profile, match page and an "Own goal of the month" (O2). No
  own-goal leaderboard.
- **Finished-screen line yes:** `9:26 · MVP Alice` (§6).
- **Positions (G3) later.** Contribution stays "based on goals" for now.

---

## 1. The data and the rules every metric shares

### 1.1 What we have (checked in the code)

| Source | Fields that matter |
|--------|--------------------|
| `TableGoal` | `ScoringEnd` (the team credited), `ReceivedAt` (server clock), `OccurredAt` (device clock; null until NTP sync), `Seq` (per device, never reused), `UndoneAt`, `ScorerLeaguePlayerId`, `TableMatchId`, `OrphanReason` |
| `TableMatch` | `Status` (Live / Finished / Discarded / Submitted), `StartedAt`, `EndedAt`, `ScoreA/B`, `ActiveMatchId` (linked = has players on the board), `MatchId` (the rated `V3Match` once submitted) |
| `V3Match` + `MatchTeam` + `MatchTeamPlayer` | `Source` (`Table` for these), `PlayedAt`, team `Index`, `Score`, `IsWinner`, players |
| `RatingHistory` | per player per match: `Mu`, `Sigma`, `Mmr` and `Delta` **after** the match |
| `League` | `TeamSize` (1 or 2), `WinningScore` (e.g. 10; null = free-form) |

What it does **not** give, and what follows from the code:

- **No kickoff time.** A table match is usually created by its first goal, so `StartedAt` is the first
  goal's receipt time. When it is created earlier ("New game", rematch, made teams), `StartedAt` is when
  the button was pressed, not when play began. Time before the first goal is unknown (gap G4).
- **`EndedAt` isn't the last goal.** It is set by the winning goal, but also by "Save", by a table going
  to sleep (2 min idle) or by the 30-minute timeout. Use the last counted goal instead.
- **Scorers exist only on linked matches** (scan-in or a match linked in the app), because only then
  does the board know the names. Even there they are optional: the "Who scored?" window lasts 15 s
  (SCOREBOARD-UI 08). A match claimed afterwards in the app has players but **no scorers**. The board
  says a scorer "can be fixed in the app", but no app endpoint does that yet (gap G1, decided: being built).
- **1v1 skips "Who scored?"**, so the scorer of a normal goal is obvious but not stored, and a 1v1 own
  goal can't be recorded at all (gap G1).
- **No positions.** In 2v2 we don't know who played defence (goalie + 2-bar) and who played attack.
- **Ratings ignore the margin.** `mmr-api` passes the score to OpenSkill only to rank the teams; 10:9
  and 10:0 move ratings the same. Goal metrics are the first place margin shows up.

### 1.2 Which matches count

| Tier | Matches | Gives |
|------|---------|-------|
| 0 | every `V3Match` (any source) | result, score, teams, ratings: partner and rival records, form |
| 1 | `V3Match.Source = Table`, its `TableMatch.Status = Submitted` | + the goal timeline: tempo, momentum, clutch, rating-adjusted goal share |
| 2 | tier 1 and the table match was linked (`ActiveMatchId` set while live), or 1v1 | + scorers: individual scoring, own goals, contribution |
| — | finished/expired **unclaimed** table matches | timeline without players: **table** statistics only (pace, end bias, data quality) |

Never count `Discarded` table matches (thrown away, including the 0:0 restarts of a discarded linked
game) or orphan goals (`OrphanReason` set, `TableMatchId` null). Player metrics are per **league**
(ratings are per league). Aggregating one person across leagues goes through
`LeaguePlayer.OrganizationMembershipId`, but don't mix their ratings.

### 1.3 Counted goals and teams

A goal **counts** when `UndoneAt IS NULL` and it belongs to an eligible match. An undone goal vanishes
from every metric, including its scorer pick. (Undo always removes the latest goal by `ReceivedAt`,
even after the match finished. The match then goes back to Live.)

**End → team.** A submitted table match always stores **end A as `MatchTeam.Index = 0`** (claim orders
the teams by end; a linked submit passes end A's team first). So the team credited with a goal is the
`MatchTeam` with `Index = (ScoringEnd = 'A' ? 0 : 1)`. Sides can't change after the first goal
(`swap_sides` is only allowed at 0:0), so this holds for the whole match.

```sql
-- Pseudo-SQL: counted goals of rated table matches, with the team credited and the team conceding.
CREATE VIEW counted_goals AS
SELECT g.id, g.table_match_id, tm.match_id, g.scorer_league_player_id AS scorer,
       g.received_at, g.occurred_at, g.device_id, g.seq,
       CASE g.scoring_end WHEN 'A' THEN 0 ELSE 1 END AS for_index,
       CASE g.scoring_end WHEN 'A' THEN 1 ELSE 0 END AS against_index
FROM table_goals g
JOIN table_matches tm ON tm.id = g.table_match_id AND tm.status = 'Submitted'
WHERE g.undone_at IS NULL AND g.orphan_reason IS NULL;
```

Sanity check before computing anything from a timeline: the counted goals per end must equal
`MatchTeam.Score`. If not (e.g. a bug, or a manual fix), use the match for tier-0 metrics only.

### 1.4 The goal's time

`ReceivedAt` is the authoritative clock for **which match** a goal belongs to, but it carries network
delay: the first goal after a pause can arrive 0.5–1.2 s late (TLS handshake), and a goal queued while
offline arrives minutes late. For **gaps between goals** use this event time `t`:

```
t = OccurredAt   if OccurredAt is set and -2 s ≤ ReceivedAt − OccurredAt ≤ 60 s   (synced device, normal delay)
t = OccurredAt   if OccurredAt is set and ReceivedAt − OccurredAt > 60 s          (queued goal: the server
                                                                                   placed it by OccurredAt too)
t = ReceivedAt   otherwise                       (not yet synced, or a device clock running ahead)
```

Order goals by `t`, then by `(DeviceId, Seq)`, then `ReceivedAt`. The two ends are two devices with two
clocks, so a cross-end gap mixes clocks. With NTP that error is tens of milliseconds, which doesn't
matter at foosball speeds. Report times in whole seconds.

A ball has to be fetched from the drawer and put back into play, so two real goals are rarely **less
than ~3 s apart**. A shorter gap is almost always a double count. It is usually undone, and if not it is
flagged for data quality (Q1), but it still counts, because the score counted it.

### 1.5 Words used below

- **n**: counted goals in the match. **W**: the league's winning score.
- **Span**: time from the first to the last counted goal. **Gap**: time between consecutive goals.
- **Score state** `a:b`: team A's and team B's score just **before** a goal.
- **Goal share** of a team: its goals ÷ n.
- **Expected goal share `p`**: the share of goals the ratings predict for a team (Appendix A2). It is
  also the probability that any one goal goes to that team.
- **Win probability (WP)**: chance a team wins from a score state, given `p` (Appendix A1).
- **Shrunk rate**: a player's rate pulled towards the league average until there is enough data
  (Appendix A3). Every player rate below is shown shrunk.

---

## 2. Own goals

**Detection.** A counted goal is an **own goal** when its scorer plays for the team that **conceded**
it:

```
own_goal(g) = g.scorer IS NOT NULL
              AND g.scorer ∈ players of MatchTeam[against_index(g)]
```

On the board, players record one by picking a name from the conceding side on "Who scored?"
(SCOREBOARD-UI 08: "Picking a player of the other team records an own goal"). `ScoringEnd` stays the
team credited, so the score is never affected by the pick.

**How an own goal counts in every metric:**

| Metric family | Own goal treatment |
|---------------|--------------------|
| Score, tempo, momentum, WP, team goal share | A normal goal **for the credited team**. The score counted it. |
| Individual goals (I1) | **Not** a goal for anyone. It doesn't count for the player who touched it, and the credited team didn't score it. |
| Own goals (O1) | +1 for the player who scored it. |
| Contribution (§4) | −1 for the own-goaler **alone** (instead of the conceded goal being shared by their team), and +½ for each player of the credited team (shared, as nobody there earned it). |
| Impact (C5) | The same split, weighted by the goal's ΔWP. |
| Scorer coverage (I2) | Counts as a **known** scorer (we know who it was). |
| Decisive goal (C4) | Reported as "won by an own goal by …". The winners get no individual credit. |

**1v1:** the board skips "Who scored?", so a 1v1 goal's scorer is **inferred** as the credited team's
only player, unless an own goal is recorded. Until G1 ships (decided, being built), nobody can record a
1v1 own goal, so 1v1 own-goal counts are always 0. Show 1v1 own goals only once G1 exists.

**Pitfalls.** Own goals are under-reported: nobody likes picking their own name. In 2v2 a goal with
**no scorer** may well be an own goal. So an own-goal rate is only meaningful against goals with a known
scorer, and never a hard number. **Decided (user):** own goals are shown playfully only, on the player
profile, the match page and as an "Own goal of the month" (O2). There's **no own-goal leaderboard**,
because it would turn into shaming.

---

## 3. Catalogue

Each metric: **What** it tells you · **For** player (P), match (M) or table (T) · **Tier** (§1.2) ·
**How** · **Show when** (minimum sample) · **Watch out**.

### A. Tempo

#### T1 Match length
- **What:** How long the match took, from the first to the last goal.
- **For:** M; P (median length of your matches); T (typical length per table).
- **Tier:** 1, and unclaimed matches for T.
- **How:** `span = t(last counted goal) − t(first counted goal)`. Show as m:ss.
- **Show when:** n ≥ 2. Player median after 5 matches.
- **Watch out:** It excludes the time to the first goal (no kickoff time, G4). Call it "first to last
  goal", not "duration", until G4 exists. A long pause mid-match (someone took a call) inflates it.
  Cap any gap at 5 min and mark the match "paused".

#### T2 Pace
- **What:** How fast goals come: seconds per goal.
- **For:** M; P (your matches' median pace); T.
- **Tier:** 1.
- **How:** `pace = span / (n − 1)` (the mean gap). Also show the **median gap**, which a single long
  pause doesn't skew.
- **Show when:** n ≥ 6 (5 gaps).
- **Watch out:** Pace is style and table, not skill: a slow, possession-heavy pair plays long gaps.
  Compare a player's pace only within one table. Exclude flagged gaps (< 3 s, > 5 min).

#### T3 Longest drought
- **What:** The longest wait between two goals, and who broke it.
- **For:** M; P ("you broke the longest drought in 4 matches").
- **Tier:** 1 (scorer: 2).
- **How:** `max(gap_i)`; the goal ending it gives the team (and scorer, if known).
- **Show when:** n ≥ 6.
- **Watch out:** As T2: pauses. Ignore gaps > 5 min.

#### T4 Time to first goal
- **What:** How long the opening took.
- **For:** M.
- **Tier:** blocked. Needs a kickoff time (G4). With G4: `t(first goal) − KickoffAt`.

#### T5 Tempo shift
- **What:** Did the match speed up or slow down towards the end?
- **For:** M; P (do your matches tighten up late?).
- **Tier:** 1.
- **How:** split the gaps at the middle goal. `shift = median(late gaps) / median(early gaps)`. Below
  0.8 = "sped up", above 1.25 = "slowed down" (nerves, careful play at game point).
- **Show when:** n ≥ 10.
- **Watch out:** Noisy. It is a match curiosity, not a player trait, unless there are many matches.

### B. Momentum and comebacks

#### M1 Score flow, lead changes and ties
- **What:** How the lead went back and forth.
- **For:** M.
- **Tier:** 1.
- **How:** replay the counted goals in order. **Tie** = a goal that levels the score (0:0 isn't
  counted). **Lead change** = a goal after which the leader is the other team than the **last** team
  that led (the first lead isn't a change). Plot the running difference `a − b` against goal number or
  `t`.
- **Show when:** always (the chart). The numbers need n ≥ 6.
- **Watch out:** None. It is a pure description.

#### M2 Biggest comeback / blown lead
- **What:** The largest deficit the winner came back from.
- **For:** M; P: **comeback wins** (won after trailing by ≥ 3) and **blown leads** (lost after leading by
  ≥ 3).
- **Tier:** 1.
- **How:** `comeback = max over the match of (loser's score − winner's score)`. For a player: count
  matches with `comeback ≥ 3` won, and with the mirror lost. Show as "3 comebacks, 1 blown lead".
- **Show when:** M always (if > 0). P after 10 table matches.
- **Watch out:** 3 goals is a meaningful gap to W = 10. For other winning scores use
  `≥ ceil(0.3 × W)`.

#### M3 Runs and blitzes
- **What:** The longest string of unanswered goals, and bursts of quick goals.
- **For:** M; P (longest run your team made).
- **Tier:** 1.
- **How:** **run** = maximal sequence of consecutive goals credited to one team; report its length,
  team, and score before and after. **Blitz** = ≥ 3 goals by one team within 60 s (by `t`).
- **Show when:** run ≥ 3; blitz any.
- **Watch out:** A blitz needs reliable `t`. Skip a blitz that includes a goal timed by `ReceivedAt`
  after a long gap (it could be delayed).

#### M4 Time in the lead
- **What:** The share of the match each team spent in front.
- **For:** M; P (average lead share, a "control" stat).
- **Tier:** 1.
- **How:** between consecutive goals the state is "A leads", "B leads" or "tied". Add up the gap
  lengths per state and divide by the span. The time before the first goal is unknown, so it isn't
  counted.
- **Show when:** n ≥ 6.
- **Watch out:** Mixes tempo and score. Fine for a match, weak as a player trait.

#### M5 Answer rate
- **What:** After conceding, how often does your team score the next goal?
- **For:** P (and the team per match).
- **Tier:** 1.
- **How:** over all counted goals conceded by the player's team (except the match's last goal):
  `answer_rate = (# where the next goal is your team's) / (# conceded)`. Compare with the expected
  share `p` of those matches: `answer_rate − mean(p)` tells you whether you bounce back better than your
  rating says.
- **Show when:** 50 conceded goals.
- **Watch out:** In theory goals are close to independent, so expect small effects. Don't sell it as
  "resilience" before the data shows a real spread between players.

### C. Pressure and clutch

These need a fixed `WinningScore`. Skip them in free-form leagues.

#### C1 Win-probability timeline and upsets
- **What:** Each team's chance to win after every goal, given their ratings and the score.
- **For:** M; P (upset wins, upset losses).
- **Tier:** 1.
- **How:** pre-match win probability `P0` from OpenSkill (Appendix A2); turn it into a per-goal
  probability `p`; after each goal `WP = race(a, b, p)` (Appendix A1). Show a line chart.
  - **Upset** when the winner's `P0 < 0.40`.
  - **Lowest point**: the winner's minimum WP. "They came back from 8 %" is the headline of a comeback.
- **Show when:** always for matches with a winning score.
- **Watch out:** The model treats goals as coin flips with a fixed `p`. That is good enough for a story
  chart, not for betting. New players (high `Sigma`) give probabilities close to 50 %, which is correct
  (we don't know them yet).

#### C2 Excitement
- **What:** How much the match swung, as one number.
- **For:** M; L (the most exciting match of the week).
- **Tier:** 1.
- **How:** `excitement = Σ over goals |WP_after − WP_before|` (for either team; it's the same). A
  match where the eventual winner's chance only ever rises scores below 1. A back-and-forth match
  scores 2–4.
- **Show when:** with C1.
- **Watch out:** It rewards long matches slightly (more goals = more movement). It is fine for ranking
  matches with the same W.

#### C3 Game points
- **What:** How a team handles game point: converting their own, saving the opponent's.
- **For:** M; P (game-point saves, chances needed to close).
- **Tier:** 1 (who saved/converted: 2).
- **How:** a team is **on game point** when its score is `W − 1` before a goal.
  - **Converted**: the goal is theirs.
  - **Saved**: the opponent scores while the team is on game point. The scorer gets the save credit.
  - Player stats: `game-point saves` (count), and `closing rate = matches won / game-point chances
    taken`.
- **Show when:** match facts always. Player rates after 20 game-point situations.
- **Watch out:** Small numbers: one match gives 1–3 situations.

#### C4 Decisive goal and clutch goals
- **What:** Who scored the winner, and who scores when the match is tight and late.
- **For:** M (decisive goal); P (clutch goals).
- **Tier:** 2 (team-level without scorers: 1).
- **How:** **decisive goal** = the last counted goal (it reached W). **Clutch goal** = a goal where,
  before it, both scores were ≥ `W − 3` and the difference was ≤ 1. Player: `clutch share = clutch goals
  scored / clutch goals by their team` (unknown scorers split equally, like §4).
- **Show when:** decisive goal always (with "scorer unknown" or "own goal by …"). Clutch share after 15
  clutch goals for the team.
- **Watch out:** Attackers score more of everything, clutch included (no positions, G3).

#### C5 Impact (win probability added)
- **What:** How much each player's goals moved their team's chance to win. A goal at 9:9 counts far more
  than one at 2:8.
- **For:** P (per match and summed); M (most impactful player and goal).
- **Tier:** 2 (team-level: 1).
- **How:** the goal's value is `v = |ΔWP|` for the team credited. Then split exactly like the
  contribution score (§4) with `v` in place of 1. A team's impact sums to `result − P0` (1 − P0 for a
  win, −P0 for a loss), so impact is "how much better than expected, and who made it so".
- **Show when:** with the contribution score (§4) coverage rule.
- **Watch out:** The last goal is worth a lot (it ends the race), so impact favours whoever scores
  late. Show it next to the contribution score, never alone.

### D. Individual scoring

#### I1 Goals and goal share
- **What:** How many goals you scored, and your share of your team's goals.
- **For:** P; M.
- **Tier:** 2.
- **How:** `goals = counted goals with scorer = you and not own_goal`. Per match:
  `team_share = goals / your team's counted goals`. Over time: goals per match, and
  `share = Σ goals / Σ team goals with a known scorer` (only goals where we know who scored, so unknown
  goals don't count against you).
- **Show when:** per match if the team's coverage ≥ 60 %. Player totals after 20 attributed team goals.
- **Watch out:** In 2v2 the attacker scores most goals. A low share doesn't mean a weak defender
  (G3). Self-reported: a player can pick themselves. The opponents see the pick on the board, which
  keeps people honest.

#### I2 Scorer coverage
- **What:** How much of the scoring data is filled in. Show it next to every individual metric.
- **For:** M; P; L; T.
- **Tier:** 2.
- **How:** per team per match: `coverage = goals credited to the team with a scorer / goals credited to
  the team` (own goals count as known). Per player: the same over their matches.
- **Show when:** always.
- **Watch out:** Low coverage on one table usually means the scoreboard is hard to reach. That's a
  ux signal, not a player one.

#### I3 Contribution score
See §4. It is the answer to "who contributed most".

#### I4 Hat-trick
- **What:** Three of your team's goals in a row, all yours.
- **For:** M (a match fact); P (count).
- **Tier:** 2.
- **How:** in a team's goal sequence (its goals only, opponents' goals ignored), 3 consecutive goals
  with the same scorer. An unknown scorer breaks the run.
- **Show when:** any.
- **Watch out:** It's just for fun.

### E. Own goals

#### O1 Own goals (player)
- **What:** How often you put the ball in your own goal.
- **For:** P.
- **Tier:** 2 (2v2 only until G1).
- **How:** `own_goals = Σ own_goal(g) with scorer = you`.
  `own_goal_rate = own_goals / goals your team conceded with a known scorer × 100` ("per 100 goals
  conceded").
- **Show when:** the count always. The rate after 50 known-scorer goals conceded.
- **Watch out:** Under-reported (§2). A defender is far more likely to score one than an attacker
  (G3).

#### O2 Own goals in the match
- **What:** Own goals listed on the match, and whether one decided it.
- **For:** M.
- **Tier:** 2.
- **How:** list `own_goal(g)` with scorer and score. **Decided by an own goal**: the decisive goal (C4)
  was one. **Costliest own goal**: the one with the largest |ΔWP|. **Own goal of the month** (league
  page, playful): the league's costliest own goal that calendar month, shown with its match. No ranking
  of players.
- **Show when:** any.
- **Watch out:** See §2 on tone.

### F. Partnerships and rivalries

#### P1 Partner chemistry
- **What:** Does this pair play better together than each does with others?
- **For:** P (best and worst partner).
- **Tier:** 1 (goal-based). Tier 0 gives a win-only version.
- **How:** for each match the pair played together, take the team's **goal share over expected** (R1):
  `gsoe = actual share − p`. Then
  `chemistry(X,Y) = mean gsoe(X with Y) − ½ × (mean gsoe(X with others) + mean gsoe(Y with others))`.
  Goal-weighted means, shrunk (A3).
- **Show when:** 5 table matches together, and each player has 5 without the other.
- **Watch out:** Pairs that play often are usually friends of similar level, so there's little spread
  between them. Don't show "worst partner" by name if the user wants to avoid friction; show "best
  partner" only.

#### P2 Scoring split
- **What:** Who carries the scoring in a pair.
- **For:** P (per partner).
- **Tier:** 2.
- **How:** `split = your goals / (your goals + partner's goals)` over matches together (known scorers
  only).
- **Show when:** 20 attributed goals together.
- **Watch out:** It mostly shows who plays attack (G3). It's a role tendency, not a quality measure.

#### P3 Head-to-head and nemesis
- **What:** Your record against a specific opponent, adjusted for strength.
- **For:** P.
- **Tier:** 0 for wins; 1 for goals.
- **How:** over matches where X and Z were on opposite teams: wins–losses, goal difference, and
  `mean gsoe` for X's team. **Nemesis** = the opponent with the lowest shrunk mean gsoe;
  **favourite opponent** = the highest.
- **Show when:** 5 meetings.
- **Watch out:** In 2v2 the partners in those meetings vary. With few meetings, one partner can drive
  the result.

### G. Form and consistency

#### F1 Form
- **What:** How you've been playing lately, relative to your rating.
- **For:** P; L ("in form" list).
- **Tier:** 1.
- **How:** exponentially weighted mean of per-match gsoe, half-life 10 matches:
  `form = Σ w_i·gsoe_i / Σ w_i`, `w_i = 0.5^(age_i / 10)`, `age_i` = matches since (0 = latest). Show as
  ▲ / ▼ / steady with a ±3 percentage-point band.
- **Show when:** 8 table matches in the last 60 days.
- **Watch out:** The rating already chases form, so a player in form is a player whose rating is about
  to rise. That's fine: form shows it first.

#### F2 Consistency
- **What:** Steady or streaky?
- **For:** P.
- **Tier:** 1.
- **How:** standard deviation of per-match gsoe over the last 30 table matches. Compare with the
  league's typical value: below = "steady", above = "streaky".
- **Show when:** 15 table matches.
- **Watch out:** Pure noise is large (a 19-goal match has a standard deviation in goal share of about
  ±11 points by chance alone). Only show a label when it clearly differs from that chance level.

### H. Endurance and context

#### E1 Sessions: warm-up and fatigue
- **What:** Do you get better or worse over a run of back-to-back matches?
- **For:** P; L.
- **Tier:** 1.
- **How:** a **session** = a player's matches in a row with less than 15 min between the end of one (last
  goal) and the first goal of the next. Number them 1, 2, 3+ within the session. `gsoe by position` =
  mean gsoe of the player's matches at each position. "Warms up" if 2 and 3+ beat 1; "tires" if 3+ is
  worst.
- **Show when:** 10 sessions with ≥ 3 matches.
- **Watch out:** Winners stay on the table ("king of the table"), so later matches are played against
  people who chose to keep going. Losers leave. That's selection bias. Gsoe corrects for the
  opponents' ratings, which helps but doesn't remove it.

#### E2 Starter or closer
- **What:** Do you play better early or late in a match?
- **For:** P.
- **Tier:** 1.
- **How:** split each match at the first goal that brings either team to `ceil(W/2)`. Goal share
  over expected in each half: `gsoe_early`, `gsoe_late`; report the difference over many matches.
- **Show when:** 20 table matches.
- **Watch out:** In a single match the halves are only ~10 goals each. This is a long-run trait.

#### E3 Time of day and weekday
- **What:** When you play best.
- **For:** P; L (when the office plays).
- **Tier:** 0 (wins) / 1 (gsoe).
- **How:** group by local hour bucket (before 11, 11–14, 14–17, after 17) and weekday of the first
  goal; mean gsoe per bucket. The local time zone is the organization's.
- **Show when:** 8 matches in a bucket.
- **Watch out:** Many buckets means some look special by chance. Show only the best bucket, and only
  if it beats the others by more than the noise (A3).

#### E4 Table and end effects
- **What:** Are some tables or ends easier?
- **For:** T; P (your best table).
- **Tier:** T: unclaimed matches too. P: 1.
- **How:** **end bias** of a table: `share of counted goals credited to end A` over all its matches,
  with a 95 % interval (Appendix A3). Player: mean gsoe per table.
- **Show when:** T: 30 matches. P: 8 matches per table.
- **Watch out:** A strong end bias that appears suddenly is usually a **sensor fault** (one goal counter
  missing goals or double-counting). Send it to admins as a data-quality alert, not as a fun fact.

### I. Rating-adjusted performance

#### R1 Goal share over expected (gsoe)
- **What:** Did you score more of the goals than the ratings predicted? The core "played above your
  level" number, and it works without scorers.
- **For:** P; M (per team); L ("over-performers").
- **Tier:** 1.
- **How:** per match per team: `gsoe = team goals / n − p`, where `p` is the team's expected goal share
  from the pre-match ratings (Appendix A2). Both players of a team get the team's gsoe. Over many
  matches use a **goal-weighted** mean: `Σ (team goals − p·n) / Σ n`. Show as percentage points
  ("+4.1").
- **Show when:** per match always; player after 10 table matches (shrunk).
- **Watch out:** It is a team number given to each player. In 2v2 a strong partner lifts you, but `p`
  includes the partner's rating, so that's already priced in.

#### R2 Margin-aware rating (future)
- **What:** A rating that learns from every goal, not just the result.
- **For:** P.
- **Tier:** 1.
- **How:** fit player strengths so that predicted goal shares match observed ones across all matches
  (Appendix A4). A 10:9 match then moves ratings far less than a 10:0.
- **Show when:** not as a first-version metric. It's a research track that could one day feed MMR.
- **Watch out:** Changing what MMR means is a product decision for the user, not a statistic.

### J. Data quality (admin and observability)

#### Q1 Undo rate and suspicious gaps
- **What:** Is a goal counter double-counting or missing goals?
- **For:** T (per device).
- **Tier:** all table matches, unclaimed included.
- **How:** `undo_rate = undone goals / all goals` per device per week. `fast_gaps` = counted goals less
  than 3 s after the previous one at the **same** end. Alert when undo rate > 10 %, or on fast gaps
  that weren't undone.
- **Show when:** 30 goals.
- **Watch out:** An undo can also be a disputed goal, not a sensor fault. Look at fast gaps together
  with undos.

#### Q2 Claim and scorer-pick rates
- **What:** How much of the play ends up rated, and with scorers.
- **For:** T; L.
- **How:** `claim_rate = submitted / (submitted + expired finished)` table matches per week.
  `pick_rate` = I2 coverage over linked matches.
- **Watch out:** None. These are product health numbers. They fit the observability dashboards.

---

## 4. Who contributed most

### 4.1 Contribution score

Each counted goal is worth **+1 to the team credited and −1 to the team conceding**. It is split
between players like this:

| The goal | Credited team | Conceding team |
|----------|---------------|----------------|
| Scored by player X (normal goal) | **+1 to X** | −1 shared equally |
| Scorer unknown | +1 shared equally | −1 shared equally |
| Own goal by player Y (on the conceding team) | +1 shared equally | **−1 to Y** |

`contribution(X) = Σ of X's parts over the match` ("shared equally" = ½ each in 2v2, all of it in 1v1).

Why it is fair, and robust:

- **It adds up.** A team's contributions sum to its goal difference, so the score explains the
  contribution, and nobody gets credit the scoreboard didn't give.
- **Missing data is neutral.** An unknown scorer splits the goal equally, so with no scorer picks at all
  teammates get the same score, and every pick moves them apart only by what was recorded. Partial
  coverage can't make anyone look worse than their teammate. It can only fail to separate them.
- **Defence is shared.** We don't know who was in goal (G3), so goals conceded are split equally rather
  than blamed on a guessed defender. The only individual blame is an own goal, the one case where we
  know who touched the ball.
- **1v1 needs nothing.** The scorer is inferred, so contribution = goal difference.

### 4.2 Top contributor (MVP) of a match

- **2v2 only.** In 1v1 the winner is trivially the top contributor.
- Name the **highest contribution**. On a tie, the higher impact (C5) wins. If that's tied too, it's
  shared.
- Show it only when **at least 70 % of the match's goals have a known scorer**. Otherwise show "not
  enough scorer picks", which also nudges players to pick.
- Show **impact** next to it: "most goals" and "biggest moments" are different questions. In the
  worked example (§7) Alice scored the most, but Bob's late goals moved the result most.

### 4.3 What we can't know

- **Positions** (who defended): a defender's value is goals **prevented**, and we only see goals.
  Contribution therefore reads as **scoring contribution**. Say so in the UI ("based on goals").
- **Saves, shots, possession, passes/assists**: not observable. The sensor is in the ball drawer, so it
  sees the ball only after the goal.
- **Shot speed**: not measurable either. The beam times the ball rolling down the drawer, so the slope
  sets the speed, not the shot.
- **Who touched it last on unknown goals**, and whether players **swapped positions** mid-match.

### 4.4 What small additions would unlock

- **Position per player (G3, decided: later):** a role-fair contribution. Defenders are judged on goals conceded while
  in goal, attackers on goals scored, each against the league average for that role. It also gives
  "best defensive partner" and role-specific form.
- **Fixing scorers in the app (G1, decided: being built):** contribution for claimed (unlinked) matches and 1v1 own goals.
- **Goal type (which rod) (G6):** "goalie goals" vs "5-bar goals". Recording it by hand on every goal
  would cost more than it gives.

---

## 5. Data gaps and cheap additions, ranked by value ÷ cost

| # | Addition | Value | Cost | What it unlocks |
|---|----------|-------|------|-----------------|
| G1 ✅ decided, building | **App: set or fix a goal's scorer after the fact**, for any table match incl. submitted ones (goal list on the match page, pick a player or "own goal by …"). Today only the device can `assign_scorer`, and only on Live/Finished matches. | High | Low (one endpoint + a list in admin-ui) | Scorers on claimed matches; 1v1 own goals; corrections. The board already tells players this exists. |
| G2 | **Pre-match rating on `RatingHistory`** (`MuBefore`, `SigmaBefore`), or a view that takes the previous row | Medium | Low (one migration, set at rating time) | Every rating-adjusted metric (R1, C1, C5, F1, P1) without a fragile "previous row" query. |
| G3 ⏸ decided: later | **Position per player in 2v2** (`MatchTeamPlayer.Position`: Defence / Attack / unknown), set on the Teams screen or in the app, plus an optional mid-match "switched" flag | High | Medium (ux + firmware + backend) | Role-fair contribution; defender stats; it's the most common question in office foosball ("who's better in goal?"). |
| G4 | **Kickoff time** (`TableMatch.KickoffAt`): the first table motion after the match was created or the previous one ended. The goal counters already wake on motion. | Medium | Medium (firmware reports the wake time; backend stores it) | T4 and a true match duration. |
| G5 | **Store the inferred 1v1 scorer** | Low | None (compute it, §2) | Nothing new. Just compute it. |
| G6 | Goal type / rod, entered by hand | Low | High | Shooting-style stats. Not worth it now. |
| — | Shot speed, saves, possession | — | Not possible with a drawer sensor | — |

---

## 6. Recommended first set

Five per side. They are chosen so most of them work **without** scorer picks, and the ones that need
picks show coverage.

| Metric | Tier | Player profile | Match page | Scoreboard Finished | League page |
|--------|------|:-:|:-:|:-:|:-:|
| **R1** Goal share over expected | 1 | ✓ headline "+4.1 vs rating" | per team | – | over-performers (top 5) |
| **I3** Contribution score + **I1** goals (with I2 coverage) | 2 | goals/match, net contribution | per player, MVP (§4.2) | ✅ `9:26 · MVP Alice` (decided) | top scorers |
| **O1** Own goals | 2 | count | own goals listed (O2) | – | "Own goal of the month" only, **no leaderboard** (decided) |
| **M2** Comebacks / blown leads | 1 | "3 comebacks · 1 blown lead" | – | – | comeback kings |
| **P1/P3** Best partner + nemesis | 1 | ✓ | – | – | – |

| Metric | Tier | Match page | Scoreboard Finished | Player profile | League page |
|--------|------|:-:|:-:|:-:|:-:|
| **T1/T2/T3** Length, pace, longest drought | 1 | ✓ | in the line (decided) | median length | fastest match |
| **M1/M3** Score flow chart: lead changes, ties, longest run | 1 | ✓ chart | – | – | – |
| **I3/O2** Top contributor and own goals | 2 | ✓ | (as above) | – | – |
| **C1/C2** Win-probability chart, upset badge, excitement | 1 | ✓ chart + badge | – (one line only) | upset wins | match of the week |
| **C3/C4** Decisive goal and game-point saves | 1/2 | ✓ | – | game-point saves | – |

**Finished-screen line (decided):** one short line, `<length> · MVP <name>`, e.g. `9:26 · MVP Alice`.
Length is T1 (first to last goal, m:ss). The MVP follows §4.2. When there's no MVP (1v1, less than 70 %
scorer coverage, or the line is shown before picks are in), show the length alone. The Finished screen is
1-bit e-paper with little room (SCOREBOARD-UI 12), so ux places it. **Decided (lead):** the scoreboard state
carries structured fields, `duration_s` (T1, whole seconds) and `mvp_name` (§4.2, null when there's no
MVP). Firmware formats the line (`m:ss` plus ` · MVP <name>` when the name is set), so it can be
localised later. Note the timing: Finished appears after the winning goal's who-scored pick (or 15 s), so the
last pick is in when the line is computed. A later fix in the app (G1) doesn't redraw a board that has
gone to sleep.

Build order for backend: the counted-goals view and event time (§1.3–1.4), own-goal flag (§2),
expected goal share (A2), then the metrics. Everything is derived. **No new tables are needed for the
first set** (G2 only makes it simpler).

---

## 7. Worked example

A 2v2 match to 10. **Alice + Bob** play at end A (team A), **Carol + Dave** at end B (team B).
(Placeholder names.)

**Pre-match ratings** (μ, σ): Alice (27, 3.0), Bob (24, 4.0), Carol (28, 3.0), Dave (26, 3.5).
Team A μ = 51, team B μ = 54.
`P0(A wins) = Φ((51 − 54) / √(2·(25/6)² + 3² + 4² + 3² + 3.5²)) = 0.369`. Team B is favoured.
The per-goal probability that matches it is `p(A) = 0.462` (Appendix A2), so A's **expected goal share
is 46.2 %**.

**Timeline** (`t` = seconds after the first goal; kickoff unknown). 20 goal events: one is undone and 19
count.

| # | t | Credited | Scorer | Score | WP(A) after | \|ΔWP\| |
|--:|--:|:-:|---|:-:|--:|--:|
| 1 | 0:00 | B | Carol | 0:1 | 0.29 | 0.081 |
| 2 | 0:38 | B | Dave | 0:2 | 0.21 | 0.076 |
| – | 0:40 | B | – | *undone*: 2 s after #2, a double count; **excluded everywhere** | | |
| 3 | 1:11 | A | Alice | 1:2 | 0.29 | 0.077 |
| 4 | 1:35 | B | Carol | 1:3 | 0.21 | 0.081 |
| 5 | 2:10 | B | Carol | 1:4 | 0.14 | 0.070 |
| 6 | 2:32 | B | *unknown* (15 s window passed) | 1:5 | 0.08 | 0.056 |
| 7 | 3:21 | A | Bob | 2:5 | 0.13 | 0.046 |
| 8 | 3:56 | A | **Dave — own goal** | 3:5 | 0.20 | 0.067 |
| 9 | 4:20 | A | Alice | 4:5 | 0.29 | 0.092 |
| 10 | 5:01 | B | Dave | 4:6 | 0.19 | 0.103 |
| 11 | 5:22 | A | Alice | 5:6 | 0.28 | 0.099 |
| 12 | 5:44 | A | Alice | 6:6 | 0.42 | 0.134 |
| 13 | 6:19 | A | *unknown* | 7:6 | 0.58 | 0.165 |
| 14 | 7:01 | B | Carol | 7:7 | 0.43 | 0.154 |
| 15 | 7:30 | B | Carol | 7:8 | 0.26 | 0.171 |
| 16 | 8:02 | A | Bob | 8:8 | 0.44 | 0.185 |
| 17 | 8:23 | A | Alice | 9:8 | 0.71 | 0.267 |
| 18 | 9:00 | B | Dave | 9:9 | 0.46 | 0.249 |
| 19 | 9:26 | A | Bob | **10:9** | 1.00 | 0.538 |

Goal #8 is an own goal: Dave plays for team B, which conceded it (§2). It counts for team A's score, for
nobody's goal tally, and −1 on Dave's contribution.

### Match metrics

| Metric | Value | Working |
|--------|-------|---------|
| T1 Length | **9:26** | 566 s from #1 to #19 |
| T2 Pace | **31.4 s/goal**, median gap 32.5 s | 566 / 18 gaps |
| T3 Longest drought | **49 s**, broken by Bob (#7) | 2:32 → 3:21 |
| M1 Lead changes / ties | **3 / 4** | B→A at 7:6, A→B at 7:8, B→A at 9:8; ties at 6:6, 7:7, 8:8, 9:9 |
| M2 Biggest comeback | **4 goals** (A from 1:5) | max (B − A) = 4 |
| M3 Longest run | **3** (B to 1:5; A to 4:5; A to 7:6) | – |
| M4 Time in the lead | A 14 %, B 66 %, tied 20 % | A 79 s, B 376 s, tied 111 s of 566 |
| C1 Upset | **yes**: the winner's P0 = 36.9 %; lowest point **8 %** at 1:5 | Appendix A1 |
| C2 Excitement | **2.71** (a back-and-forth match) | Σ \|ΔWP\| |
| C3 Game points | A on game point at 9:8 (saved by **Dave**), converted at 9:9 | – |
| C4 Decisive goal | **Bob** at 9:26 | #19 |
| O2 Own goals | Dave at 3:56 (3:5), \|ΔWP\| 0.067 | – |
| I2 Coverage | A 9/10 = 90 %, B 8/9 = 89 %; match 17/19 = 89 % ≥ 70 % → MVP shown | own goal counts as known |
| R1 Goal share over expected | A: 10/19 − 0.462 = **+6.4 pts**; B: −6.4 pts | – |

### Player metrics for this match

| Player | Goals (I1) | Own goals | Contribution (§4) | Impact (C5) |
|--------|--:|--:|--:|--:|
| Alice | 5 | 0 | 5 + ½ + ½ − 9×½ = **+1.5** | +0.265 |
| Bob | 3 | 0 | 3 + ½ + ½ − 9×½ = **−0.5** | **+0.366** |
| Carol | 5 | 0 | 5 + ½ − 9×½ = **+1.0** | −0.217 |
| Dave | 3 | 1 | 3 + ½ − 9×½ − 1 = **−2.0** | −0.414 |

Contribution working for Alice: +5 for her goals, +½ for the unknown #13, +½ for Dave's own goal (shared
by A), and −½ for each of the 9 goals A conceded (none of them an own goal by A).
Dave: +3 for his goals, +½ for the unknown #6, −½ for each of the 9 A goals that weren't his own goal,
and −1 for his own goal.

Checks (asserted in `example.py`): A's contributions sum to +1 = 10 − 9; B's to −1. A's impact sums to
0.631 = 1 − 0.369 (won as underdog); B's to −0.631.

**MVP: Alice** (+1.5, the highest contribution). On impact, **Bob** leads, because he scored the
equaliser at 8:8 and the winner. This is why §4.2 shows both. Note that Carol, on the losing side,
out-contributed Bob: she scored 5 of B's 9 goals. Both players of team A get **R1 +6.4 pts** and an
**upset win**, and they count a **comeback win** (M2, from −4). Carol and Dave count a **blown lead**.

---

## 8. Tables

Two questions from the user: **is a table in use right now**, and **how much is each table used**.
Both are built from signals the devices already send. No new device traffic and no firmware change are
needed.

### 8.1 What the server can see

| Signal | Where | What it means |
|--------|-------|---------------|
| Live match, its goals, `LastActivityAt` | `table_matches`, `table_goals` | Play is happening. The strongest signal. |
| Roster entries (`CreatedAt`) | `table_roster_entries` | People are gathering at the scoreboard (lobby or made teams). |
| Scoreboard `LastSeenAt` | `devices` (live only) | Refreshed by every long-poll while the board is awake: at most every ~25 s (`wait` ≤ 60 s, retry backoff ≤ 30 s). The board wakes on table motion or a key and sleeps `idle_timeout_s` (300 s) after the last motion/key. |
| Goal counter `LastSeenAt` | `devices` (live only) | One config pull per wake (on table motion), then a request per goal. Nothing in between. |
| Last status (`reason`, `uptime_ms`, `LastStatusAt`) | `devices` (last one only) | `sleep`: the wake ended. Wake session = `[LastStatusAt − uptime_ms, LastStatusAt − idle_timeout_s]`. `heartbeat`: a timer wake, **not use**. `cutoff`/`wrong_board`: the device is out. |

A status is best effort and never retried, so a `sleep` can go missing. Every rule below has a timeout
fallback.

### 8.2 Occupancy: the live state of a table

**Device awake** (for one device, now = `t₀`):

- The last request **wasn't a status**: `LastStatusAt < LastSeenAt − 2 s`, or there's no status.
- **Scoreboard:** and `LastSeenAt ≥ t₀ − 90 s` (it long-polls while awake, so silence means asleep or
  offline).
- **Goal counter:** and `LastSeenAt ≥ t₀ − (idle_timeout_s + 60 s)`. It is silent while awake without
  goals, so after that window we can't tell sustained motion from a lost `sleep` status, and we count it
  as asleep.
- Devices with `cutoff` or `wrong_board` as last status, or silent for > 36 h, are **out**: they give no
  evidence.

**Awake since** (`AwakeSince`): the first request after a device's last status. Today only the last
request time is stored. Backend can keep a nullable `Device.AwakeSince`: set it in the auth handler when
the previous request was a status, or the silence before it was longer than that device's awake
window (scoreboard 90 s, goal counter `idle_timeout_s + 60 s`; a flat limit would restart a goal
counter's wake mid-game, since it is silent between goals). Clear it on a status. It's a backend-only
change (cheap addition U-a below).

**States**, checked in this order. The first one that matches wins:

| State | Shown as | Rule | Confidence |
|-------|----------|------|------------|
| `unknown` | "Status unknown" (+ battery/offline hint) | The table has no assigned goal counter, or every assigned device is out. | – |
| `in_use` | **In use since 12:41** (+ score if live) | (a) a live match with ≥ 1 counted goal and `LastActivityAt ≥ t₀ − 5 min`; or (b) a non-empty roster, and either its newest entry is ≤ 10 min old or the scoreboard is awake ("Gathering: 2 of 4"); or (c) a live linked 0:0 match created ≤ 10 min ago with the scoreboard awake ("Teams made"). | high |
| `just_finished` | "Just finished 10:7 · free soon" | No `in_use`. The newest table match is Finished or Submitted, its **last counted goal** is ≤ 3 min old, and at least one device is awake. | high |
| `probably_in_use` | "Probably in use since 12:41" | No `in_use` or `just_finished`, and either (d) the scoreboard has been awake for longer than `idle_timeout_s + 60 s` (so motion or keys kept it awake beyond a single bump), or (e) a live match whose last activity is 5–15 min old with a device awake (a long pause). | medium |
| `free` | **Free** | Anything else, including a `touched` table: a device woke < `idle_timeout_s + 60 s` ago with no goal, roster or match. The UI may add a faint "someone's nearby" dot. It never shows as busy. | – |

**In use since** = the earliest of: the live match's first counted goal, the roster's first `CreatedAt`,
and the `AwakeSince` of an awake device. A device's `AwakeSince` only counts if it's at most 15 min
before the others, so a board left awake by passers-by doesn't backdate a game. For `probably_in_use` it
is the scoreboard's `AwakeSince`. Without U-a it falls back to the first goal or roster entry.

**Windows, with their reasons:**

| Window | Value | Why |
|--------|-------|-----|
| Live match counts as play | last activity ≤ 5 min | 10× the median gap (~30 s, §7). Longer than any normal pause between goals. |
| Long pause still "probably" | 5–15 min | Someone took a call. The live-match timeout (30 min) closes it later anyway. |
| `just_finished` | 3 min after the last goal | Long enough for the claim/rematch moment, shorter than the 5-min idle sleep, so it usually ends before the devices sleep. |
| Scoreboard awake | `LastSeenAt` ≤ 90 s | 60 s maximum long-poll plus 30 s maximum retry backoff. |
| Bump vs. use | awake > `idle_timeout_s + 60 s` | A bump wakes the device for exactly the idle timeout. Anything longer means more motion or presses. |
| Roster still "gathering" | newest entry ≤ 10 min | The roster itself is cleared after 30 min idle. 10 min is the "still arriving" part. |

**Edge cases:**

- **One goal counter asleep** (a quiet end can miss light motion): the table uses **any** evidence, so a
  device that sleeps never makes the table free by itself. A goal from either end is in-use evidence
  even if the other devices are asleep.
- **Bumped while walking past:** every device wakes for exactly `idle_timeout_s`, with no goal and no
  roster. That's `touched`, shown as Free. In history (8.3), a wake whose session is shorter than 60 s
  after removing the idle timeout is a **bump** and isn't counted as use (a goal in it is still covered
  by its v1 match interval).
- **Dead battery:**
  - Scoreboard dead: goals still give `in_use`. A lobby is impossible (scans need the board), and
    `probably_in_use` is impossible (no long-poll).
  - Both goal counters dead: only the board's wake gives `probably_in_use`.
  - Everything dead: `unknown`. Never show a table with dead devices as Free. Show the battery hint.
- **Lost `sleep` status:** the scoreboard times out after 90 s of silence. A goal counter times out
  after `idle_timeout_s + 60 s`.
- **Heartbeat wake** (night timer): a status with `reason: heartbeat` ends it at once, so it's never
  awake for occupancy.
- **Wi-Fi down at the table:** the devices can't report, so the table looks free while people play.
  That can't be fixed live. Queued goals arrive later with `occurred_at` and repair the **history** (8.3
  uses event times).
- **Cleaner or someone leaning on it for minutes:** sustained motion gives `probably_in_use`, never
  `in_use`. That's why it's "probably".

### 8.3 Table history: when was it in use

Utilisation and the heatmap need **busy intervals** per table.

- **v1, today (match-based):** for every table match with ≥ 1 counted goal (any status, **Discarded
  included**: a thrown-away game was still played): `[t(first goal) − 60 s, t(last goal) + 60 s]`. The
  60 s before covers kickoff and the opening rally (the time to the first goal is unknown, G4). The 60 s
  after covers the end of the game. Merge overlapping intervals per table. This **undercounts** play
  without the goal counters (warm-ups, games where nobody scored yet).
- **v2 (cheap addition U-b, recommended now):** backend stores one row per `sleep` status:
  `device_wakes(device_id, table_id, woke_at = LastStatusAt − uptime_ms, idle_from = LastStatusAt −
  idle_timeout_s)`. Busy intervals = union over the table's devices of `[woke_at, idle_from]`, dropping
  bumps (`idle_from − woke_at < 60 s`, with or without a goal: v1 covers any goal), unioned with the v1 intervals. Start
  storing now: wake history can't be rebuilt later. A lost `sleep` status loses that session; the v1
  intervals still cover any goals in it.

**Time zone:** none is stored per organization, so stats take the **viewer's IANA zone** as a query
parameter (backend's proposal). Hours and days are bucketed in that zone. **Office hours** default to
Mon–Fri 08:00–18:00 in that zone. An org-level time zone and office hours setting would make
utilisation the same for every viewer. It's cheap addition U-c, needed once offices span time zones.

### 8.4 Table stats

The day of a game = the local date of its first counted goal. "Last N weeks" = whole weeks
before today.

**A game** (for counting) = a table match that is **Submitted**, or **Finished and unclaimed with ≥ 5
counted goals or a winner who reached the winning score**. Fewer goals and never claimed = a fragment (a
test ball, an abandoned start). Fragments and Discarded matches aren't games. They're shown in
data quality (TS7) only.

#### TS1 Games per day / week
- **What:** How much each table is played.
- **How:** count games per table per local day and per ISO week, split into **logged** (Submitted)
  and **not logged** (Finished, unclaimed). Also the total over all tables.
- **Show when:** from the first game. Trend arrows (this week vs the 4-week average) after 4 full weeks.
- **Shows on:** tables overview ("23 games this week"), table page (bar chart over the page's window, logged
  stacked on unlogged).

#### TS2 Busiest hours (heatmap)
- **What:** When the table is busy, to find a free slot.
- **How:** grid of weekday (Mon–Sun) × hour (0–23, local). Cell = **average busy minutes** in that
  hour = (busy minutes from 8.3 that fall in that weekday-hour over the window) ÷ (number of such
  weekday-hours in the window). Window: last 8 weeks (the page passes it as the request's `from`; every stat uses the request's
  `[from, to)`, default 30 days). Colour 0–60 min. A second view of all tables
  together shows "how many tables are busy on average".
- **Show when:** 4 full weeks of data and ≥ 30 games on the table. Before that: "Not enough data yet".
- **Shows on:** table page; tables overview (all tables combined).
- **Watch out:** Holidays flatten a week. Fine at 8 weeks.

#### TS3 Average match length
- **What:** How long a game takes on this table.
- **How:** **median** of T1 (first to last goal, gaps capped at 5 min) over the table's games that
  reached the winning score, last 30 days. Also show the middle half (25th–75th percentile) as a range.
  Median, because one paused game would drag a mean.
- **Show when:** 10 such games in the window.
- **Shows on:** table page ("a game takes ~9 min"), tables overview.
- **Watch out:** It's first-to-last goal (G4), so a real game is ~1 min longer. Say "about".

#### TS4 Utilisation
- **What:** The share of office hours the table is busy.
- **How:** `utilisation = busy minutes (8.3) inside office hours / office-hour minutes in the period`.
  Show it per week. v1 intervals undercount, so label it "≥ 23 %" until v2 rows exist.
- **Show when:** 1 full week.
- **Shows on:** tables overview (this week, per table); table page (weekly line over the page's window).
  The table page uses one window for all its stats, default **8 weeks** (TS2's minimum for a steady
  heatmap), with 4 / 8 / 12 to pick; 12 weeks gives the longer utilisation trend. One fetch, no
  per-stat windows.
- **Watch out:** Office hours are an assumption (8.3). Lunchtime peaks matter more than the average:
  TS2 shows them.

#### TS5 Claim rate
- **What:** How many played games end up logged.
- **How:** over games whose claim window has **closed** (submitted, or `EndedAt` older than
  `ClaimWindowDays`): `claim_rate = submitted / games`. Split by **linked** (players scanned in or
  linked in the app; confirmed on the board or auto-submitted) and **unlinked** (claimed in the app).
- **Show when:** 20 closed games.
- **Shows on:** admin table page; Q2 dashboard (observability). Not for players.

#### TS6 End bias
Is E4, per table: share of counted goals credited to end A with a Wilson interval (A3). **Show when:**
30 games. **Shows on:** admin table page, plus a data-quality alert when the interval excludes 50 % and
the last 7 days differ sharply from the 8 weeks before (a sensor fault more than a slanted table).

#### TS7 Data quality per table
Is Q1/Q2 per table and device:
- undo rate and fast gaps (< 3 s, same end) per goal counter;
- orphan goals per table (`OtherTable`, `NoMatch`);
- fragments and Discarded matches per week;
- scorer pick rate (I2) on linked games;
- devices out (8.2) and `low_batt`.

**Show when:** 30 goals per device for rates; out/low battery always. **Shows on:** admin table page;
alerts belong in the observability stack.

#### TS8 All tables busy
- **What:** Does the office need another table?
- **How:** the share of office hours during which **every** table had a busy interval (8.3) at once.
  Also the longest such stretch in the week.
- **Show when:** 2 full weeks, ≥ 2 tables.
- **Shows on:** tables overview, admin only.

### 8.5 Cheap additions for tables

| # | Addition | Cost | Unlocks |
|---|----------|------|---------|
| U-a | `Device.AwakeSince` (set and cleared in the auth handler and status) | Low, backend only | "In use since" from the wake; `probably_in_use` (d) |
| U-b | `device_wakes` rows from `sleep` statuses | Low, backend only | v2 busy intervals: utilisation including play without goals, bump filtering. **Start now**, history can't be backfilled. |
| U-c | Org time zone + office hours | Low | The same utilisation for every viewer |

---

## Appendix: maths

### A1 Win probability from a score state

Treat each goal as an independent coin flip that team A wins with probability `p`. From score `a:b`, A
needs `x = W − a` more goals and B needs `y = W − b`. A wins if it scores its `x`-th goal before B
scores `y`, i.e. after conceding `k = 0 … y−1`:

```
race(a, b, p) = Σ_{k=0}^{y−1}  C(x−1+k, k) · p^x · (1−p)^k        (race = 1 if a ≥ W; 0 if b ≥ W)
```

`WP_A` after a goal = `race(new a, new b, p)`; `WP_B = 1 − WP_A`. With W = 10 that's at most 10 terms.

### A2 Expected goal share from ratings

1. Each player's **pre-match** (μ, σ): their previous `RatingHistory` row in the league (by
   `V3Match.PlayedAt`), or the default (25, 25/3) for a first match. G2 would store it directly.
2. **Pre-match win probability**, exactly as OpenSkill's `PredictWin` (go-openskill `rating/predict.go`)
   computes it for two teams: `P0 = Φ((Σμ_A − Σμ_B) / √(2β² + Σσ_A² + Σσ_B²))` with `β = 25/6`, and `Φ`
   the standard normal CDF. Backend can call the library instead of re-implementing it.
3. **Per-goal probability** `p`: the value with `race(0, 0, p) = P0`, found by bisection (60 steps;
   `race` increases with `p`). This `p` is the team's **expected goal share**.

The simple shortcut "share = P0" would be wrong: a 60 % favourite in a race to 10 needs only ~53 % of
the goals. Calibrating with `race` keeps goal share and winning consistent.

Later, with a few hundred table matches, check the calibration: bucket matches by `p` and compare with
the actual goal shares. If the ratings turn out over- or under-confident about goals, fit one scale
factor `p' = Φ(s · Φ⁻¹(p))`.

### A3 Small numbers: shrinkage and intervals

- **Shrunk rate** (Bayesian average): `shrunk = (x + k·m) / (n + k)`, where `x` = successes, `n` =
  trials, `m` = league average, and `k` = the prior weight (use `k` = the "show when" minimum for that
  metric). Small samples stay near average and earn their way out.
- **Shrunk mean of gsoe**: `Σ(team goals − p·n) / (Σ n + k_goals)` with `k_goals = 100` (≈ 5 matches).
- **Chance-level spread** of a goal share over `n` goals: `√(p(1−p)/n)`. That's ±11 points for 19
  goals, ±3.5 points over 200 goals. Don't label a player "streaky" or a bucket "special" when the
  difference is within twice this.
- **95 % interval for a proportion** (end bias, rates): Wilson interval
  `(x̂ + z²/2n ± z√(x̂(1−x̂)/n + z²/4n²)) / (1 + z²/n)`, z = 1.96, x̂ = x/n.

### A4 Margin-aware strength (R2, research only)

Model every goal as a contest between the two lines-up:
`P(goal to A) = logistic(Σ_{i∈A} s_i − Σ_{j∈B} s_j)`. Fit `s` by ridge-regularised logistic regression
over all counted goals (each goal is one row: +1 for A's players, −1 for B's, label = 1 if A scored).
A match then contributes ~19 rows instead of 1 result, so strengths settle in far fewer matches. The
ridge penalty plays the role of σ. Refit nightly. It's comparable to MMR, but it isn't MMR.
