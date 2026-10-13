import { createServerFn } from '@tanstack/react-start';
import { HttpError } from '@/lib/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { WEEK_MS, filterByPartners } from '@/lib/player-stats';
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
  /**
   * Newest league matches in the season, for each player's recent form. In
   * the current season it reaches back at least a week when it can.
   */
  recentMatches: MatchResponse[];
  /** False when the week's matches outnumber what was fetched. */
  weekComplete: boolean;
  now: number;
}

// Enough recent matches to give most active players five results.
const FORM_WINDOW = 300;
// Pages fetched at most while reaching back a week.
const WEEK_PAGES = 5;

export const getStandingsFn = createServerFn({ method: 'GET' })
  .validator((input: LeagueInput & { season?: string }) => input)
  .handler(async ({ data }): Promise<StandingsData> => {
    const apiClientV3 = await requireApiClientV3();
    try {
      const scope = resolveSeason(
        await apiClientV3.seasonsApi.listSeasons(data.orgId, data.leagueId),
        data.season
      );
      const now = Date.now();
      const page = (offset: number) =>
        apiClientV3.matchesApi.getMatches(data.orgId, data.leagueId, {
          seasonId: scope.seasonId,
          limit: FORM_WINDOW,
          offset,
        });
      const [leaderboard, recentMatches] = await Promise.all([
        apiClientV3.leaderboardApi.getLeaderboard(
          data.orgId,
          data.leagueId,
          scope.seasonId
        ),
        page(0).catch((): MatchResponse[] => []),
      ]);

      // Newest first: keep paging while the oldest match is still this week.
      let weekComplete = true;
      if (scope.isCurrentSeason) {
        const since = now - WEEK_MS;
        let pages = 1;
        let last = recentMatches.length;
        while (
          last === FORM_WINDOW &&
          Date.parse(recentMatches[recentMatches.length - 1].playedAt) >= since
        ) {
          if (pages === WEEK_PAGES) {
            weekComplete = false;
            break;
          }
          const next = await page(pages * FORM_WINDOW).catch(
            (): MatchResponse[] | null => null
          );
          if (next == null) {
            weekComplete = false;
            break;
          }
          recentMatches.push(...next);
          last = next.length;
          pages += 1;
        }
      }
      return { ...scope, leaderboard, recentMatches, weekComplete, now };
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
  /**
   * Set when a teammate or opponent filter applies: the feed then holds every
   * matching match at once, and `truncated` says the scan hit its cap.
   */
  filtered: { truncated: boolean } | null;
  /** The viewer's matches this season, for the weekly summary. */
  myMatches: MatchResponse[];
  myFlags: MatchFlagResponse[];
  now: number;
}

// The API filters by one player only, so partner filters scan the viewer's
// season page by page, up to this many matches.
const FILTER_PAGE = 200;
const FILTER_PAGES = 5;

export const getMatchesPageFn = createServerFn({ method: 'GET' })
  .validator(
    (
      input: LeagueInput & {
        season?: string;
        leaguePlayerId: string | null;
        mine: boolean;
        withId?: string;
        againstId?: string;
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
      if (mine && (data.withId || data.againstId)) {
        const me = data.leaguePlayerId!;
        const all: MatchResponse[] = [];
        let truncated = false;
        for (let i = 0; ; i++) {
          if (i === FILTER_PAGES) {
            truncated = true;
            break;
          }
          const next = await apiClientV3.matchesApi.getMatches(
            data.orgId,
            data.leagueId,
            {
              seasonId: scope.seasonId,
              leaguePlayerId: me,
              limit: FILTER_PAGE,
              offset: i * FILTER_PAGE,
            }
          );
          all.push(...next);
          if (next.length < FILTER_PAGE) break;
        }
        const myFlags = await apiClientV3.matchFlagsApi
          .getMyFlags(data.orgId, data.leagueId)
          .catch((): MatchFlagResponse[] => []);
        return {
          ...scope,
          myFlags,
          feed: {
            matches: filterByPartners(all, me, data),
            hasMore: false,
          },
          filtered: { truncated },
          myMatches: all.slice(0, FILTER_PAGE),
          now: Date.now(),
        };
      }
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
                limit: FILTER_PAGE,
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
        filtered: null,
        myMatches,
        now: Date.now(),
      };
    } catch {
      throw new HttpError(500, 'Failed to load matches');
    }
  });
