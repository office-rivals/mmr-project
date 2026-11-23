import { createServerFn } from '@tanstack/react-start';
import { HttpError } from '@/lib/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { WEEK_MS, filterByPartners } from '@/lib/player-stats';
import { selectCurrentSeason } from '@/lib/util/season';
import { getPlayerDisplayName } from '@/lib/utils';
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
const MAX_FEED_ROWS = 500;

export interface MatchFeedPage {
  matches: MatchResponse[];
  hasMore: boolean;
}

/**
 * One page of the match feed; the viewer's own matches when `mine`. `limit`
 * re-fetches every older row loaded so far in one call.
 */
export const getMatchFeedFn = createServerFn({ method: 'GET' })
  .validator(
    (
      input: LeagueInput & {
        seasonId?: string;
        leaguePlayerId?: string;
        offset: number;
        limit?: number;
      }
    ) => input
  )
  .handler(async ({ data }): Promise<MatchFeedPage> => {
    const apiClientV3 = await requireApiClientV3();
    const limit = Math.min(
      Math.max(Math.trunc(data.limit ?? MATCHES_PAGE_SIZE), 1),
      MAX_FEED_ROWS
    );
    // One extra row tells us whether an older page exists.
    const matches = await apiClientV3.matchesApi.getMatches(
      data.orgId,
      data.leagueId,
      {
        seasonId: data.seasonId,
        leaguePlayerId: data.leaguePlayerId,
        limit: limit + 1,
        offset: data.offset,
      }
    );
    return {
      matches: matches.slice(0, limit),
      hasMore: matches.length > limit,
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
  /** Set when the feed shows another player's matches (`?player=`). */
  subject: { leaguePlayerId: string; name: string } | null;
  /** The subject's matches this season, for the partner filter options. */
  subjectMatches: MatchResponse[] | null;
  myFlags: MatchFlagResponse[];
  now: number;
}

// The API filters by one player only, so partner filters scan the focused
// player's season page by page, up to this many matches.
const FILTER_PAGE = 200;
const FILTER_PAGES = 5;

/**
 * A league player of this league, or a 404. The /matches route guard and its
 * loader both ask, so a document request gets a real 404 status.
 */
export async function requireLeaguePlayer(
  orgId: string,
  leagueId: string,
  leaguePlayerId: string
) {
  const apiClientV3 = await requireApiClientV3();
  return apiClientV3.leaguePlayersApi
    .getPlayer(orgId, leagueId, leaguePlayerId)
    .catch(() => {
      throw new HttpError(404, 'Player not found');
    });
}

export type MatchesPageResult =
  | { ok: true; data: MatchesPageData }
  | { ok: false; status: number; message: string };

export const getMatchesPageFn = createServerFn({ method: 'GET' })
  .validator(
    (
      input: LeagueInput & {
        season?: string;
        leaguePlayerId: string | null;
        mine: boolean;
        playerId?: string;
        withId?: string;
        againstId?: string;
      }
    ) => input
  )
  .handler(async ({ data }): Promise<MatchesPageResult> => {
    try {
      return { ok: true, data: await loadMatchesPage(data) };
    } catch (error) {
      // Returned rather than thrown so the status survives the RPC boundary;
      // the loader re-throws it as an HttpError.
      if (error instanceof HttpError) {
        return { ok: false, status: error.status, message: error.message };
      }
      throw error;
    }
  });

async function loadMatchesPage(
  data: LeagueInput & {
    season?: string;
    leaguePlayerId: string | null;
    mine: boolean;
    playerId?: string;
    withId?: string;
    againstId?: string;
  }
): Promise<MatchesPageData> {
  const apiClientV3 = await requireApiClientV3();
  // Your own id is the same as "Mine".
  const subjectId =
    data.playerId && data.playerId !== data.leaguePlayerId
      ? data.playerId
      : null;
  const subjectPlayer = subjectId
    ? await requireLeaguePlayer(data.orgId, data.leagueId, subjectId)
    : null;
  const subject = subjectPlayer
    ? {
        leaguePlayerId: subjectPlayer.id,
        name: getPlayerDisplayName(subjectPlayer, 'Player'),
      }
    : null;
  try {
    const scope = resolveSeason(
      await apiClientV3.seasonsApi.listSeasons(data.orgId, data.leagueId),
      data.season
    );
    const mine = data.mine && data.leaguePlayerId != null;
    // Whose matches the feed shows; the partner filters are relative to them.
    const focus = subjectId ?? (mine ? data.leaguePlayerId! : null);
    // The viewer's week and swings; another player's view leaves them out.
    const viewerMatches = () =>
      data.leaguePlayerId && !subject
        ? apiClientV3.matchesApi
            .getMatches(data.orgId, data.leagueId, {
              seasonId: scope.seasonId,
              leaguePlayerId: data.leaguePlayerId,
              limit: FILTER_PAGE,
              offset: 0,
            })
            .catch((): MatchResponse[] => [])
        : Promise.resolve([] as MatchResponse[]);
    if (focus && (data.withId || data.againstId)) {
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
            leaguePlayerId: focus,
            limit: FILTER_PAGE,
            offset: i * FILTER_PAGE,
          }
        );
        all.push(...next);
        if (next.length < FILTER_PAGE) break;
      }
      const [myFlags, myMatches] = await Promise.all([
        apiClientV3.matchFlagsApi
          .getMyFlags(data.orgId, data.leagueId)
          .catch((): MatchFlagResponse[] => []),
        subject ? ([] as MatchResponse[]) : all.slice(0, FILTER_PAGE),
      ]);
      return {
        ...scope,
        myFlags,
        feed: {
          matches: filterByPartners(all, focus, data),
          hasMore: false,
        },
        filtered: { truncated },
        myMatches,
        subject,
        subjectMatches: subject ? all.slice(0, FILTER_PAGE) : null,
        now: Date.now(),
      };
    }
    const [page, myMatches, subjectMatches, myFlags] = await Promise.all([
      apiClientV3.matchesApi.getMatches(data.orgId, data.leagueId, {
        seasonId: scope.seasonId,
        leaguePlayerId: focus ?? undefined,
        limit: MATCHES_PAGE_SIZE + 1,
        offset: 0,
      }),
      viewerMatches(),
      subject
        ? apiClientV3.matchesApi
            .getMatches(data.orgId, data.leagueId, {
              seasonId: scope.seasonId,
              leaguePlayerId: subject.leaguePlayerId,
              limit: FILTER_PAGE,
              offset: 0,
            })
            .catch((): MatchResponse[] => [])
        : Promise.resolve(null),
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
      subject,
      subjectMatches,
      now: Date.now(),
    };
  } catch {
    throw new HttpError(500, 'Failed to load matches');
  }
}
