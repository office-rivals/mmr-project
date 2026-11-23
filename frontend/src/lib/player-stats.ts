import type {
  LeaderboardEntryResponse,
  LeagueRatingHistoryEntry,
  MatchResponse,
  MatchTeamPlayerResponse,
  MatchTeamResponse,
} from '@/api-v3';

export type Result = 'W' | 'L';

/**
 * Each player's ratings in history order, for a table of trend lines. One pass
 * over the league's history instead of filtering all of it once per row.
 */
export function ratingsByPlayer(
  history: LeagueRatingHistoryEntry[]
): Map<string, number[]> {
  const byPlayer = new Map<string, number[]>();
  for (const entry of history) {
    const ratings = byPlayer.get(entry.leaguePlayerId);
    if (ratings) ratings.push(entry.mmr);
    else byPlayer.set(entry.leaguePlayerId, [entry.mmr]);
  }
  return byPlayer;
}

export interface MatchOutcome {
  won: boolean;
  /** The player's own rating change, when the API reported one. */
  delta: number | null;
  myTeam: MatchTeamResponse;
  otherTeam: MatchTeamResponse;
}

/** The match from one player's side, or `null` when they did not play it. */
export function matchOutcome(
  match: MatchResponse,
  leaguePlayerId: string | null | undefined
): MatchOutcome | null {
  if (!leaguePlayerId) return null;
  const myTeam = match.teams.find((t) =>
    t.players.some((p) => p.leaguePlayerId === leaguePlayerId)
  );
  const otherTeam = match.teams.find((t) => t !== myTeam);
  if (!myTeam || !otherTeam) return null;
  const me = myTeam.players.find((p) => p.leaguePlayerId === leaguePlayerId);
  return {
    won: myTeam.isWinner,
    delta: me?.ratingDelta ?? null,
    myTeam,
    otherTeam,
  };
}

/** Results of the newest `count` matches, oldest first. Input is newest first. */
export function recentForm(
  matches: readonly MatchResponse[],
  leaguePlayerId: string,
  count = 10
): Result[] {
  const form: Result[] = [];
  for (const match of matches) {
    const outcome = matchOutcome(match, leaguePlayerId);
    if (!outcome) continue;
    form.push(outcome.won ? 'W' : 'L');
    if (form.length === count) break;
  }
  return form.reverse();
}

/** Streak label such as `W4` or `L2`; `null` before any match. */
export function streakLabel(
  entry: Pick<LeaderboardEntryResponse, 'winningStreak' | 'losingStreak'>
): string | null {
  if (entry.winningStreak > 0) return `W${entry.winningStreak}`;
  if (entry.losingStreak > 0) return `L${entry.losingStreak}`;
  return null;
}

export interface PartnerRecord {
  leaguePlayerId: string;
  displayName?: string;
  username?: string;
  wins: number;
  losses: number;
}

export function partnerWinRate(record: PartnerRecord): number {
  const total = record.wins + record.losses;
  return total > 0 ? record.wins / total : 0;
}

/** Fewer games than this says more about luck than about the pairing. */
export const MIN_PAIR_GAMES = 3;
/** Callouts are picked among this many most frequent teammates/opponents. */
export const TOP_PARTNERS = 5;

export interface PartnerSummary {
  /** Most frequent first (ties: most recent first), at most TOP_PARTNERS. */
  teammates: PartnerRecord[];
  opponents: PartnerRecord[];
  /** Best win rate together, with a winning record. */
  duo: PartnerRecord | null;
  /** Worst win rate against, with a losing record. */
  nemesis: PartnerRecord | null;
  /** Best win rate against, with a winning record. */
  favourite: PartnerRecord | null;
}

/**
 * The one definition of a player's frequent partners and of their best duo,
 * nemesis and favourite matchup, so every page that names them agrees. Picks
 * need MIN_PAIR_GAMES together and come from the listed TOP_PARTNERS, so a
 * callout always names someone in the list beside it.
 */
