import { createFileRoute } from '@tanstack/react-router';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';

/**
 * Same-origin proxy for the .NET API's GET /match-predictions: the odds for
 * the chosen matches, by repeated `pendingMatchId`. The response is the API's
 * MatchPredictionResponse[], unchanged.
 */
export const Route = createFileRoute(
  '/api/v3/organizations/$orgId/leagues/$leagueId/match-predictions'
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const apiClientV3 = await requireApiClientV3();
        const predictions =
          await apiClientV3.matchPredictionsApi.getMatchPredictions(
            params.orgId,
            params.leagueId,
            url.searchParams.getAll('pendingMatchId')
          );

        return Response.json(predictions);
      },
    },
  },
});
