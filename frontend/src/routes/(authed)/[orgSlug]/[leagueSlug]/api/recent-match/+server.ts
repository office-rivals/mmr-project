import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({
  url,
  params,
  locals: { apiClientV3 },
}) => {
  const leaguePlayerId = url.searchParams.get('leaguePlayerId');
  const seasonId = url.searchParams.get('season') ?? undefined;

  if (!leaguePlayerId) {
    throw error(400, 'leaguePlayerId is required');
  }

  const me = await apiClientV3.meApi.getMe();
  const org = me.organizations?.find((o) => o.slug === params.orgSlug);
  const league = org?.leagues?.find((l) => l.slug === params.leagueSlug);
  if (!org || !league) {
    throw error(404, 'League not found');
  }

  const matches = await apiClientV3.matchesApi.getMatches(org.id, league.id, {
    leaguePlayerId,
    seasonId,
    limit: 1,
    offset: 0,
  });

  return json({ match: matches[0] ?? null });
};
