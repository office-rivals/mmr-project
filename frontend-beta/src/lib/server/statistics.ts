import { getRequest } from '@tanstack/react-start/server';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { HttpError } from '@/lib/http-error';
import { selectCurrentSeason } from '@/lib/util/season';
import type { SeasonResponse, TimeDistributionEntry } from '@/api-v3/models';

export interface StatisticsPoint {
  name: string;
  /** ISO string, ascending within each player's block. */
  date: string;
  mmr: number;
}

export interface StatisticsData {
  statistics: StatisticsPoint[];
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse | null;
  timeDistribution: TimeDistributionEntry[];
}

/**
 * Port of `statistics/+page.server.ts`.
 *
 * `listSeasons` sits OUTSIDE the try/catch: its failure propagates as a plain
 * 500, while everything after it is funnelled into 500 `Failed to load
 * statistics`. The time-distribution call self-catches to an empty result, and
 * each of the (up to 10) per-player rating-history calls self-catches to
 * `null` — a failing player is silently dropped from the chart.
 */
export interface StatisticsInput {
  orgId: string;
  leagueId: string;
  season?: string;
}

export async function loadStatistics(
  input: StatisticsInput
): Promise<StatisticsData> {
  const { orgId, leagueId } = input;
  const apiClientV3 = await requireApiClientV3();

  const seasons = await apiClientV3.seasonsApi.listSeasons(orgId, leagueId);
  const currentSeason = selectCurrentSeason(seasons);
  const seasonId = input.season ?? currentSeason?.id;

  try {
    const [leaderboard, timeDistribution] = await Promise.all([
      apiClientV3.leaderboardApi.getLeaderboard(orgId, leagueId, seasonId),
      apiClientV3.statisticsApi
        .getTimeDistribution(orgId, leagueId, seasonId)
        .catch(() => ({ entries: [] as TimeDistributionEntry[] })),
    ]);

    // Deliberate N+1: one rating-history call per top-10 leaderboard entry.
    const playerHistories = await Promise.all(
      (leaderboard.entries ?? []).slice(0, 10).map(async (entry) => {
        try {
          const history = await apiClientV3.ratingHistoryApi.getPlayerHistory(
            orgId,
            leagueId,
            entry.leaguePlayerId,
            seasonId
          );
          return {
            name: entry.displayName ?? entry.username ?? 'Unknown',
            entries: history.entries ?? [],
          };
        } catch {
          return null;
        }
      })
    );

    const statistics = playerHistories.flatMap(
      (ph) =>
        ph?.entries.map((entry) => ({
          name: ph.name,
          date: entry.recordedAt,
          mmr: entry.mmr,
        })) ?? []
    );

    return {
      statistics,
      seasons: seasons ?? [],
      currentSeason,
      timeDistribution: timeDistribution.entries,
    };
  } catch {
    throw new HttpError(500, 'Failed to load statistics');
  }
}

const perRequest = new WeakMap<Request, Map<string, Promise<StatisticsData>>>();

const cacheKey = (input: StatisticsInput) =>
  [input.orgId, input.leagueId, input.season ?? ''].join('|');

/**
 * `loadStatistics` memoised per HTTP request, mirroring `loadPlayerProfileOnce`.
 *
 * A document request reaches it twice — once from the route's status-code guard,
 * once from the loader's server function — and this is a leaderboard call plus
 * an N+1 fan-out of up to ten rating-history calls, so sharing the result
 * matters. When the two callers do not observe the same `Request` instance the
 * memo simply misses and the second one pays for its own round-trip; the result
 * is identical either way.
 */
export function loadStatisticsOnce(
  input: StatisticsInput
): Promise<StatisticsData> {
  let request: Request | undefined;
  try {
    request = getRequest();
  } catch {
    request = undefined;
  }
  if (!request) return loadStatistics(input);

  let byKey = perRequest.get(request);
  if (!byKey) {
    byKey = new Map();
    perRequest.set(request, byKey);
  }

  const key = cacheKey(input);
  const cached = byKey.get(key);
  if (cached) return cached;

  const promise = loadStatistics(input);
  byKey.set(key, promise);
  return promise;
}
