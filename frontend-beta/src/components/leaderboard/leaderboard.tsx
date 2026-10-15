import { Fragment } from 'react';
import { Sparkline } from '@/components/charts';
import { Card, CardContent } from '@/components/ui/card';
import { useHydrated } from '@/hooks/use-hydrated';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SHOW_STREAK_THRESHOLD } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type {
  LeaderboardEntryResponse,
  LeagueRatingHistoryEntry,
} from '@/api-v3/models';

export interface LeaderboardProps {
  entries: LeaderboardEntryResponse[];
  /** `undefined` while the streamed rating history is still in flight. */
  ratingHistory?: LeagueRatingHistoryEntry[];
  onSelect?: (entry: LeaderboardEntryResponse) => void;
  currentLeaguePlayerId?: string | null;
}

/**
 * Renders `entries` in the order the server sent them. Ordering *and* ranking
 * are computed in SQL (`V3LeaderboardService`): ties share a rank and the next
 * rank skips, unranked players (`mmr === null`, <10 matches in scope) sort last
 * with `rank === 0`. Re-sorting or re-ranking here silently breaks all of that.
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

  const select = (entry: LeaderboardEntryResponse) => onSelect?.(entry);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(headClass, 'w-[3ch] pr-1 pl-4')}>
                #
              </TableHead>
              <TableHead className={cn(headClass, 'w-[230px]')}>
                Player
              </TableHead>
              <TableHead className={headClass}>
                <span className="sm:hidden">W</span>
                <span className="hidden sm:inline">Wins</span>
              </TableHead>
              <TableHead className={headClass}>
                <span className="sm:hidden">L</span>
                <span className="hidden sm:inline">Losses</span>
              </TableHead>
              <TableHead className={cn(headClass, 'pr-4 text-right')}>
                Score
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => {
              const isMe = currentLeaguePlayerId === entry.leaguePlayerId;
              return (
                <Fragment key={entry.leaguePlayerId}>
                  {/* Emitted exactly once, at the ranked/unranked boundary. */}
                  {entry.mmr == null &&
                  (index === 0 || entries[index - 1]?.mmr != null) ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="bg-muted/30 py-2 text-center text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase"
                      >
                        Unranked
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow
                    className={cn(
                      'cursor-pointer focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                      !interactive && 'pointer-events-none',
                      isMe && 'bg-primary/10 text-primary hover:bg-primary/15'
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
                    {/* `•`, never the server's `0`, for unranked players. */}
                    <TableCell className="max-w-[3ch] py-3 pr-1 pl-4 font-bold tabular-nums">
                      {entry.mmr != null ? entry.rank : '•'}
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
                    <TableCell className="py-3 tabular-nums">
                      <div className="flex flex-row items-center gap-1.5">
                        {entry.wins}
                        {entry.winningStreak >= SHOW_STREAK_THRESHOLD ? (
                          <span
                            className="text-xs text-nowrap"
                            title="Winning streak"
                          >
                            {'🔥 '}
                            <span className="hidden sm:inline">
                              {entry.winningStreak}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 tabular-nums">
                      <div className="flex flex-row items-center gap-1.5">
                        {entry.losses}
                        {entry.losingStreak >= SHOW_STREAK_THRESHOLD ? (
                          <span
                            className="text-xs text-nowrap"
                            title="Losing streak"
                          >
                            {entry.losingStreak >= 7 ? '⛈️' : '🌧️'}{' '}
                            <span className="hidden sm:inline">
                              {entry.losingStreak}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-3">
                        {entry.mmr != null ? (
                          <div className="pointer-events-none hidden w-14 md:block">
                            {ratingHistory != null ? (
                              <Sparkline
                                data={ratingHistory
                                  .filter(
                                    (h) =>
                                      h.leaguePlayerId === entry.leaguePlayerId
                                  )
                                  .map((h) => ({
                                    date: h.playedAt,
                                    rating: h.mmr,
                                  }))}
                              />
                            ) : (
                              // Inert in practice: Sparkline renders nothing
                              // with <2 points.
                              <Sparkline
                                data={[]}
                                options={{ data: { loading: true } }}
                              />
                            )}
                          </div>
                        ) : null}
                        <span className="min-w-[4ch] text-right font-bold tabular-nums">
                          {entry.mmr ?? '🐣'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
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
