import { createFileRoute } from '@tanstack/react-router';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';

/**
 * Same-origin proxy at the SvelteKit app's exact URL, keyed by slugs rather
 * than ids. Contract parity that callers and e2e depend on:
 *   - the query param is `season`, forwarded to the client as `seasonId`;
 *   - the payload is wrapped as `{ match }`, unlike the matches proxy;
 *   - error strings are 'leaguePlayerId is required' (400) and
 *     'League not found' (404).
 * The getMe() round-trip per call is preserved for now; collapsing it into the
 * shared ['me'] query is a later, deliberate change.
 */
export const Route = createFileRoute('/$orgSlug/$leagueSlug/api/recent-match')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const leaguePlayerId = url.searchParams.get('leaguePlayerId');
        const seasonId = url.searchParams.get('season') ?? undefined;

        if (!leaguePlayerId) {
          return Response.json(
            { message: 'leaguePlayerId is required' },
            { status: 400 }
          );
        }

        const apiClientV3 = await requireApiClientV3();
        const me = await apiClientV3.meApi.getMe();
        const org = me.organizations?.find((o) => o.slug === params.orgSlug);
        const league = org?.leagues?.find((l) => l.slug === params.leagueSlug);
        if (!org || !league) {
          return Response.json(
            { message: 'League not found' },
            { status: 404 }
          );
        }

        const matches = await apiClientV3.matchesApi.getMatches(
          org.id,
          league.id,
          { leaguePlayerId, seasonId, limit: 1, offset: 0 }
        );

        return Response.json({ match: matches[0] ?? null });
      },
    },
  },
});
