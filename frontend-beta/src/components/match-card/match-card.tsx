import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import type { MatchResponse, MatchTeamPlayerResponse } from '@/api-v3/models';
import { MmrDelta } from './mmr-delta';

export interface MatchCardProps {
  match: MatchResponse;
  showMmr?: boolean;
  playerHref?: (leaguePlayerId: string) => string;
  renderPlayerLink?: (
    player: MatchTeamPlayerResponse,
    name: string
  ) => ReactNode;
}

// Match cards intentionally prefer the shorter username.
const playerName = (p: { displayName?: string; username?: string }) =>
  p.username ?? p.displayName ?? 'Unknown';

export function MatchCard({
  match,
  showMmr = false,
  playerHref,
  renderPlayerLink,
}: MatchCardProps) {
  const { formatDate, formatTime } = useLocaleFormatters();
  const team1 = match.teams.find((t) => t.index === 0) ?? match.teams[0];
  const team2 = match.teams.find((t) => t.index === 1) ?? match.teams[1];

  const name = (player: MatchTeamPlayerResponse) => {
    const label = playerName(player);
    if (renderPlayerLink) return renderPlayerLink(player, label);
    if (playerHref)
      return (
        <a className="hover:underline" href={playerHref(player.leaguePlayerId)}>
          {label}
        </a>
      );
    return <span>{label}</span>;
  };

  return (
    <Card>
      <div className="flex flex-row items-center gap-1 px-2 py-1 md:px-4 md:py-2">
        <div
          className={cn(
            'flex flex-1 flex-row items-center gap-4',
            team1?.isWinner && 'text-primary'
          )}
        >
          <p className="min-w-[1.5ch] text-4xl font-extrabold">
            {team1?.score === 0 ? '🥚' : team1?.score}
          </p>
          <div className="flex flex-1 flex-col items-start">
            {(team1?.players ?? []).map((player) => (
              <p className="space-x-1" key={player.id}>
                {name(player)}
                {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
              </p>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center">
          vs.
          {match.playedAt ? (
            <time
              className="text-muted-foreground"
              dateTime={match.playedAt}
              title={formatDate(match.playedAt, '—', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            >
              {formatTime(match.playedAt)}
            </time>
          ) : null}
        </div>
        <div
          className={cn(
            'flex flex-1 flex-row items-center gap-4',
            team2?.isWinner && 'text-primary'
          )}
        >
          <div className="flex flex-1 flex-col items-end">
            {(team2?.players ?? []).map((player) => (
              <p className="space-x-1" key={player.id}>
                {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
                {name(player)}
              </p>
            ))}
          </div>
          <p className="min-w-[1.5ch] text-right text-4xl font-extrabold">
            {team2?.score === 0 ? '🥚' : team2?.score}
          </p>
        </div>
      </div>
    </Card>
  );
}
