import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { MatchFlagStatus } from '$api3';

const isMatchFlagStatus = (value: string): value is MatchFlagStatus =>
  (Object.values(MatchFlagStatus) as string[]).includes(value);

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
  url,
}) => {
  const { orgId, leagueId } = await parent();
  const rawStatusFilter = url.searchParams.get('status');
  const statusFilter =
    rawStatusFilter && isMatchFlagStatus(rawStatusFilter)
      ? rawStatusFilter
      : undefined;

  try {
    const [flags, players] = await Promise.all([
      apiClientV3.adminMatchFlagsApi.listAllFlags(
        orgId,
        leagueId,
        statusFilter
      ),
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
    const rawStatus = (formData.get('status') as string) || 'Resolved';
    const note = (formData.get('note') as string)?.trim() || undefined;
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!flagId || !orgId || !leagueId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    if (!isMatchFlagStatus(rawStatus)) {
      return fail(400, { success: false, message: 'Invalid status' });
    }

    try {
      await apiClientV3.adminMatchFlagsApi.resolveFlag(
        orgId,
        leagueId,
        flagId,
        {
          status: rawStatus,
          resolutionNote: note,
        }
      );
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
