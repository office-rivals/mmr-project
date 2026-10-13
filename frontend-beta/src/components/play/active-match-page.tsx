import { Fragment, useState } from 'react';
import { FreeFormScoreInputs } from '@/components/free-form-score-inputs';
import { LoadingOverlay } from '@/components/loading-overlay';
import { PageTitle } from '@/components/page-title';
import { LoserScoreStep } from '@/components/play/loser-score-step';
import { StepHeading } from '@/components/play/step-heading';
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

  // Match the reference's team-one fallback for non-participants.
  const currentUserTeam: TeamOption = playerInTeam(0, currentLeaguePlayerId)
    ? 'team1'
    : playerInTeam(1, currentLeaguePlayerId)
      ? 'team2'
      : 'team1';
  const otherTeam: TeamOption = currentUserTeam === 'team1' ? 'team2' : 'team1';

  const teamPlayers = (which: TeamOption) =>
    which === 'team1' ? (teams[0]?.players ?? []) : (teams[1]?.players ?? []);

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

  const previewText = `${teamHeading(currentUserTeam)}: ${
    currentUserTeam === 'team1' ? team1Score : team2Score
  } \u00a0–\u00a0 ${
    otherTeam === 'team1' ? team1Score : team2Score
  } : ${teamHeading(otherTeam)}`;

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-green-400 uppercase">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-green-400 motion-safe:animate-pulse"
            />
            Live match
          </p>
          <PageTitle>Submit match result</PageTitle>
        </div>

        {formMessage ? (
          <Alert variant="destructive">{formMessage}</Alert>
        ) : null}

        <form
          className="flex flex-col gap-8 lg:rounded-xl lg:border lg:bg-card lg:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) return;
            onSubmit({ team1Score, team2Score });
          }}
        >
          <div className="flex items-stretch gap-3">
            {orderForUi.map((which, i) => (
              <Fragment key={which}>
                {i === 1 ? (
                  <span
                    aria-hidden="true"
                    className="self-center text-xs text-muted-foreground"
                  >
                    vs
                  </span>
                ) : null}
                <div
                  className={cn(
                    'flex flex-1 flex-col gap-1 rounded-lg border p-4',
                    which === currentUserTeam
                      ? 'border-primary/50 bg-primary/10'
                      : 'bg-card text-right'
                  )}
                >
                  <h3
                    className={cn(
                      'mb-1 text-[10px] font-semibold tracking-[0.14em] uppercase',
                      which === currentUserTeam
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    {teamHeading(which)}
                  </h3>
                  {orderedPlayers(which).map((player) => (
                    <p
                      className={cn(
                        'truncate text-lg font-bold',
                        player.leaguePlayerId === currentLeaguePlayerId &&
                          'text-primary'
                      )}
                      key={player.leaguePlayerId}
                    >
                      {player.displayName ?? player.username ?? 'Unknown'}
                    </p>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>

          {!isFreeForm ? (
            <WinnerStep
              step={1}
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
              step={2}
              possessive={losingTeam === currentUserTeam ? 'your' : 'their'}
              options={loserScores}
              selected={losingTeam === 'team1' ? team1Score : team2Score}
              onPick={setLoserScore}
            />
          ) : null}

          {isFreeForm ? (
            <div id="free-form-score-step" className="flex flex-col gap-4">
              <StepHeading step={1}>What was the final score?</StepHeading>
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
            <div id="submit-step" className="flex flex-col gap-4">
              <StepHeading step={isFreeForm ? 2 : 3}>Submit?</StepHeading>
              <div className="rounded-lg border bg-card p-4 text-center text-2xl font-bold">
                {previewText}
              </div>
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 text-base font-bold"
              >
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
