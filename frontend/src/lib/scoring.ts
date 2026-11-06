// Shared scoring-mode logic for the match submission flows (submit page and
// active-match page) so the two can't drift apart. A league's winningScore is
// null for free-form scoring (raw scores, higher wins) or a fixed target the
// winner must reach exactly. Score state uses -1 as the "not entered yet"
// sentinel; 0 is a valid score.

export type TeamSide = 'team1' | 'team2';

// Mirrors the API's sanity ceiling on match scores
// (LeagueService.MaxWinningScore).
export const MAX_SCORE = 255;

export function loserScoreOptions(winningScore: number | null): number[] {
  return winningScore === null
    ? []
    : Array.from({ length: winningScore }, (_, i) => i);
}

// In fixed-target leagues exactly one side's score equals winningScore; that
// identifies the loser whose 0..(winningScore - 1) picker is shown next. In
// free-form leagues there's no "losing slot" — both scores are entered
// directly and the server decides who won from the magnitudes.
export function deriveLosingTeam(
  team1Score: number,
  team2Score: number,
  winningScore: number | null
): TeamSide | null {
  if (winningScore === null) return null;
  if (team1Score === winningScore) return 'team2';
  if (team2Score === winningScore) return 'team1';
  return null;
}

export function isScorePairComplete(
  team1Score: number,
  team2Score: number,
  winningScore: number | null
): boolean {
  if (winningScore === null) {
    return team1Score >= 0 && team2Score >= 0 && team1Score !== team2Score;
  }
  return (
    deriveLosingTeam(team1Score, team2Score, winningScore) !== null &&
    team1Score !== -1 &&
    team2Score !== -1
  );
}
