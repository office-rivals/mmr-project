import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId } = await parent();
  const seasons = await apiClientV3.seasonsApi.listSeasons(orgId, leagueId);
  return { seasons };
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
  create: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const startsAtRaw = (formData.get('startsAt') as string)?.trim();
    if (!startsAtRaw) {
      return fail(400, { success: false, message: 'Start date is required' });
    }

    const startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) {
      return fail(400, { success: false, message: 'Invalid start date' });
    }

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
      await apiClientV3.seasonsApi.createSeason(orgId, leagueId, {
        startsAt: startsAt.toISOString(),
      });
      return { success: true, message: 'Season created' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to create season'
      );
      return fail(status, { success: false, message });
    }
  },
};
