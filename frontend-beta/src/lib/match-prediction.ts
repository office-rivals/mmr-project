import type {
  MatchPredictionResponse,
  PlayerPredictionResponse,
} from '@/api-v3';

export interface TeamOdds {
  index: number;
  /** Whole percent; the two teams always add up to 100. */
  winPercent: number;
  /** Null when a player on the team is still placing and their MMR is hidden. */
  averageMmr: number | null;
}

/** A player's MMR change if their team wins or loses. */
export interface Stake {
  win: number;
  lose: number;
}

export interface MatchOdds {
  teams: [TeamOdds, TeamOdds];
  /** The viewer's own stake, when they play in the match and have placed. */
  stake: Stake | null;
  /** The viewer plays this as a placement match, so it has no stake to show. */
  placement: boolean;
}

/** Null when there is no prediction to show, so callers can hide it whole. */
export function matchOdds(
  prediction: MatchPredictionResponse | null | undefined,
  leaguePlayerId?: string | null
): MatchOdds | null {
  const teams = [...(prediction?.teams ?? [])].sort(
    (a, b) => a.index - b.index
  );
  if (teams.length !== 2 || teams.some((t) => t.players.length === 0)) {
    return null;
  }

  // Round one side and give the other the rest, so the pair never shows 101%.
  const first = Math.round(teams[0].winChance * 100);
  const odds = teams.map((team, i) => ({
    index: team.index,
    winPercent: i === 0 ? first : 100 - first,
    averageMmr: averageMmr(team.players),
  })) as [TeamOdds, TeamOdds];

  const me = teams
    .flatMap((t) => t.players)
    .find((p) => leaguePlayerId != null && p.leaguePlayerId === leaguePlayerId);
  const stake =
    me?.mmr != null && me.mmrIfWin != null && me.mmrIfLose != null
      ? { win: me.mmrIfWin - me.mmr, lose: me.mmrIfLose - me.mmr }
      : null;

  return { teams: odds, stake, placement: me != null && stake == null };
}

// An average over only the visible MMRs would misstate the team, and with a
// teammate's MMR known it would give away the hidden one.
function averageMmr(players: PlayerPredictionResponse[]): number | null {
  const mmrs = players.map((p) => p.mmr);
  if (mmrs.some((mmr) => mmr == null)) return null;
  return Math.round(
    (mmrs as number[]).reduce((sum, mmr) => sum + mmr, 0) / mmrs.length
  );
}

/** `+11` / `−13`, with a true minus sign. */
export function formatMmrChange(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

export function formatStake(stake: Stake): string {
  return `Win ${formatMmrChange(stake.win)} · Lose ${formatMmrChange(stake.lose)}`;
}

/** What the viewer has riding on the match, or null when they don't play. */
export function stakeLabel(odds: MatchOdds): string | null {
  if (odds.stake) return formatStake(odds.stake);
  return odds.placement ? 'Placement match' : null;
}
