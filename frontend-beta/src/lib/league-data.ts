import { createServerFn } from '@tanstack/react-start';
import { HttpError } from '@/lib/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { selectCurrentSeason } from '@/lib/util/season';
import type {
  LeaderboardResponse,
  MatchFlagResponse,
  LeagueRatingHistoryEntry,
  MatchResponse,
  SeasonResponse,
} from '@/api-v3';

interface LeagueInput {
  orgId: string;
  leagueId: string;
}

interface SeasonScope {
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse | null;
  /** `?season=` when present, otherwise the current season. */
  seasonId: string | undefined;
  isCurrentSeason: boolean;
}

function resolveSeason(
  seasons: SeasonResponse[],
  requested: string | undefined
): SeasonScope {
  const currentSeason = selectCurrentSeason(seasons);
  return {
    seasons,
    currentSeason,
    seasonId: requested ?? currentSeason?.id,
    isCurrentSeason:
      currentSeason != null &&
      (requested == null || requested === currentSeason.id),
  };
}

/** Never awaited by loaders: the rating lines fill in once it resolves. */
export const getLeagueRatingHistoryFn = createServerFn({ method: 'GET' })
  .validator((input: LeagueInput & { seasonId?: string }) => input)
  .handler(
    async ({ data }): Promise<{ entries: LeagueRatingHistoryEntry[] }> => {
      const apiClientV3 = await requireApiClientV3();
      return apiClientV3.ratingHistoryApi
        .getLeagueHistory(data.orgId, data.leagueId, data.seasonId)
        .catch(() => ({ entries: [] }));
    }
  );

export interface StandingsData extends SeasonScope {
  leaderboard: LeaderboardResponse;
  /** Newest league matches in the season, for each player's recent form. */
  recentMatches: MatchResponse[];
}

// Enough recent matches to give most active players five results.
const FORM_WINDOW = 300;

export const getStandingsFn = createServerFn({ method: 'GET' })
  .validator((input: LeagueInput & { season?: string }) => input)
  .handler(async ({ data }): Promise<StandingsData> => {
    const apiClientV3 = await requireApiClientV3();
    try {
      const scope = resolveSeason(
        await apiClientV3.seasonsApi.listSeasons(data.orgId, data.leagueId),
        data.season
      );
      const [leaderboard, recentMatches] = await Promise.all([
        apiClientV3.leaderboardApi.getLeaderboard(
          data.orgId,
          data.leagueId,
          scope.seasonId
        ),
        apiClientV3.matchesApi
          .getMatches(data.orgId, data.leagueId, {
            seasonId: scope.seasonId,
            limit: FORM_WINDOW,
            offset: 0,
          })
          .catch((): MatchResponse[] => []),
      ]);
      return { ...scope, leaderboard, recentMatches };
    } catch {
      throw new HttpError(500, 'Failed to load leaderboard');
    }
  });

export const MATCHES_PAGE_SIZE = 20;

export interface MatchFeedPage {
  matches: MatchResponse[];
  hasMore: boolean;
}

/** One page of the match feed; the viewer's own matches when `mine`. */
export const getMatchFeedFn = createServerFn({ method: 'GET' })
  .validator(
    (
      input: LeagueInput & {
        seasonId?: string;
        leaguePlayerId?: string;
        offset: number;
      }
    ) => input
  )
  .handler(async ({ data }): Promise<MatchFeedPage> => {
    const apiClientV3 = await requireApiClientV3();
    // One extra row tells us whether an older page exists.
    const matches = await apiClientV3.matchesApi.getMatches(
      data.orgId,
      data.leagueId,
      {
        seasonId: data.seasonId,
        leaguePlayerId: data.leaguePlayerId,
        limit: MATCHES_PAGE_SIZE + 1,
        offset: data.offset,
      }
    );
    return {
      matches: matches.slice(0, MATCHES_PAGE_SIZE),
      hasMore: matches.length > MATCHES_PAGE_SIZE,
    };
  });

export interface MatchesPageData extends SeasonScope {
  feed: MatchFeedPage;
  /** The viewer's matches this season, for the weekly summary. */
  myMatches: MatchResponse[];
  myFlags: MatchFlagResponse[];
  now: number;
}

export const getMatchesPageFn = createServerFn({ method: 'GET' })
  .validator(
    (
      input: LeagueInput & {
        season?: string;
        leaguePlayerId: string | null;
        mine: boolean;
      }
    ) => input
  )
  .handler(async ({ data }): Promise<MatchesPageData> => {
    const apiClientV3 = await requireApiClientV3();
    try {
      const scope = resolveSeason(
        await apiClientV3.seasonsApi.listSeasons(data.orgId, data.leagueId),
        data.season
      );
      const mine = data.mine && data.leaguePlayerId != null;
      const [page, myMatches, myFlags] = await Promise.all([
        apiClientV3.matchesApi.getMatches(data.orgId, data.leagueId, {
          seasonId: scope.seasonId,
          leaguePlayerId: mine ? data.leaguePlayerId! : undefined,
          limit: MATCHES_PAGE_SIZE + 1,
          offset: 0,
        }),
        data.leaguePlayerId
          ? apiClientV3.matchesApi
              .getMatches(data.orgId, data.leagueId, {
                seasonId: scope.seasonId,
                leaguePlayerId: data.leaguePlayerId,
                limit: 200,
                offset: 0,
              })
              .catch((): MatchResponse[] => [])
          : Promise.resolve([] as MatchResponse[]),
        apiClientV3.matchFlagsApi
          .getMyFlags(data.orgId, data.leagueId)
          .catch((): MatchFlagResponse[] => []),
      ]);
      return {
        ...scope,
        myFlags,
        feed: {
          matches: page.slice(0, MATCHES_PAGE_SIZE),
          hasMore: page.length > MATCHES_PAGE_SIZE,
        },
        myMatches,
        now: Date.now(),
      };
    } catch {
      throw new HttpError(500, 'Failed to load matches');
    }
  });
