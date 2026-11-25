import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Browser-side proxy for the .NET API's GET /matches endpoint. The
// report-match modal fetches this from the client; without this route
// the request would 404 against the SvelteKit dev server because
// handleFetch only intercepts server-side fetches.
export const GET: RequestHandler = async ({
  url,
  params,
  locals: { apiClientV3 },
}) => {
  const seasonId = url.searchParams.get('seasonId') ?? undefined;
  const leaguePlayerId = url.searchParams.get('leaguePlayerId') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const offsetParam = url.searchParams.get('offset');
  const limit = limitParam !== null ? Number(limitParam) : undefined;
  const offset = offsetParam !== null ? Number(offsetParam) : undefined;

  const matches = await apiClientV3.matchesApi.getMatches(
    params.orgId,
    params.leagueId,
    { seasonId, leaguePlayerId, limit, offset }
  );

  return json(matches);
};
