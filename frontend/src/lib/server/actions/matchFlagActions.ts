import { fail } from '@sveltejs/kit';
import type { ApiClient } from '$lib/server/api/apiClient';

export function createMatchFlagActions(apiClient: ApiClient) {
  return {
    flagMatch: async (data: FormData) => {
      const matchId = data.get('matchId');
      const reason = (data.get('reason') as string | null)?.trim();

      if (!matchId || !reason) {
        return fail(400, { success: false, message: 'Match ID and reason are required' });
      }

      const parsedMatchId = Number(matchId);
      if (!Number.isInteger(parsedMatchId) || parsedMatchId <= 0) {
        return fail(400, { success: false, message: 'Valid match ID is required' });
      }

      try {
        await apiClient.matchFlagsApi.matchFlagsCreateFlag({
          createMatchFlagRequest: {
            matchId: parsedMatchId,
            reason,
          },
        });

        return { success: true, message: 'Match flagged successfully' };
      } catch (error) {
        console.error('Error flagging match:', error);
        return fail(500, { success: false, message: 'Failed to flag match' });
      }
    },

    updateFlag: async (data: FormData) => {
      const flagId = data.get('flagId');
      const reason = (data.get('reason') as string | null)?.trim();

      if (!flagId || !reason) {
        return fail(400, { success: false, message: 'Flag ID and reason are required' });
      }

      const parsedFlagId = Number(flagId);
      if (!Number.isInteger(parsedFlagId) || parsedFlagId <= 0) {
        return fail(400, { success: false, message: 'Valid flag ID is required' });
      }

      try {
        await apiClient.matchFlagsApi.matchFlagsUpdateFlag({
          id: parsedFlagId,
          updateMatchFlagReasonRequest: {
            reason,
          },
        });

        return { success: true, message: 'Flag updated successfully' };
      } catch (error) {
        console.error('Error updating flag:', error);
        return fail(500, { success: false, message: 'Failed to update flag' });
      }
    },

    deleteFlag: async (data: FormData) => {
      const flagId = data.get('flagId');

      if (!flagId) {
        return fail(400, { success: false, message: 'Flag ID is required' });
      }

      const parsedFlagId = Number(flagId);
      if (!Number.isInteger(parsedFlagId) || parsedFlagId <= 0) {
        return fail(400, { success: false, message: 'Valid flag ID is required' });
      }

      try {
        await apiClient.matchFlagsApi.matchFlagsDeleteFlag({
          id: parsedFlagId,
        });

        return { success: true, message: 'Flag deleted successfully' };
      } catch (error) {
        console.error('Error deleting flag:', error);
        return fail(500, { success: false, message: 'Failed to delete flag' });
      }
    },
  };
}
