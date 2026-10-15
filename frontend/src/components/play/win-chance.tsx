import { formatStake, type MatchOdds } from '@/lib/match-prediction';
import { cn } from '@/lib/utils';

interface WinChanceProps {
  odds: MatchOdds;
  /** The team named first and filled on the bar, normally the viewer's. */
  teamIndex: number;
  /** One line of text over a thinner bar, for the live match bar and cards. */
  compact?: boolean;
  /** Neither side is the viewer's, so the bar takes no team colour. */
  neutral?: boolean;
  className?: string;
}

/** Both sides' chances of winning, and the viewer's own stake when they play. */
export function WinChance({
  odds,
  teamIndex,
  compact = false,
  neutral = false,
  className,
}: WinChanceProps) {
  const ours = odds.teams.find((t) => t.index === teamIndex) ?? odds.teams[0];
  const theirs = odds.teams.find((t) => t !== ours) ?? odds.teams[1];
  const stake = odds.stake ? formatStake(odds.stake) : null;

  return (
    <div
      data-testid="win-chance"
      className={cn('flex flex-col', compact ? 'gap-1' : 'gap-1.5', className)}
    >
      <p
        className={cn(
          'flex items-baseline justify-between gap-3 tabular-nums',
          compact ? 'text-xs' : 'text-[13px]'
        )}
      >
        <span
          className={cn(
            'min-w-0 truncate',
            !neutral && 'font-semibold text-primary'
          )}
        >
          {neutral ? `${ours.winPercent}%` : `${ours.winPercent}% win chance`}
          <span className="sr-only">
            {neutral ? ' win chance for the first team,' : ' for your team,'}
          </span>
          {compact && stake ? (
            <span className="font-normal text-muted-foreground">
              {' · '}
              {stake}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {theirs.winPercent}%
          <span className="sr-only">
            {neutral ? ' for the second team' : ' for the opponents'}
          </span>
        </span>
      </p>
      <span
        aria-hidden="true"
        className={cn(
          'flex overflow-hidden rounded-full bg-muted',
          compact ? 'h-1' : 'h-1.5'
        )}
      >
        <span
          className={neutral ? 'bg-muted-foreground' : 'bg-primary'}
          style={{ width: `${ours.winPercent}%` }}
        />
      </span>
      {!compact && stake ? (
        <p className="text-xs text-muted-foreground tabular-nums">{stake}</p>
      ) : null}
    </div>
  );
}

/** "Avg 1,693" under a team, from the MMR its players bring into the match. */
export function TeamAverageMmr({
  odds,
  teamIndex,
  format,
  className,
}: {
  odds: MatchOdds;
  teamIndex: number;
  format: (value: number) => string;
  className?: string;
}) {
  const team = odds.teams.find((t) => t.index === teamIndex);
  if (!team) return null;
  return (
    <p className={cn('text-xs text-muted-foreground tabular-nums', className)}>
      Avg {format(team.averageMmr)}
      <span className="sr-only"> MMR</span>
    </p>
  );
}
