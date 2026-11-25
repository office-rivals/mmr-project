import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { listTablesWithUnclaimedFn } from './unclaimed';

/**
 * "Table 1: Red 10–7 White — who played?" on the submit page, where players
 * already go to log a game. Renders nothing while loading or on any error, so
 * the hardware API can never break match submission.
 */
export function UnclaimedMatchesBanner({
  orgId,
  leagueId,
  orgSlug,
  leagueSlug,
}: {
  orgId: string;
  leagueId: string;
  orgSlug: string;
  leagueSlug: string;
}) {
  const { data } = useQuery({
    queryKey: ['foosball-unclaimed', leagueId],
    queryFn: () => listTablesWithUnclaimedFn({ data: { orgId, leagueId } }),
    retry: false,
  });

  const waiting = (data ?? []).flatMap(({ table, unclaimed }) =>
    unclaimed.map((match) => ({ table, match }))
  );
  if (waiting.length === 0) return null;

  return (
    <div
      className="mb-6 flex flex-col gap-2"
      data-testid="unclaimed-matches-banner"
    >
      {waiting.map(({ table, match }) => (
        <Link
          key={match.id}
          to="/$orgSlug/$leagueSlug/submit"
          params={{ orgSlug, leagueSlug }}
          search={{ table: table.id, match: match.id }}
          className="rounded-lg border border-primary bg-primary/10 p-3 text-center hover:bg-primary/20"
        >
          <span className="font-medium">{table.name}:</span> {table.endLabelA}{' '}
          <strong className="tabular-nums">
            {match.scoreA}–{match.scoreB}
          </strong>{' '}
          {table.endLabelB}, who played?
        </Link>
      ))}
    </div>
  );
}
