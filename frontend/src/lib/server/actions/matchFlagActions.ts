import { fail } from '@sveltejs/kit';
import { getApiErrorDetails } from '$lib/server/api/apiError';

type ActionParams = {
  request: Request;
  params: { orgSlug: string; leagueSlug: string };
  locals: App.Locals;
};

export const matchFlagActions = {
  flagMatch: async ({ request, locals }: ActionParams) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    const reason = (formData.get('reason') as string)?.trim();
    const orgId = formData.get('orgId') as string;
    const leagueId = formData.get('leagueId') as string;

    if (!matchId || !reason || !orgId || !leagueId) {
      return fail(400, { success: false, message: 'Match ID and reason are required' });
    }

    try {
      await locals.apiClientV3.matchFlagsApi.createFlag(orgId, leagueId, {
        matchId,
        reason,
      });
    } catch (error) {
      const { status, message } = await getApiErrorDetails(error, 'Failed to create flag');
      return fail(status, { success: false, message });
    }

    return { success: true, message: 'Match flagged successfully' };
  },

  updateFlag: async ({ request, locals }: ActionParams) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const reason = (formData.get('reason') as string)?.trim();
    const orgId = formData.get('orgId') as string;
    const leagueId = formData.get('leagueId') as string;

    if (!flagId || !reason || !orgId || !leagueId) {
      return fail(400, { success: false, message: 'Flag ID and reason are required' });
    }

    try {
      await locals.apiClientV3.matchFlagsApi.updateFlagReason(orgId, leagueId, flagId, {
        reason,
      });
    } catch (error) {
      const { status, message } = await getApiErrorDetails(error, 'Failed to update flag');
      return fail(status, { success: false, message });
    }

    return { success: true, message: 'Flag updated successfully' };
  },

  deleteFlag: async ({ request, locals }: ActionParams) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const orgId = formData.get('orgId') as string;
    const leagueId = formData.get('leagueId') as string;

    if (!flagId || !orgId || !leagueId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    try {
      await locals.apiClientV3.matchFlagsApi.deleteFlag(orgId, leagueId, flagId);
    } catch (error) {
      const { status, message } = await getApiErrorDetails(error, 'Failed to delete flag');
      return fail(status, { success: false, message });
    }

    return { success: true, message: 'Flag deleted successfully' };
  },
};
