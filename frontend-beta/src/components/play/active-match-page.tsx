import { useState } from 'react';
import { FreeFormScoreInputs } from '@/components/free-form-score-inputs';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PageTitle } from '@/components/page-title';
import { LoserScoreStep } from '@/components/play/loser-score-step';
import { WinnerStep } from '@/components/play/winner-step';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  deriveLosingTeam,
  isScorePairComplete,
  loserScoreOptions,
} from '@/lib/scoring';
import { cn } from '@/lib/utils';
import type { ActiveMatchResponse } from '@/api-v3';

type TeamOption = 'team1' | 'team2';

interface ActiveMatchPageProps {
  activeMatch: ActiveMatchResponse;
  currentLeaguePlayerId: string | null;
  leagueWinningScore: number | null;
  formMessage: string | null;
  submitting: boolean;
  onSubmit: (scores: { team1Score: number; team2Score: number }) => void;
  onGoToStep: (hash: string) => void;
}

/**
 * Result entry for a matchmade game.
 *
 * The **wire format stays index-based** no matter how the UI is ordered:
 * `team1Score → teams[0]`, `team2Score → teams[1]`. Only the visual order and
 * the headings follow the current user's side.
 */
export function ActiveMatchPage({
  activeMatch,
  currentLeaguePlayerId,
  leagueWinningScore,
  formMessage,
  submitting,
  onSubmit,
  onGoToStep,
}: ActiveMatchPageProps) {
  const teams = [...(activeMatch.teams ?? [])].sort(
    (a, b) => a.index - b.index
  );

  const playerInTeam = (
    teamIndex: number,
    leaguePlayerId: string | null | undefined
  ) =>
    leaguePlayerId
      ? (teams[teamIndex]?.players.some(
          (p) => p.leaguePlayerId === leaguePlayerId
        ) ?? false)
      : false;

  // A spectator / non-participant falls back to team1, so they see "Your team"
  // over the wrong side — kept, because the submitted scores stay index-correct.
  const currentUserTeam: TeamOption = playerInTeam(0, currentLeaguePlayerId)
    ? 'team1'
    : playerInTeam(1, currentLeaguePlayerId)
      ? 'team2'
      : 'team1';
  const otherTeam: TeamOption = currentUserTeam === 'team1' ? 'team2' : 'team1';

  const teamPlayers = (which: TeamOption) =>
    which === 'team1' ? (teams[0]?.players ?? []) : (teams[1]?.players ?? []);

  // Reorder so the current player appears first within their team for clarity.
  const orderedPlayers = (which: TeamOption) => {
    const players = teamPlayers(which);
    if (which !== currentUserTeam) return players;
    const me = players.find((p) => p.leaguePlayerId === currentLeaguePlayerId);
    if (!me) return players;
    return [me, ...players.filter((p) => p !== me)];
  };

  const [team1Score, setTeam1Score] = useState(-1);
  const [team2Score, setTeam2Score] = useState(-1);

  const winningScore = leagueWinningScore;
  const isFreeForm = winningScore === null;
  const loserScores = loserScoreOptions(winningScore);
  const losingTeam = deriveLosingTeam(
    team1Score,
    team2Score,
    winningScore
  ) as TeamOption | null;
  const isPreviewVisible = isScorePairComplete(
    team1Score,
    team2Score,
    winningScore
  );

  // Only reachable from the fixed-target winner buttons; the null check narrows
  // the type and fails closed if that ever changes.
  const setWinner = (which: TeamOption) => {
    if (winningScore === null) return;
    if (which === 'team1') {
      setTeam1Score(winningScore);
      setTeam2Score(-1);
    } else {
      setTeam2Score(winningScore);
      setTeam1Score(-1);
    }
    onGoToStep('score-step');
  };

  const setLoserScore = (score: number) => {
    if (losingTeam === 'team1') setTeam1Score(score);
    else if (losingTeam === 'team2') setTeam2Score(score);
    onGoToStep('submit-step');
  };

  const orderForUi: [TeamOption, TeamOption] =
    currentUserTeam === 'team1' ? ['team1', 'team2'] : ['team2', 'team1'];

  const teamHeading = (which: TeamOption) =>
    which === currentUserTeam ? 'Your team' : 'Opponents';

  return (
    <>
      <div className="flex flex-col gap-8">
        <PageTitle>Submit match result</PageTitle>

        {formMessage ? (
          <Alert variant="destructive">{formMessage}</Alert>
        ) : null}

        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) return;
            onSubmit({ team1Score, team2Score });
          }}
        >
          <div className="flex gap-3">
            {orderForUi.map((which) => (
              <div className="flex flex-1 flex-col gap-2" key={which}>
                <h3 className="mb-2 text-center text-2xl">
                  {teamHeading(which)}
                </h3>
                {orderedPlayers(which).map((player) => (
                  <p
                    className={cn(
                      'text-center',
                      player.leaguePlayerId === currentLeaguePlayerId &&
                        'text-primary'
                    )}
                    key={player.leaguePlayerId}
                  >
                    {player.displayName ?? player.username ?? 'Unknown'}
                  </p>
                ))}
              </div>
            ))}
          </div>

          {/* Unlike the submit page this is not gated on player selection —
              the roster is fixed by matchmaking. */}
          {!isFreeForm ? (
            <WinnerStep
              weDisabled={
                (currentUserTeam === 'team1' ? team1Score : team2Score) ===
                winningScore
              }
              theyDisabled={
                (otherTeam === 'team1' ? team1Score : team2Score) ===
                winningScore
              }
              onWeWon={() => setWinner(currentUserTeam)}
              onTheyWon={() => setWinner(otherTeam)}
            />
          ) : null}

          {losingTeam ? (
            <LoserScoreStep
              possessive={losingTeam === currentUserTeam ? 'your' : 'their'}
              options={loserScores}
              selected={losingTeam === 'team1' ? team1Score : team2Score}
              onPick={setLoserScore}
            />
          ) : null}

          {isFreeForm ? (
            <div id="free-form-score-step" className="mt-6 flex flex-col gap-4">
              <h2 className="text-center text-4xl">
                What was the final score?
              </h2>
              {/* ⚠️ Labels are computed for the raw team indices while the
                  player columns above use `orderForUi`, so a user on team 2
                  sees their column first but the left input labelled
                  "Opponents". Ported as-is — fixing it means changing both
                  together. */}
              <FreeFormScoreInputs
                team1Label={teamHeading('team1')}
                team2Label={teamHeading('team2')}
                team1Score={team1Score}
                team2Score={team2Score}
                onTeam1ScoreChange={setTeam1Score}
                onTeam2ScoreChange={setTeam2Score}
              />
            </div>
          ) : null}

          {isPreviewVisible ? (
            <div id="submit-step" className="mt-6 flex flex-col gap-4">
              <h2 className="text-center text-4xl">Submit?</h2>
              <div className="text-center text-2xl">
                {teamHeading(currentUserTeam)}:{' '}
                {currentUserTeam === 'team1' ? team1Score : team2Score} {' – '}{' '}
                {otherTeam === 'team1' ? team1Score : team2Score} :{' '}
                {teamHeading(otherTeam)}
              </div>
              <Button type="submit" disabled={submitting}>
                Submit the match
              </Button>
            </div>
          ) : null}
        </form>
      </div>

      <LoadingOverlay isLoading={submitting} message="Uploading match result" />
    </>
  );
}
