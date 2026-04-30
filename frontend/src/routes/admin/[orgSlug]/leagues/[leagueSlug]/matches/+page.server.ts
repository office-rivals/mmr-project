import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { resolveOrgAndLeagueIds } from '$lib/server/resolveIds';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({
  parent,
  url,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId } = await parent();

  const offsetParam = url.searchParams.get('offset');
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  const [matches, leaguePlayers] = await Promise.all([
    apiClientV3.matchesApi.getMatches(orgId, leagueId, {
      limit: PAGE_SIZE + 1,
      offset,
    }),
    apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
  ]);

  const hasMore = matches.length > PAGE_SIZE;
  const trimmed = matches.slice(0, PAGE_SIZE);

  return {
    matches: trimmed,
    leaguePlayers,
    pageSize: PAGE_SIZE,
    offset,
    hasMore,
    latestMatchId: offset === 0 ? (trimmed[0]?.id ?? null) : null,
  };
};

export const actions: Actions = {
  delete: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    if (!matchId)
      return fail(400, { success: false, message: 'matchId required' });

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      await apiClientV3.matchesApi.deleteMatch(
        ctx.orgId,
        ctx.leagueId,
        matchId
      );
      return { success: true, message: 'Match deleted' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to delete match'
      );
      return fail(status, { success: false, message });
    }
  },

  edit: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    const teamsRaw = formData.get('teams') as string;
    if (!matchId || !teamsRaw)
      return fail(400, {
        success: false,
        message: 'matchId and teams are required',
      });

    let parsedTeams: Array<{
      score: number;
      players: { leaguePlayerId: string }[];
    }>;
    try {
      parsedTeams = JSON.parse(teamsRaw);
    } catch {
      return fail(400, { success: false, message: 'Invalid teams payload' });
    }

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      await apiClientV3.matchesApi.updateMatch(
        ctx.orgId,
        ctx.leagueId,
        matchId,
        { teams: parsedTeams }
      );
      return { success: true, message: 'Match updated' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to update match'
      );
      return fail(status, { success: false, message });
    }
  },

  recalculate: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const fromMatchIdRaw = formData.get('fromMatchId') as string | null;
    const fromMatchId = fromMatchIdRaw?.trim()
      ? fromMatchIdRaw.trim()
      : undefined;

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      const result = await apiClientV3.matchesApi.recalculateMatches(
        ctx.orgId,
        ctx.leagueId,
        fromMatchId
      );
      return {
        success: true,
        message: `Recalculated ${result.matchCount} match${result.matchCount === 1 ? '' : 'es'}`,
      };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to recalculate MMR'
      );
      return fail(status, { success: false, message });
    }
  },
};
