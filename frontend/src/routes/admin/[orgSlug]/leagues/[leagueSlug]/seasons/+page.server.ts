import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { resolveOrgAndLeagueIds } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId } = await parent();
  const seasons = await apiClientV3.seasonsApi.listSeasons(orgId, leagueId);
  return { seasons };
};

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

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      await apiClientV3.seasonsApi.createSeason(ctx.orgId, ctx.leagueId, {
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
