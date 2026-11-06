import { createFileRoute } from '@tanstack/react-router';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';

/**
 * Same-origin proxy for the .NET API's GET /matches, kept at the SvelteKit
 * app's exact URL. Browser code cannot call API_BASE_PATH directly — it is
 * cross-origin and the bearer token must never reach the client.
 *
 * Contract parity: returns the bare MatchResponse[] array (the recent-match
 * route wraps its payload, this one does not), and `limit`/`offset` go through
 * an unvalidated Number() exactly as before, so `?limit=abc` still forwards NaN.
 */
export const Route = createFileRoute(
  '/api/v3/organizations/$orgId/leagues/$leagueId/matches'
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const seasonId = url.searchParams.get('seasonId') ?? undefined;
        const leaguePlayerId =
          url.searchParams.get('leaguePlayerId') ?? undefined;
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');
        const limit = limitParam !== null ? Number(limitParam) : undefined;
        const offset = offsetParam !== null ? Number(offsetParam) : undefined;

        const apiClientV3 = await requireApiClientV3();
        const matches = await apiClientV3.matchesApi.getMatches(
          params.orgId,
          params.leagueId,
          { seasonId, leaguePlayerId, limit, offset }
        );

        return Response.json(matches);
      },
    },
  },
});
