import type { LeaderboardEntry } from '$api/models/LeaderboardEntry';
import type { RankedLeaderboardEntry } from '$lib/components/leaderboard/leader-board-entry';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient }, url }) => {
  try {
    const searchParams = url.searchParams;
    const seasonId = searchParams.get('season')
      ? Number(searchParams.get('season'))
      : undefined;

    // Not awaited by design, since we don't need to wait for this to render the page
    const statisticsPromise =
      apiClient.statisticsApi.statisticsGetPlayerHistory({
        seasonId,
      });

    const [entries, matches, users, activeMatches, seasons, profile, userFlags] =
      await Promise.all([
        apiClient.statisticsApi.statisticsGetLeaderboard({ seasonId }),
        apiClient.mmrApi.mMRV2GetMatches({
          limit: 5,
          offset: 0,
          seasonId,
        }),
        apiClient.usersApi.usersGetUsers(),
        apiClient.matchmakingApi.matchMakingGetActiveMatches(),
        apiClient.seasonsApi.seasonsGetSeasons(),
        apiClient.profileApi.profileGetProfile().catch(() => undefined),
        apiClient.matchFlagsApi.matchFlagsGetMyPendingFlags().catch(() => []),
      ]);

    const leaderboardEntries = entries
      .toSorted((a: LeaderboardEntry, b: LeaderboardEntry) => {
        if (a.mmr === b.mmr) {
          return (b.userId ?? 0) - (a.userId ?? 0);
        }

        if (a.mmr == null) {
          return 1;
        }

        if (b.mmr == null) {
          return -1;
        }

        return b.mmr - a.mmr;
      })
      .map<RankedLeaderboardEntry>((entry: LeaderboardEntry, idx: number) => ({
        ...entry,
        rank: idx + 1,
      }));

    return {
      users,
      statisticsPromise,
      leaderboardEntries,
      recentMatches: matches ?? [],
      activeMatches,
      profile,
      seasons,
      currentSeason: seasons[0],
      isCurrentSeason: seasonId == null || seasonId === seasons[0]?.id,
      userFlags: userFlags ?? [],
    };
  } catch (error) {
    return fail(500, {
      message: 'Failed to load leaderboard',
    });
  }
};

export const actions: Actions = {
  flagMatch: async ({ request, locals: { apiClient } }) => {
    const data = await request.formData();
    const matchId = data.get('matchId');
    const reason = data.get('reason');

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
          reason: reason.toString(),
        },
      });

      return { success: true, message: 'Match flagged successfully' };
    } catch (error) {
      console.error('Error flagging match:', error);
      return fail(500, { success: false, message: 'Failed to flag match' });
    }
  },

  updateFlag: async ({ request, locals: { apiClient } }) => {
    const data = await request.formData();
    const flagId = data.get('flagId');
    const reason = data.get('reason');

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
          reason: reason.toString(),
        },
      });

      return { success: true, message: 'Flag updated successfully' };
    } catch (error) {
      console.error('Error updating flag:', error);
      return fail(500, { success: false, message: 'Failed to update flag' });
    }
  },

  deleteFlag: async ({ request, locals: { apiClient } }) => {
    const data = await request.formData();
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
