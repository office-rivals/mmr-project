import type { MatchPredictionResponse } from '@/api-v3';

export interface TeamOdds {
  index: number;
  /** Whole percent; the two teams always add up to 100. */
  winPercent: number;
  averageMmr: number;
}

/** A player's MMR change if their team wins or loses. */
export interface Stake {
  win: number;
  lose: number;
}

export interface MatchOdds {
  teams: [TeamOdds, TeamOdds];
  /** The viewer's own stake, when they play in the match. */
  stake: Stake | null;
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
    averageMmr: Math.round(
      team.players.reduce((sum, p) => sum + p.mmr, 0) / team.players.length
    ),
  })) as [TeamOdds, TeamOdds];

  const me = teams
    .flatMap((t) => t.players)
    .find((p) => leaguePlayerId != null && p.leaguePlayerId === leaguePlayerId);

  return {
    teams: odds,
    stake: me
      ? { win: me.mmrIfWin - me.mmr, lose: me.mmrIfLose - me.mmr }
      : null,
  };
}

/** `+11` / `−13`, with a true minus sign. */
export function formatMmrChange(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

export function formatStake(stake: Stake): string {
  return `Win ${formatMmrChange(stake.win)} · Lose ${formatMmrChange(stake.lose)}`;
}
