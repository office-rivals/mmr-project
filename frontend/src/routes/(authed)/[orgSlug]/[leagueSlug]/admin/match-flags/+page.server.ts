import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';

export const load: PageServerLoad = async ({ parent, locals: { apiClientV3 }, url }) => {
  const { orgId, leagueId } = await parent();
  const statusFilter = url.searchParams.get('status') ?? undefined;

  try {
    const [flags, players] = await Promise.all([
      apiClientV3.adminMatchFlagsApi.listAllFlags(orgId, leagueId, statusFilter as any),
      apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
    ]);

    return {
      flags,
      players,
      statusFilter: statusFilter ?? null,
    };
  } catch {
    throw error(500, 'Failed to load flags');
  }
};

export const actions = {
  resolve: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const status = (formData.get('status') as string) || 'Resolved';
    const note = (formData.get('note') as string)?.trim() || undefined;
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!flagId || !orgId || !leagueId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    try {
      await apiClientV3.adminMatchFlagsApi.resolveFlag(orgId, leagueId, flagId, {
        status: status as any,
        resolutionNote: note,
      });
    } catch (error) {
      const { status: statusCode, message } = await getApiErrorDetails(
        error,
        'Failed to resolve flag'
      );
      return fail(statusCode, { success: false, message });
    }

    return { success: true, message: 'Flag resolved successfully' };
  },
} satisfies Actions;
