import type {
  LeaderboardEntryResponse,
  MatchResponse,
  MatchTeamPlayerResponse,
  MatchTeamResponse,
} from '@/api-v3';

export type Result = 'W' | 'L';

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

/**
 * Teammate the player wins most with and opponent they lose most to, among
 * people they have met at least `minGames` times. Ties go to the larger sample.
 */
export function bestDuoAndNemesis(
  matches: readonly MatchResponse[],
  leaguePlayerId: string,
  minGames = 3
): { duo: PartnerRecord | null; nemesis: PartnerRecord | null } {
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

  const eligible = (acc: Map<string, PartnerRecord>) =>
    [...acc.values()].filter((r) => r.wins + r.losses >= minGames);
  const games = (r: PartnerRecord) => r.wins + r.losses;

  const duo =
    eligible(teammates).sort(
      (a, b) => partnerWinRate(b) - partnerWinRate(a) || games(b) - games(a)
    )[0] ?? null;
  const nemesis =
    eligible(opponents).sort(
      (a, b) => partnerWinRate(a) - partnerWinRate(b) || games(b) - games(a)
    )[0] ?? null;

  return {
    duo: duo && duo.wins > 0 ? duo : null,
    nemesis: nemesis && nemesis.losses > nemesis.wins ? nemesis : null,
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
