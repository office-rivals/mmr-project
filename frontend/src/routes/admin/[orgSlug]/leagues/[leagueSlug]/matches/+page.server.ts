import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';

const PAGE_SIZE = 25;

export const load: PageServerLoad = async ({
  parent,
  url,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId } = await parent();

  const offsetParam = url.searchParams.get('offset');
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  const matches = await apiClientV3.matchesApi.getMatches(orgId, leagueId, {
    limit: PAGE_SIZE + 1,
    offset,
  });

  const hasMore = matches.length > PAGE_SIZE;
  const trimmed = matches.slice(0, PAGE_SIZE);

  return {
    matches: trimmed,
    pageSize: PAGE_SIZE,
    offset,
    hasMore,
    latestMatchId: offset === 0 ? (trimmed[0]?.id ?? null) : null,
  };
};

async function resolveOrgId(
  apiClientV3: App.Locals['apiClientV3'],
  orgSlug: string | undefined
): Promise<string | null> {
  if (!orgSlug) return null;
  const me = await apiClientV3.meApi.getMe();
  return (me.organizations ?? []).find((o) => o.slug === orgSlug)?.id ?? null;
}

async function resolveLeagueId(
  apiClientV3: App.Locals['apiClientV3'],
  orgId: string,
  leagueSlug: string | undefined
): Promise<string | null> {
  if (!leagueSlug) return null;
  const leagues = await apiClientV3.leaguesApi.listLeagues(orgId);
  return leagues.find((l) => l.slug === leagueSlug)?.id ?? null;
}

export const actions: Actions = {
  delete: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    if (!matchId)
      return fail(400, { success: false, message: 'matchId required' });

    const orgId = await resolveOrgId(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { success: false, message: 'Org not found' });
    const leagueId = await resolveLeagueId(
      apiClientV3,
      orgId,
      params.leagueSlug
    );
    if (!leagueId)
      return fail(404, { success: false, message: 'League not found' });

    try {
      await apiClientV3.matchesApi.deleteMatch(orgId, leagueId, matchId);
      return {
        success: true,
        message: 'Match deleted and ratings rolled back',
      };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to delete match'
      );
      return fail(status, { success: false, message });
    }
  },
};
