import { MatchCard } from '@/components/match-card/match-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { compareForDuplicate, describeGap } from '@/lib/match-review';
import type { MatchNeighboursResponse, MatchResponse } from '@/api-v3';

export interface MatchNeighboursProps {
  match: MatchResponse;
  /** Null when the neighbours could not be loaded: the match shows alone. */
  neighbours: MatchNeighboursResponse | null;
}

/**
 * The reported match between the league's matches just before and after it,
 * so a match entered twice shows up next to its original.
 */
export function MatchNeighbours({ match, neighbours }: MatchNeighboursProps) {
  if (!neighbours) return <MatchCard match={match} showMmr />;

  return (
    <div className="flex flex-col gap-2" data-testid="match-neighbours">
      <Neighbour
        side="before"
        reported={match}
        neighbour={neighbours.before ?? null}
      />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Reported match</span>
        <div
          className="rounded-xl ring-2 ring-primary/60"
          data-testid="match-flag-reported"
        >
          <MatchCard match={match} showMmr />
        </div>
      </div>
      <Neighbour
        side="after"
        reported={match}
        neighbour={neighbours.after ?? null}
      />
    </div>
  );
}

function Neighbour({
  side,
  reported,
  neighbour,
}: {
  side: 'before' | 'after';
  reported: MatchResponse;
  neighbour: MatchResponse | null;
}) {
  const testId = `match-neighbour-${side}`;
  if (!neighbour) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={testId}>
        {side === 'before'
          ? 'No earlier match in this league.'
          : 'No later match in this league.'}
      </p>
    );
  }

  const check = compareForDuplicate(reported, neighbour);
  const gap = `${describeGap(check.minutesApart)} ${side === 'before' ? 'earlier' : 'later'}`;

  return (
    <div
      className="flex flex-col gap-1"
      data-testid={testId}
      data-likely-duplicate={check.likely ? '' : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{`${side === 'before' ? 'Just before' : 'Just after'} · ${gap}`}</span>
        {check.likely && (
          <>
            <Badge
              variant="outline"
              className="border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
            >
              Likely duplicate
            </Badge>
            <span className="text-amber-700 dark:text-amber-300">
              {`Same score, ${check.sharedPlayers} of ${check.totalPlayers} players the same`}
            </span>
          </>
        )}
      </div>
      <div
        className={cn(
          'rounded-xl',
          check.likely ? 'ring-2 ring-amber-500' : 'opacity-80'
        )}
      >
        <MatchCard match={neighbour} showMmr />
      </div>
    </div>
  );
}
