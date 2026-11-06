import { createServerFn } from '@tanstack/react-start';
import { failServerAction } from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';

export interface FlagActionResult {
  success: boolean;
  message: string;
}

interface FlagTarget {
  orgId: string;
  leagueId: string;
}

export const createMatchFlagFn = createServerFn({ method: 'POST' })
  .validator((input: FlagTarget & { matchId: string; reason: string }) => input)
  .handler(async ({ data }): Promise<FlagActionResult> => {
    const reason = data.reason.trim();
    if (!data.matchId || !reason || !data.orgId || !data.leagueId) {
      return failServerAction(400, {
        success: false,
        message: 'Match ID and reason are required',
      });
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchFlagsApi.createFlag(data.orgId, data.leagueId, {
        matchId: data.matchId,
        reason,
      });
      return { success: true, message: 'Match flagged successfully' };
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to create flag'
      );
      return failServerAction(status, { success: false, message });
    }
  });

export const updateMatchFlagFn = createServerFn({ method: 'POST' })
  .validator((input: FlagTarget & { flagId: string; reason: string }) => input)
  .handler(async ({ data }): Promise<FlagActionResult> => {
    const reason = data.reason.trim();
    if (!data.flagId || !reason || !data.orgId || !data.leagueId) {
      return failServerAction(400, {
        success: false,
        message: 'Flag ID and reason are required',
      });
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchFlagsApi.updateFlagReason(
        data.orgId,
        data.leagueId,
        data.flagId,
        { reason }
      );
      return { success: true, message: 'Flag updated successfully' };
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to update flag'
      );
      return failServerAction(status, { success: false, message });
    }
  });

export const deleteMatchFlagFn = createServerFn({ method: 'POST' })
  .validator((input: FlagTarget & { flagId: string }) => input)
  .handler(async ({ data }): Promise<FlagActionResult> => {
    if (!data.flagId || !data.orgId || !data.leagueId) {
      return failServerAction(400, {
        success: false,
        message: 'Flag ID is required',
      });
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchFlagsApi.deleteFlag(
        data.orgId,
        data.leagueId,
        data.flagId
      );
      return { success: true, message: 'Flag deleted successfully' };
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to delete flag'
      );
      return failServerAction(status, { success: false, message });
    }
  });
