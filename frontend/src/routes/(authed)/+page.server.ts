import type { LeaderboardEntry } from '$api/models/LeaderboardEntry';
import type { RankedLeaderboardEntry } from '$lib/components/leaderboard/leader-board-entry';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

    const [entries, matches, users, activeMatches, profile, seasons] =
      await Promise.all([
        apiClient.statisticsApi.statisticsGetLeaderboard({ seasonId }),
        apiClient.mmrApi.mMRV2GetMatches({
          limit: 5,
          offset: 0,
          seasonId,
        }),
        apiClient.usersApi.usersGetUsers(),
        apiClient.matchmakingApi.matchMakingGetActiveMatches(),
        apiClient.profileApi.profileGetProfile(),
        apiClient.seasonsApi.seasonsGetSeasons(),
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
    };
  } catch (error) {
    fail(500, {
      message: 'Failed to load leaderboard',
    });
  }
};
