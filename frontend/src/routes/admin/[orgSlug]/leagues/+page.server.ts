import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
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
    const queueSizeRaw = formData.get('queueSize') as string;
    const queueSize = queueSizeRaw ? parseInt(queueSizeRaw, 10) : undefined;

    if (!name) return fail(400, { error: 'Name is required' });
    if (!slug) return fail(400, { error: 'Slug is required' });
    if (queueSize !== undefined && (Number.isNaN(queueSize) || queueSize < 2)) {
      return fail(400, { error: 'Queue size must be at least 2' });
    }

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.leaguesApi.createLeague(orgId, {
        name,
        slug,
        queueSize,
      });
      return { success: 'League created' };
    } catch {
      return fail(400, { error: 'Failed to create league' });
    }
  },
};
