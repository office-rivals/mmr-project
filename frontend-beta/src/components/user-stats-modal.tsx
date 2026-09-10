import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Kpi } from '@/components/kpi';
import { MatchCard } from '@/components/match-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import type { LeaderboardEntryResponse, MatchResponse } from '@/api-v3/models';

export interface UserStatsModalProps {
  entry: LeaderboardEntryResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fetchRecentMatch: (
    leaguePlayerId: string,
    seasonId: string | undefined
  ) => Promise<MatchResponse | null>;
  playerHrefBase: string;
  seasonId?: string;
}

type RecentMatchState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'resolved'; match: MatchResponse | null }
  | { status: 'rejected'; message: string };

const percentFormatter = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 0,
});

export function UserStatsModal({
  entry,
  open,
  onOpenChange,
  fetchRecentMatch,
  playerHrefBase,
  seasonId,
}: UserStatsModalProps) {
  const [recentMatch, setRecentMatch] = useState<RecentMatchState>({
    status: 'idle',
  });

  useEffect(() => {
    if (!open) {
      setRecentMatch({ status: 'idle' });
      return;
    }

    let cancelled = false;
    setRecentMatch({ status: 'pending' });
    fetchRecentMatch(entry.leaguePlayerId, seasonId)
      .then((match) => {
        if (!cancelled) setRecentMatch({ status: 'resolved', match });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRecentMatch({
          status: 'rejected',
          message:
            error instanceof Error ? error.message : String(error ?? 'Error'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, entry.leaguePlayerId, seasonId, fetchRecentMatch]);

  const totalGames = entry.wins + entry.losses;
  const displayName = entry.displayName ?? entry.username ?? 'Unknown';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-screen overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogTitle className="flex gap-2">{displayName}</DialogTitle>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
            <Kpi title="Rank">{entry.mmr != null ? entry.rank : '–'}</Kpi>
            <Kpi title="MMR">{entry.mmr ?? '🐣'}</Kpi>
            <Kpi title="Win %">
              {percentFormatter.format(
                totalGames > 0 ? entry.wins / totalGames : 0
              )}
            </Kpi>
            <Kpi title="# Wins" className="col-start-1">
              {entry.wins}
            </Kpi>
            <Kpi title="# Losses">{entry.losses}</Kpi>
            <Kpi title="# Matches">{totalGames}</Kpi>
            <Kpi title="Streak">
              {entry.winningStreak > 0 ? `🔥 ${entry.winningStreak}` : null}
              {entry.losingStreak > 0
                ? `${entry.losingStreak >= 7 ? '⛈️' : '🌧️'} ${entry.losingStreak}`
                : null}
              {entry.winningStreak === 0 && entry.losingStreak === 0
                ? '—'
                : null}
            </Kpi>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-base text-gray-300">Latest Match</p>
            {recentMatch.status === 'pending' ? (
              <Card className="flex items-center gap-2 p-4">
                <LoaderCircle className="animate-spin text-muted-foreground" />
                <p className="text-base text-muted-foreground">
                  Fetching latest match...
                </p>
              </Card>
            ) : null}
            {recentMatch.status === 'resolved' && recentMatch.match ? (
              <MatchCard match={recentMatch.match} showMmr />
            ) : null}
            {recentMatch.status === 'resolved' && !recentMatch.match ? (
              <Card className="p-4">
                <p className="text-base text-muted-foreground">
                  No matches yet.
                </p>
              </Card>
            ) : null}
            {recentMatch.status === 'rejected' ? (
              <Card className="flex items-center gap-2 p-4">
                <p className="text-base text-red-500">{recentMatch.message}</p>
              </Card>
            ) : null}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button asChild>
            <AppLink
              to={`${playerHrefBase}/${entry.leaguePlayerId}`}
              search={seasonId ? { season: seasonId } : {}}
            >
              More details
            </AppLink>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
