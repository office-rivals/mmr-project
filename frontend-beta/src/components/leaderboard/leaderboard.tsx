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

  return (
    <Card>
      <CardContent className="p-0 md:p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[3ch]">#</TableHead>
              <TableHead className="w-[230px]">Player</TableHead>
              <TableHead>
                <span className="sm:hidden">W</span>
                <span className="hidden sm:inline">Wins</span>
              </TableHead>
              <TableHead>
                <span className="sm:hidden">L</span>
                <span className="hidden sm:inline">Losses</span>
              </TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <Fragment key={entry.leaguePlayerId}>
                {/* Emitted exactly once, at the ranked/unranked boundary. */}
                {entry.mmr == null &&
                (index === 0 || entries[index - 1]?.mmr != null) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Unranked
                    </TableCell>
                  </TableRow>
                ) : null}
                <TableRow
                  className={cn(
                    'cursor-pointer',
                    !interactive && 'pointer-events-none',
                    currentLeaguePlayerId === entry.leaguePlayerId &&
                      'text-primary'
                  )}
                  tabIndex={0}
                  onClick={() => onSelect?.(entry)}
                >
                  {/* `•`, never the server's `0`, for unranked players. */}
                  <TableCell className="max-w-[3ch] font-bold">
                    {entry.mmr != null ? entry.rank : '•'}
                  </TableCell>
                  <TableCell className="max-w-[230px]">
                    <div className="flex flex-col items-start">
                      {entry.displayName ? (
                        <span className="hidden w-full truncate sm:block">
                          {entry.displayName}
                        </span>
                      ) : null}
                      <span className="block">
                        {entry.username ?? entry.displayName ?? 'Unknown'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-row items-center gap-2">
                      {entry.wins}
                      {entry.winningStreak >= SHOW_STREAK_THRESHOLD ? (
                        <span
                          className="text-nowrap text-xs"
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
                  <TableCell>
                    <div className="flex flex-row items-center gap-2">
                      {entry.losses}
                      {entry.losingStreak >= SHOW_STREAK_THRESHOLD ? (
                        <span
                          className="text-nowrap text-xs"
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
                  <TableCell>
                    <div className="flex justify-end gap-2">
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
                            // Inert in practice: Sparkline renders nothing with
                            // <2 points. Kept for parity — see charts/index.ts.
                            <Sparkline
                              data={[]}
                              options={{ data: { loading: true } }}
                            />
                          )}
                        </div>
                      ) : null}
                      <span>{entry.mmr ?? '🐣'}</span>
                    </div>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