export function partnerSummary(
  matches: readonly MatchResponse[],
  leaguePlayerId: string
): PartnerSummary {
  const teammates = new Map<string, PartnerRecord>();
  const opponents = new Map<string, PartnerRecord>();
  const tally = (
    acc: Map<string, PartnerRecord>,
    player: MatchTeamPlayerResponse,
    won: boolean
  ) => {
    const record = acc.get(player.leaguePlayerId) ?? {
      leaguePlayerId: player.leaguePlayerId,
      displayName: player.displayName,
      username: player.username,
      wins: 0,
      losses: 0,
    };
    if (won) record.wins += 1;
    else record.losses += 1;
    acc.set(player.leaguePlayerId, record);
  };

  for (const match of matches) {
    const outcome = matchOutcome(match, leaguePlayerId);
    if (!outcome) continue;
    for (const p of outcome.myTeam.players) {
      if (p.leaguePlayerId !== leaguePlayerId) tally(teammates, p, outcome.won);
    }
    for (const p of outcome.otherTeam.players) tally(opponents, p, outcome.won);
  }

  const games = (r: PartnerRecord) => r.wins + r.losses;
  // Stable sort: equal counts keep first-seen order, i.e. most recent first.
  const top = (acc: Map<string, PartnerRecord>) =>
    [...acc.values()]
      .sort((a, b) => games(b) - games(a))
      .slice(0, TOP_PARTNERS);
  const pick = (rows: PartnerRecord[], dir: 1 | -1) =>
    rows
      .filter((r) => games(r) >= MIN_PAIR_GAMES)
      .sort(
        (a, b) =>
          dir * (partnerWinRate(b) - partnerWinRate(a)) || games(b) - games(a)
      )[0] ?? null;

  const topTeammates = top(teammates);
  const topOpponents = top(opponents);
  const duo = pick(topTeammates, 1);
  const nemesis = pick(topOpponents, -1);
  const favourite = pick(topOpponents, 1);
  return {
    teammates: topTeammates,
    opponents: topOpponents,
    duo: duo && duo.wins > duo.losses ? duo : null,
    nemesis: nemesis && nemesis.losses > nemesis.wins ? nemesis : null,
    favourite:
      favourite && favourite.wins > favourite.losses ? favourite : null,
  };
}

