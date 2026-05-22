import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { resolveOrgIdBySlug } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId } = await parent();
  const leagues = await apiClientV3.leaguesApi.listLeagues(orgId);
  return { leagues };
};

export const actions: Actions = {
  create: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const slug = (formData.get('slug') as string)?.trim();
    const teamSize = Number(formData.get('teamSize'));

    if (!name) return fail(400, { error: 'Name is required' });
    if (!slug) return fail(400, { error: 'Slug is required' });

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.leaguesApi.createLeague(orgId, {
        name,
        slug,
        teamSize,
      });
      return { success: 'League created' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to create league'
      );
      return fail(status, { error: message });
    }
  },
};
