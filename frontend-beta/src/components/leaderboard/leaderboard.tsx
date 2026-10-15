import { useMemo } from 'react';
import { TrendLine } from '@/components/charts';
import { Card, CardContent } from '@/components/ui/card';
import { useHydrated } from '@/hooks/use-hydrated';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SHOW_STREAK_THRESHOLD } from '@/lib/constants';
import { ratingsByPlayer } from '@/lib/player-stats';
import { cn } from '@/lib/utils';
import type {
  LeaderboardEntryResponse,
  LeagueRatingHistoryEntry,
} from '@/api-v3/models';

export interface LeaderboardProps {
  /** The ranked rows to show, in the server's order. */
  entries: LeaderboardEntryResponse[];
  /** `undefined` while the streamed rating history is still in flight. */
  ratingHistory?: LeagueRatingHistoryEntry[];
  onSelect?: (entry: LeaderboardEntryResponse) => void;
  currentLeaguePlayerId?: string | null;
}

/** Phones show fewer rows, as in the design; the rest wait on the full page. */
const PHONE_ROWS = 5;

/**
 * Home's slice of the standings. Renders `entries` in the order the server
 * sent them: ordering *and* ranking are computed in SQL
 * (`V3LeaderboardService`), where ties share a rank and the next rank skips.
 * Re-sorting or re-ranking here silently breaks that.
 */
export function Leaderboard({
  entries,
  ratingHistory,
  onSelect,
  currentLeaguePlayerId,
}: LeaderboardProps) {
  // A row's only behaviour is a React `onClick`, so it is inert while the page
  // is still SSR HTML — and a click landing in that window is swallowed, not
  // replayed. `pointer-events-none` makes the dead window observable (the row
  // is not a hit target yet) instead of silently eating the first click, which
  // is the same reasoning behind `disabled={!hydrated}` on the page's buttons.
  const hydrated = useHydrated();
  const interactive = hydrated && onSelect != null;
  const { formatNumber } = useLocaleFormatters();

  const select = (entry: LeaderboardEntryResponse) => onSelect?.(entry);
  const trends = useMemo(
    () => (ratingHistory ? ratingsByPlayer(ratingHistory) : null),
    [ratingHistory]
  );
  const winRate = (entry: LeaderboardEntryResponse) => {
    const played = entry.wins + entry.losses;
    return played > 0
      ? formatNumber(entry.wins / played, {
          style: 'percent',
          maximumFractionDigits: 0,
        })
      : '—';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(headClass, 'w-[3ch] pr-1 pl-4')}>
                #
              </TableHead>
              <TableHead className={headClass}>Player</TableHead>
              <TableHead className={cn(headClass, 'text-right sm:hidden')}>
                W–L
              </TableHead>
              <TableHead className={cn(headClass, wide, 'text-right')}>
                Wins
              </TableHead>
              <TableHead className={cn(headClass, wide, 'text-right')}>
                Losses
              </TableHead>
              <TableHead className={cn(headClass, wide, 'text-right')}>
                Win %
              </TableHead>
              <TableHead className={cn(headClass, 'hidden pl-6 md:table-cell')}>
                Trend
              </TableHead>
              <TableHead className={cn(headClass, 'pr-4 text-right')}>
                MMR
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => {
              const isMe = currentLeaguePlayerId === entry.leaguePlayerId;
              const hot = entry.winningStreak >= SHOW_STREAK_THRESHOLD;
              return (
                <TableRow
                  key={entry.leaguePlayerId}
                  className={cn(
                    'cursor-pointer focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                    !interactive && 'pointer-events-none',
                    isMe && 'bg-primary/10 text-primary hover:bg-primary/15',
                    index >= PHONE_ROWS && 'hidden sm:table-row'
                  )}
                  tabIndex={0}
                  aria-current={isMe ? 'true' : undefined}
                  onClick={() => select(entry)}
                  onKeyDown={(event) => {
                    if (!interactive) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select(entry);
                    }
                  }}
                >
                  <TableCell className="max-w-[3ch] py-3 pr-1 pl-4 font-bold tabular-nums">
                    {entry.rank}
                  </TableCell>
                  <TableCell className="max-w-[230px] py-3">
                    <div className="flex flex-col items-start leading-tight">
                      {entry.displayName ? (
                        <span
                          className={cn(
                            'hidden w-full truncate text-xs sm:block',
                            !isMe && 'text-muted-foreground'
                          )}
                        >
                          {entry.displayName}
                        </span>
                      ) : null}
                      <span className="block font-semibold">
                        {entry.username ?? entry.displayName ?? 'Unknown'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'py-3 text-right whitespace-nowrap tabular-nums sm:hidden',
                      !isMe && 'text-muted-foreground'
                    )}
                  >
                    {entry.wins}–{entry.losses}
                    {hot ? (
                      <span className="ml-1" title="Winning streak">
                        🔥
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={cn(wide, 'py-3 text-right tabular-nums')}
                  >
                    <div className="flex flex-row items-center justify-end gap-1.5">
                      {entry.wins}
                      {hot ? (
                        <span
                          className="text-xs text-nowrap"
                          title="Winning streak"
                        >
                          {'🔥 '}
                          {entry.winningStreak}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(wide, 'py-3 text-right tabular-nums')}
                  >
                    <div className="flex flex-row items-center justify-end gap-1.5">
                      {entry.losses}
                      {entry.losingStreak >= SHOW_STREAK_THRESHOLD ? (
                        <span
                          className="text-xs text-nowrap"
                          title="Losing streak"
                        >
                          {entry.losingStreak >= 7 ? '⛈️' : '🌧️'}{' '}
                          {entry.losingStreak}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell
                    className={cn(wide, 'py-3 text-right tabular-nums')}
                  >
                    {winRate(entry)}
                  </TableCell>
                  <TableCell className="hidden py-3 pl-6 md:table-cell">
                    <div className="h-5 w-14">
                      <TrendLine
                        values={trends?.get(entry.leaguePlayerId) ?? []}
                        highlight={isMe}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="py-3 pr-4 text-right font-bold tabular-nums">
                    {entry.mmr}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const headClass =
  'h-10 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground';
/** Columns that only fit beside the player from `sm` up. */
const wide = 'hidden sm:table-cell';
