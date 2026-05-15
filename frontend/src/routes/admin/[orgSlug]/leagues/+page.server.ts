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
    const teamSize = Number(formData.get('teamSize'));
    const winningScoreRaw = (formData.get('winningScore') as string)?.trim();

    if (!name) return fail(400, { error: 'Name is required' });
    if (!slug) return fail(400, { error: 'Slug is required' });
    if (teamSize !== 1 && teamSize !== 2) {
      return fail(400, { error: 'Team size must be 1 or 2' });
    }

    // Empty input = free-form scoring (null on the wire). Otherwise must be a
    // positive int — the API caps at 255 but we let the API surface that.
    let winningScore: number | null = null;
    if (winningScoreRaw) {
      const parsed = Number(winningScoreRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return fail(400, {
          error: 'Winning score must be a positive integer, or blank for free-form',
        });
      }
      winningScore = parsed;
    }

    const orgId = await resolveOrgIdBySlug(apiClientV3, params.orgSlug);
    if (!orgId) return fail(404, { error: 'Organization not found' });

    try {
      await apiClientV3.leaguesApi.createLeague(orgId, {
        name,
        slug,
        teamSize,
        winningScore,
      });
      return { success: 'League created' };
    } catch {
      return fail(400, { error: 'Failed to create league' });
    }
  },
};
