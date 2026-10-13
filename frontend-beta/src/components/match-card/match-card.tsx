import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import type { MatchResponse, MatchTeamPlayerResponse } from '@/api-v3/models';
import { matchOutcome } from '@/lib/player-stats';
import { MmrDelta } from './mmr-delta';

export interface MatchCardProps {
  match: MatchResponse;
  showMmr?: boolean;
  playerHref?: (leaguePlayerId: string) => string;
  renderPlayerLink?: (
    player: MatchTeamPlayerResponse,
    name: string
  ) => ReactNode;
  /** Server-pinned clock; when set the header names the day, not just the time. */
  now?: number;
  /** Adds a win/loss badge from this player's side when they played. */
  viewerId?: string | null;
}

// Match cards intentionally prefer the shorter username.
const playerName = (p: { displayName?: string; username?: string }) =>
  p.username ?? p.displayName ?? 'Unknown';

export function MatchCard({
  match,
  showMmr = false,
  playerHref,
  renderPlayerLink,
  now,
  viewerId,
}: MatchCardProps) {
  const { formatDate, formatTime, formatMatchDay } = useLocaleFormatters();
  const team1 = match.teams.find((t) => t.index === 0) ?? match.teams[0];
  const team2 = match.teams.find((t) => t.index === 1) ?? match.teams[1];
  const outcome = matchOutcome(match, viewerId);

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

  const score = (value: number | undefined) => (value === 0 ? '🥚' : value);

  return (
    <Card className="flex flex-col gap-1.5 px-3 py-2.5 md:px-4 md:py-3">
      <div className="flex min-h-5 items-center justify-between gap-2">
        {match.playedAt ? (
          <time
            className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase"
            dateTime={match.playedAt}
            title={formatDate(match.playedAt, '—', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          >
            {now != null ? `${formatMatchDay(match.playedAt, now)} · ` : null}
            {formatTime(match.playedAt)}
          </time>
        ) : (
          <span />
        )}
        {outcome ? (
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] leading-none font-semibold',
              outcome.won
                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : 'border-red-500/50 bg-red-500/10 text-red-400'
            )}
          >
            {outcome.won ? 'Win' : 'Loss'}
            {showMmr && outcome.delta != null
              ? ` · ${outcome.delta > 0 ? '+' : outcome.delta < 0 ? '−' : ''}${Math.abs(outcome.delta)}`
              : null}
          </span>
        ) : null}
      </div>
      <div className="flex flex-row items-center gap-2">
        <div
          className={cn(
            'flex flex-1 flex-row items-center gap-3',
            team1?.isWinner && 'text-primary'
          )}
        >
          <p className="min-w-[1.5ch] text-4xl leading-none font-bold tabular-nums">
            {score(team1?.score)}
          </p>
          <div className="flex flex-1 flex-col items-start text-sm leading-snug font-medium">
            {(team1?.players ?? []).map((player) => (
              <p className="space-x-1" key={player.id}>
                {name(player)}
                {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
              </p>
            ))}
          </div>
        </div>
        <span className="px-1 text-xs text-muted-foreground">vs.</span>
        <div
          className={cn(
            'flex flex-1 flex-row items-center gap-3',
            team2?.isWinner && 'text-primary'
          )}
        >
          <div className="flex flex-1 flex-col items-end text-sm leading-snug font-medium">
            {(team2?.players ?? []).map((player) => (
              <p className="space-x-1 text-right" key={player.id}>
                {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
                {name(player)}
              </p>
            ))}
          </div>
          <p className="min-w-[1.5ch] text-right text-4xl leading-none font-bold tabular-nums">
            {score(team2?.score)}
          </p>
        </div>
      </div>
    </Card>
  );
}