/** Share (0..1) of `others` strictly below `value`. */
export function shareBeaten(value: number, others: readonly number[]): number {
  if (others.length === 0) return 0;
  return others.filter((o) => o < value).length / others.length;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function winRate(
  entry: Pick<LeaderboardEntryResponse, 'wins' | 'losses'>
): number {
  const total = entry.wins + entry.losses;
  return total > 0 ? entry.wins / total : 0;
}

interface RatingPoint {
  mmr: number;
  playedAt: string;
}

/**
 * Rating change since `since`: the latest rating minus the last rating before
 * that moment (or the first rating in range when there is none before it).
 * `points` must be oldest first.
 */
export function ratingChangeSince(
  points: readonly RatingPoint[],
  since: number
): number | null {
  if (points.length === 0) return null;
  const latest = points[points.length - 1];
  if (Date.parse(latest.playedAt) < since) return 0;
  let baseline: RatingPoint | null = null;
  for (const point of points) {
    if (Date.parse(point.playedAt) >= since) break;
    baseline = point;
  }
  return latest.mmr - (baseline ?? points[0]).mmr;
}

export function peakRating<T extends RatingPoint>(
  points: readonly T[]
): T | null {
  let peak: T | null = null;
  for (const point of points) {
    if (!peak || point.mmr > peak.mmr) peak = point;
  }
  return peak;
}

/** The share of ranked players at or above `rank`, as a whole percent. */
export function topPercent(rank: number, rankedCount: number): number | null {
  if (rank < 1 || rankedCount < 1) return null;
  return Math.max(1, Math.round((rank / rankedCount) * 100));
}

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function matchesSince(
  matches: readonly MatchResponse[],
  since: number
): number {
  return matches.filter((m) => Date.parse(m.playedAt) >= since).length;
}

/** Every player's newest `count` results, oldest first. Input is newest first. */
export function formByPlayer(
  matches: readonly MatchResponse[],
  count = 5
): Map<string, Result[]> {
  const form = new Map<string, Result[]>();
  for (const match of matches) {
    for (const team of match.teams) {
      for (const player of team.players) {
        const results = form.get(player.leaguePlayerId) ?? [];
        if (results.length < count) results.push(team.isWinner ? 'W' : 'L');
        form.set(player.leaguePlayerId, results);
      }
    }
  }
  for (const results of form.values()) results.reverse();
  return form;
}

export interface ProfileRecords {
  /** Longest run of consecutive wins and the match that ended it. */
  longestWinStreak: { length: number; lastMatch: MatchResponse } | null;
  /** The win with the widest score margin. */
  biggestWin: { match: MatchResponse; for: number; against: number } | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  /** Wins where the other side did not score. */
  shutouts: number;
}

/** Score-based records for one player. Input is newest first. */
export function profileRecords(
  matches: readonly MatchResponse[],
  leaguePlayerId: string
): ProfileRecords {
  let longest: ProfileRecords['longestWinStreak'] = null;
  let run = 0;
  let biggest: ProfileRecords['biggestWin'] = null;
  let scored = 0;
  let conceded = 0;
  let played = 0;
  let shutouts = 0;
  for (const match of [...matches].reverse()) {
    const outcome = matchOutcome(match, leaguePlayerId);
    if (!outcome) continue;
    const { myTeam, otherTeam } = outcome;
    played += 1;
    scored += myTeam.score;
    conceded += otherTeam.score;
    if (!outcome.won) {
      run = 0;
      continue;
    }
    run += 1;
    if (!longest || run > longest.length) {
      longest = { length: run, lastMatch: match };
    }
    if (otherTeam.score === 0) shutouts += 1;
    const margin = myTeam.score - otherTeam.score;
    if (!biggest || margin > biggest.for - biggest.against) {
      biggest = { match, for: myTeam.score, against: otherTeam.score };
    }
  }
  return {
    longestWinStreak: longest,
    biggestWin: biggest,
    goalsFor: played > 0 ? scored / played : null,
    goalsAgainst: played > 0 ? conceded / played : null,
    shutouts,
  };
}

/** The day with the largest summed rating gain, keyed by `dayKey`. */
export function bestRatingDay(
  matches: readonly MatchResponse[],
  leaguePlayerId: string,
  dayKey: (playedAt: string) => string
): { key: string; playedAt: string; delta: number } | null {
  const days = new Map<string, { playedAt: string; delta: number }>();
  for (const match of matches) {
    const delta = matchOutcome(match, leaguePlayerId)?.delta;
    if (delta == null) continue;
    const key = dayKey(match.playedAt);
    const day = days.get(key) ?? { playedAt: match.playedAt, delta: 0 };
    day.delta += delta;
    days.set(key, day);
  }
  let best: { key: string; playedAt: string; delta: number } | null = null;
  for (const [key, day] of days) {
    if (day.delta > 0 && (!best || day.delta > best.delta)) {
      best = { key, ...day };
    }
  }
  return best;
}

export interface WeekChange {
  /** Summed rating deltas; `null` when no played match carried one. */
  delta: number | null;
  games: number;
}

/** Every player's rating change and games played since `since`. */
export function changeSince(
  matches: readonly MatchResponse[],
  since: number
): Map<string, WeekChange> {
  const changes = new Map<string, WeekChange>();
  for (const match of matches) {
    if (Date.parse(match.playedAt) < since) continue;
    for (const team of match.teams) {
      for (const player of team.players) {
        const change = changes.get(player.leaguePlayerId) ?? {
          delta: null,
          games: 0,
        };
        change.games += 1;
        if (player.ratingDelta != null) {
          change.delta = (change.delta ?? 0) + player.ratingDelta;
        }
        changes.set(player.leaguePlayerId, change);
      }
    }
  }
  return changes;
}

/** Wins among a player's results, the leaderboard's "Form" sort key. */
export function formWins(results: readonly Result[] | undefined): number {
  return (results ?? []).filter((r) => r === 'W').length;
}

export interface PartnerOption {
  leaguePlayerId: string;
  name: string;
  games: number;
}

/** Who the player has played with and against, most frequent first. */
export function partnerOptions(
  matches: readonly MatchResponse[],
  leaguePlayerId: string
): { teammates: PartnerOption[]; opponents: PartnerOption[] } {
  const tally = (
    acc: Map<string, PartnerOption>,
    p: MatchTeamPlayerResponse
  ) => {
    const option = acc.get(p.leaguePlayerId) ?? {
      leaguePlayerId: p.leaguePlayerId,
      name: p.username ?? p.displayName ?? 'Unknown',
      games: 0,
    };
    option.games += 1;
    acc.set(p.leaguePlayerId, option);
  };
  const teammates = new Map<string, PartnerOption>();
  const opponents = new Map<string, PartnerOption>();
  for (const match of matches) {
    const outcome = matchOutcome(match, leaguePlayerId);
    if (!outcome) continue;
    for (const p of outcome.myTeam.players) {
      if (p.leaguePlayerId !== leaguePlayerId) tally(teammates, p);
    }
    for (const p of outcome.otherTeam.players) tally(opponents, p);
  }
  const order = (acc: Map<string, PartnerOption>) =>
    [...acc.values()].sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name)
    );
  return { teammates: order(teammates), opponents: order(opponents) };
}

/** The player's matches alongside `withId` and against `againstId`. */
export function filterByPartners(
  matches: readonly MatchResponse[],
  leaguePlayerId: string,
  { withId, againstId }: { withId?: string; againstId?: string }
): MatchResponse[] {
  return matches.filter((match) => {
    const outcome = matchOutcome(match, leaguePlayerId);
    if (!outcome) return false;
    const has = (team: MatchTeamResponse, id: string) =>
      team.players.some((p) => p.leaguePlayerId === id);
    return (
      (!withId || has(outcome.myTeam, withId)) &&
      (!againstId || has(outcome.otherTeam, againstId))
    );
  });
}
