import type { LeaderboardEntry } from '$lib/components/leaderboard/leader-board-entry';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { apiClient } }) => {
  try {
    // Not awaited by design, since we don't need to wait for this to render the page
    const statisticsPromise =
      apiClient.statisticsApi.statisticsGetPlayerHistory();

    const [entries, matches, users] = await Promise.all([
      apiClient.statisticsApi.statisticsGetLeaderboard(),
      apiClient.mmrApi.mMRV2GetMatches({
        limit: 5,
        offset: 0,
      }),
      apiClient.usersApi.usersGetUsers(),
    ]);

    const leaderboardEntries = entries
      .toSorted((a, b) => {
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
      .map<LeaderboardEntry>((entry, idx) => ({ ...entry, rank: idx + 1 }));

    return {
      users,
      statisticsPromise,
      leaderboardEntries,
      recentMatches: matches ?? [],
    };
  } catch (error) {
    fail(500, {
      message: 'Failed to load leaderboard',
    });
  }
};
