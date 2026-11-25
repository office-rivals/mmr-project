import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import type { MatchResponse, MatchTeamPlayerResponse } from '@/api-v3/models';
import { movePlayerToTopLeft } from '@/lib/move-player-to-top-left';
import { matchOutcome } from '@/lib/player-stats';
import { MmrDelta } from './mmr-delta';

export interface MatchCardProps {
  match: MatchResponse;
  showMmr?: boolean;
  /** Adds a "Goals" link under the time (table-scored matches). */
  goalsHref?: string;
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
  goalsHref,
  playerHref,
  renderPlayerLink,
  now,
  viewerId,
}: MatchCardProps) {
  const { formatDate, formatTime, formatMatchDay } = useLocaleFormatters();
  // The viewer's side always reads first, so a list of their matches scans
  // as their own results; otherwise the API order stands.
  const oriented = viewerId ? movePlayerToTopLeft(match, viewerId) : match;
  const team1 = oriented.teams.find((t) => t.index === 0) ?? oriented.teams[0];
  const team2 = oriented.teams.find((t) => t.index === 1) ?? oriented.teams[1];
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

  const score = (value: number | undefined) =>
    value === 0 ? (
      <span role="img" aria-label="0">
        🥚
      </span>
    ) : (
      value
    );

  // Narrow cards stack a header row over the score row. Wide ones (by the
  // card's own width, so dialogs stay stacked) flatten both into one row:
  // time | names score vs. score names | outcome.
  const row = '@xl:row-start-1';
  return (
    <Card className="@container">
      <div className="flex flex-col gap-1.5 px-3 py-2.5 md:px-4 md:py-3 @xl:grid @xl:grid-cols-[5.5rem_minmax(0,1fr)_auto_minmax(0,1fr)_6rem] @xl:items-center @xl:gap-x-4">
        <div className="flex min-h-5 items-center justify-between gap-2 @xl:contents">
          {match.playedAt ? (
            <p
              className={cn(
                'text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase @xl:col-start-1',
                row
              )}
            >
              {now != null ? (
                <span className="@xl:block">
                  {formatMatchDay(match.playedAt, now)}
                  <span className="@xl:hidden"> · </span>
                </span>
              ) : null}
              {/* Only the clock time sits in <time>, so its text stays a plain
                  localized time. */}
              <time
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
            </p>
          ) : (
            <span />
          )}
          {outcome ? (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[11px] leading-none font-semibold whitespace-nowrap @xl:col-start-5 @xl:justify-self-end',
                row,
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
          {goalsHref ? (
            <a
              className="text-sm text-muted-foreground underline @xl:col-start-1 @xl:row-start-2"
              href={goalsHref}
            >
              Goals
            </a>
          ) : null}
        </div>
        <div className="flex flex-row items-center gap-2 @xl:contents">
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-row items-center gap-3 @xl:col-start-2 @xl:flex-row-reverse',
              row,
              team1?.isWinner && 'text-primary'
            )}
          >
            <p className="min-w-[1.5ch] text-4xl leading-none font-bold tabular-nums @xl:text-3xl">
              {score(team1?.score)}
            </p>
            <div className="flex min-w-0 flex-1 flex-col items-start text-sm leading-snug font-medium @xl:items-end @xl:text-right">
              {(team1?.players ?? []).map((player) => (
                <p className="space-x-1" key={player.id}>
                  {name(player)}
                  {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
                </p>
              ))}
            </div>
          </div>
          <span
            className={cn(
              'px-1 text-xs text-muted-foreground @xl:col-start-3 @xl:px-0',
              row
            )}
          >
            vs.
          </span>
          <div
            className={cn(
              'flex min-w-0 flex-1 flex-row items-center gap-3 @xl:col-start-4 @xl:flex-row-reverse',
              row,
              team2?.isWinner && 'text-primary'
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col items-end text-sm leading-snug font-medium @xl:items-start">
              {(team2?.players ?? []).map((player) => (
                <p
                  className="space-x-1 text-right @xl:text-left"
                  key={player.id}
                >
                  {showMmr ? <MmrDelta delta={player.ratingDelta} /> : null}
                  {name(player)}
                </p>
              ))}
            </div>
            <p className="min-w-[1.5ch] text-right text-4xl leading-none font-bold tabular-nums @xl:text-left @xl:text-3xl">
              {score(team2?.score)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
