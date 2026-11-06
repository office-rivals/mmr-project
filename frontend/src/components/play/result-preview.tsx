import { cn } from '@/lib/utils';

interface PreviewSide {
  score: number;
  names: string[];
}

const score = (value: number) =>
  value === 0 ? (
    <span role="img" aria-label="0">
      🥚
    </span>
  ) : (
    value
  );

/** The result about to be submitted: each side's score and players. */
export function ResultPreview({
  team1,
  team2,
}: {
  team1: PreviewSide;
  team2: PreviewSide;
}) {
  const side = (team: PreviewSide, won: boolean, end: boolean) => (
    <div
      className={cn(
        'flex min-w-0 flex-1 items-center gap-3',
        end && 'flex-row-reverse',
        won && 'text-primary'
      )}
    >
      <p className="min-w-[1.5ch] text-5xl leading-none font-bold tabular-nums">
        {score(team.score)}
      </p>
      <div
        className={cn(
          'flex min-w-0 flex-col text-sm leading-snug font-medium',
          end ? 'items-end text-right' : 'items-start'
        )}
      >
        {team.names.map((name, i) => (
          <p key={i} className="max-w-full truncate">
            {name}
          </p>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-4 lg:px-5">
      {side(team1, team1.score > team2.score, false)}
      <span className="px-1 text-xs text-muted-foreground">vs</span>
      {side(team2, team2.score > team1.score, true)}
    </div>
  );
}
