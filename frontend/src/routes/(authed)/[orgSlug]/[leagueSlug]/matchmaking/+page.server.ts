import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId, leaguePlayerId } = await parent();
  const [queueStatus, activeMatches] = await Promise.all([
    apiClientV3.queueApi.getQueueStatus(orgId, leagueId).catch(() => null),
    apiClientV3.activeMatchesApi
      .listActiveMatches(orgId, leagueId)
      .catch(() => []),
  ]);

  return {
    queueStatus,
    activeMatches,
    hasLeaguePlayer: !!leaguePlayerId,
  };
};

export const actions: Actions = {
  join: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!orgId || !leagueId) {
      return fail(400, { message: 'Organization and league are required' });
    }

    try {
      await apiClientV3.queueApi.joinQueue(orgId, leagueId);
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to join queue'
      );
      return fail(status, {
        message,
      });
    }
  },

  leave: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!orgId || !leagueId) {
      return fail(400, { message: 'Organization and league are required' });
    }

    try {
      await apiClientV3.queueApi.leaveQueue(orgId, leagueId);
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to leave queue'
      );
      return fail(status, {
        message,
      });
    }
  },

  accept: async ({ locals: { apiClientV3 }, request }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId');
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();
    if (!matchId || typeof matchId !== 'string') {
      return fail(400, { message: 'Match ID is required' });
    }
    if (!orgId || !leagueId) {
      return fail(400, { message: 'Organization and league are required' });
    }

    try {
      await apiClientV3.pendingMatchesApi.acceptPendingMatch(
        orgId,
        leagueId,
        matchId
      );
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to accept match'
      );
      return fail(status, {
        message,
      });
    }
  },

  decline: async ({ locals: { apiClientV3 }, request }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId');
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();
    if (!matchId || typeof matchId !== 'string') {
      return fail(400, { message: 'Match ID is required' });
    }
    if (!orgId || !leagueId) {
      return fail(400, { message: 'Organization and league are required' });
    }

    try {
      await apiClientV3.pendingMatchesApi.declinePendingMatch(
        orgId,
        leagueId,
        matchId
      );
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to decline match'
      );
      return fail(status, {
        message,
      });
    }
  },
};
