import { Fragment, useCallback, useEffect, useState } from 'react';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AlertCircle, Check, CheckCircle, Flag } from 'lucide-react';
import { HttpErrorView } from '@/components/http-error-view';
import { Leaderboard } from '@/components/leaderboard';
import { MatchCard, MatchDateHeader } from '@/components/match-card';
import { PageTitle } from '@/components/page-title';
import { ReportMatchModal } from '@/components/report-match-modal';
import { SeasonPicker } from '@/components/season-picker';
import { UserStatsModal } from '@/components/user-stats-modal';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useHydrated } from '@/hooks/use-hydrated';
import { useShowMmr } from '@/hooks/use-show-mmr';
import { HttpError } from '@/lib/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { selectCurrentSeason } from '@/lib/util/season';
import { groupMatchesByDate } from '@/lib/utils';
import type { FlagActionResult } from '@/components/report-match-modal';
import type {
  LeaderboardEntryResponse,
  LeaderboardResponse,
  LeagueRatingHistoryEntry,
  MatchFlagResponse,
  MatchResponse,
  SeasonResponse,
} from '@/api-v3';

interface LeagueHomeSearch {
  season?: string;
}

interface LeagueHomeData {
  leaderboard: LeaderboardResponse;
  recentMatches: MatchResponse[];
  seasons: SeasonResponse[];
  currentSeason: SeasonResponse | null;
  /** No `?season=`, or it names the current season. Gates the report flow. */
  isCurrentSeason: boolean;
  /**
   * `?season=` when present, otherwise the current season resolved from the
   * seasons list. Every season-scoped call on this page must use this, not the
   * raw search param — the default view is the *current season*, not all-time.
   */
  seasonId: string | undefined;
  myFlags: MatchFlagResponse[];
  /**
   * Server-pinned clock shipped with the payload so the match-feed date
   * buckets are identical during SSR and hydration. A page served at 23:59:59
   * must not relabel itself when the client hydrates at 00:00:01 — never
   * substitute a client-side `Date.now()` in the grouping call.
   */
  now: number;
}

const getLeagueHomeFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgId: string; leagueId: string; season?: string }) => input
  )
  .handler(async ({ data }): Promise<LeagueHomeData> => {
    const apiClientV3 = await requireApiClientV3();

    try {
      const seasons = await apiClientV3.seasonsApi.listSeasons(
        data.orgId,
        data.leagueId
      );
      const currentSeason = selectCurrentSeason(seasons);
      // `undefined` when the league has no seasons at all — the API then reads
      // it as "all-time / league-level".
      const seasonId = data.season ?? currentSeason?.id;
      const isCurrentSeason =
        currentSeason != null &&
        (data.season == null || data.season === currentSeason.id);

      const [leaderboard, recentMatches, myFlags] = await Promise.all([
        apiClientV3.leaderboardApi.getLeaderboard(
          data.orgId,
          data.leagueId,
          seasonId
        ),
        apiClientV3.matchesApi.getMatches(data.orgId, data.leagueId, {
          seasonId,
          limit: 5,
          offset: 0,
        }),
        // Individually caught: a flag-service blip degrades to "no flags", it
        // does not error the page.
        apiClientV3.matchFlagsApi
          .getMyFlags(data.orgId, data.leagueId)
          .catch((): MatchFlagResponse[] => []),
      ]);

      return {
        leaderboard,
        recentMatches,
        seasons,
        currentSeason,
        isCurrentSeason,
        seasonId,
        myFlags,
        now: Date.now(),
      };
    } catch {
      throw new HttpError(500, 'Failed to load leaderboard');
    }
  });

/**
 * Deliberately separate from the page load and never awaited by the loader:
 * the leaderboard renders immediately with placeholder sparklines and fills
 * them in when this resolves. A failure degrades to "no sparklines".
 */
const getLeagueRatingHistoryFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgId: string; leagueId: string; seasonId?: string }) => input
  )
  .handler(
    async ({ data }): Promise<{ entries: LeagueRatingHistoryEntry[] }> => {
      const apiClientV3 = await requireApiClientV3();
      return apiClientV3.ratingHistoryApi
        .getLeagueHistory(data.orgId, data.leagueId, data.seasonId)
        .catch(() => ({ entries: [] }));
    }
  );

const flagMatchFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      matchId: string;
      reason: string;
    }) => input
  )
  .handler(async ({ data }): Promise<FlagActionResult> => {
    const reason = data.reason?.trim();
    if (!data.matchId || !reason || !data.orgId || !data.leagueId) {
      return { success: false, message: 'Match ID and reason are required' };
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchFlagsApi.createFlag(data.orgId, data.leagueId, {
        matchId: data.matchId,
        reason,
      });
    } catch (error) {
      const { message } = await getApiErrorDetails(
        error,
        'Failed to create flag'
      );
      return { success: false, message };
    }

    return { success: true, message: 'Match flagged successfully' };
  });

const updateFlagFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      flagId: string;
      reason: string;
    }) => input
  )
  .handler(async ({ data }): Promise<FlagActionResult> => {
    const reason = data.reason?.trim();
    if (!data.flagId || !reason || !data.orgId || !data.leagueId) {
      return { success: false, message: 'Flag ID and reason are required' };
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchFlagsApi.updateFlagReason(
        data.orgId,
        data.leagueId,
        data.flagId,
        { reason }
      );
    } catch (error) {
      const { message } = await getApiErrorDetails(
        error,
        'Failed to update flag'
      );
      return { success: false, message };
    }

    return { success: true, message: 'Flag updated successfully' };
  });

const deleteFlagFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgId: string; leagueId: string; flagId: string }) => input
  )
  .handler(async ({ data }): Promise<FlagActionResult> => {
    if (!data.flagId || !data.orgId || !data.leagueId) {
      return { success: false, message: 'Flag ID is required' };
    }

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchFlagsApi.deleteFlag(
        data.orgId,
        data.leagueId,
        data.flagId
      );
    } catch (error) {
      const { message } = await getApiErrorDetails(
        error,
        'Failed to delete flag'
      );
      return { success: false, message };
    }

    return { success: true, message: 'Flag deleted successfully' };
  });

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/')({
  // Permissive on purpose: the Svelte page forwarded whatever `?season=` held
  // straight to the API. A stricter uuid check would turn a bad link into a
  // client-side validation error instead of the API's own answer.
  validateSearch: (search: Record<string, unknown>): LeagueHomeSearch => {
    const season = search.season;
    return typeof season === 'string' && season.length > 0 ? { season } : {};
  },
  // Makes `?season=` part of the loader identity, so switching seasons is a
  // full data refresh rather than client-side filtering.
  loaderDeps: ({ search }) => ({ season: search.season }),
  loader: async ({ context, deps, params }) => {
    const { orgId, leagueId, leaguePlayerId } = context.league;

    const home = await getLeagueHomeFn({
      data: { orgId, leagueId, season: deps.season },
    });

    // Awaited never: the promise is streamed to the client, so the leaderboard
    // paints with placeholder sparklines. It has to run after the home fn only
    // because it needs that fn's *resolved* season (`?season=` ?? current
    // season) — passing the raw search param would draw all-time sparklines on
    // the default view.
    const ratingHistoryPromise = getLeagueRatingHistoryFn({
      data: { orgId, leagueId, seasonId: home.seasonId },
    }).catch(() => ({ entries: [] as LeagueRatingHistoryEntry[] }));

    return {
      ...home,
      ratingHistoryPromise,
      orgId,
      leagueId,
      leaguePlayerId,
      orgSlug: params.orgSlug,
      leagueSlug: params.leagueSlug,
    };
  },
  errorComponent: HttpErrorView,
  component: LeagueHomePage,
});

function LeagueHomePage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  // The report trigger and the MMR toggle do nothing at all until React has
  // attached their handlers: the modal is client-only and the toggle writes to
  // localStorage. The SSR'd markup paints (and is clickable) well before
  // hydration finishes, and a click landing in that window is dropped, not
  // replayed — so keep both disabled until the page is actually interactive.
  const hydrated = useHydrated();
  const [showMmr, setShowMmr] = useShowMmr();

  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] =
    useState<LeaderboardEntryResponse | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  // `undefined` => still streaming => sparkline placeholders. Never reset to
  // `undefined` on navigation, so the previous season's line can linger for a
  // moment after a season switch — same as the Svelte original.
  const [ratingHistory, setRatingHistory] = useState<
    LeagueRatingHistoryEntry[] | undefined
  >(undefined);
  const [formResult, setFormResult] = useState<FlagActionResult | null>(null);

  const recentMatchGroups = groupMatchesByDate(
    data.recentMatches ?? [],
    data.now
  );

  const { ratingHistoryPromise } = data;
  useEffect(() => {
    let cancelled = false;
    void ratingHistoryPromise.then((res) => {
      if (!cancelled) setRatingHistory(res.entries);
    });
    return () => {
      cancelled = true;
    };
  }, [ratingHistoryPromise]);

  const fetchRecentMatch = useCallback(
    async (
      leaguePlayerId: string,
      seasonId: string | undefined
    ): Promise<MatchResponse | null> => {
      const params = new URLSearchParams({ leaguePlayerId });
      if (seasonId) params.set('season', seasonId);
      const res = await fetch(
        `/${data.orgSlug}/${data.leagueSlug}/api/recent-match?${params}`
      );
      if (!res.ok) throw new Error('Failed to fetch recent match');
      const body = (await res.json()) as { match: MatchResponse | null };
      return body.match;
    },
    [data.orgSlug, data.leagueSlug]
  );

  /**
   * Replaces `use:enhance` + `update()`: on success the page banner is set and
   * every loader re-runs, so the feed and the user's flags are fresh by the
   * time the dialog closes. A failure never touches the banner — it stays in
   * the dialog, exactly like the Svelte failure branch (which skips `update()`).
   */
  const afterFlagAction = useCallback(
    async (result: FlagActionResult): Promise<FlagActionResult> => {
      if (result.success) {
        setFormResult(result);
        await router.invalidate();
      }
      return result;
    },
    [router]
  );

  const handleCreateFlag = useCallback(
    (input: { matchId: string; reason: string }) =>
      flagMatchFn({
        data: { orgId: data.orgId, leagueId: data.leagueId, ...input },
      }).then(afterFlagAction),
    [data.orgId, data.leagueId, afterFlagAction]
  );

  const handleUpdateFlag = useCallback(
    (input: { flagId: string; reason: string }) =>
      updateFlagFn({
        data: { orgId: data.orgId, leagueId: data.leagueId, ...input },
      }).then(afterFlagAction),
    [data.orgId, data.leagueId, afterFlagAction]
  );

  const handleDeleteFlag = useCallback(
    (input: { flagId: string }) =>
      deleteFlagFn({
        data: { orgId: data.orgId, leagueId: data.leagueId, ...input },
      }).then(afterFlagAction),
    [data.orgId, data.leagueId, afterFlagAction]
  );

  const handleSeasonChange = (season: SeasonResponse) => {
    const isCurrent = season.id === data.currentSeason?.id;
    // SvelteKit drops `form` on every navigation; the component does not
    // unmount across a search-param change, so clear the banner by hand.
    setFormResult(null);
    void navigate({
      search: (prev: LeagueHomeSearch) => ({
        ...prev,
        season: isCurrent ? undefined : season.id,
      }),
      replace: true,
    });
  };

  const canReport = Boolean(data.leaguePlayerId && data.isCurrentSeason);

  return (
    <>
      <div className="flex flex-col gap-4">
        <PageTitle srOnly>Leaderboard</PageTitle>

        {formResult?.success && formResult.message ? (
          <Alert variant="default">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">{formResult.message}</span>
            </div>
          </Alert>
        ) : formResult?.success === false ? (
          <Alert variant="destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">{formResult?.message}</span>
            </div>
          </Alert>
        ) : null}

        {data.seasons != null &&
        data.seasons.length > 1 &&
        data.currentSeason ? (
          <div className="self-end">
            <SeasonPicker
              seasons={data.seasons}
              currentSeason={data.currentSeason}
              selectedSeasonId={search.season}
              onSeasonChange={handleSeasonChange}
            />
          </div>
        ) : null}

        <div className="flex">
          <div className="flex flex-1 items-center gap-3">
            <h2 className="text-2xl md:text-4xl">Recent Matches</h2>
            {canReport ? (
              <Button
                variant="outline"
                size="sm"
                disabled={!hydrated}
                onClick={() => setReportModalOpen(true)}
              >
                <Flag className="mr-1.5 h-4 w-4" />
                Report match
              </Button>
            ) : null}
          </div>
          <div className="flex items-center space-x-3 self-center">
            <Label id="show-mmr-label" htmlFor="show-mmr">
              MMR:
            </Label>
            {/* Hand-rolled because the library ships no Checkbox: e2e clicks
                `button[role=checkbox]#show-mmr` exactly. */}
            <button
              type="button"
              id="show-mmr"
              role="checkbox"
              aria-checked={showMmr}
              aria-labelledby="show-mmr-label"
              data-state={showMmr ? 'checked' : 'unchecked'}
              disabled={!hydrated}
              onClick={() => setShowMmr(!showMmr)}
              className="active:scale-98 data-[state=unchecked]:border-border-input data-[state=unchecked]:hover:border-dark-40 peer inline-flex size-[25px] items-center justify-center rounded-md border border-muted bg-primary transition-all duration-150 ease-in-out data-[state=unchecked]:bg-white"
            >
              {showMmr ? (
                <Check className="size-[15px] font-bold text-primary-foreground" />
              ) : null}
            </button>
          </div>
        </div>

        {/* Flat list on purpose: date headers are plain siblings of the cards,
            not wrappers, so `gap-2` spaces them identically and the e2e
            selector `.flex.flex-1.flex-col.items-stretch > div.bg-card` still
            resolves to a card. There is no empty state. */}
        <div className="flex flex-1 flex-col items-stretch gap-2">
          {recentMatchGroups.map((group) => (
            <Fragment key={group.match.id}>
              {group.label ? <MatchDateHeader label={group.label} /> : null}
              <MatchCard match={group.match} showMmr={showMmr} />
            </Fragment>
          ))}
        </div>

        <h2 className="text-2xl md:text-4xl">Leaderboard</h2>
        <Leaderboard
          entries={data.leaderboard?.entries ?? []}
          ratingHistory={ratingHistory}
          onSelect={(entry) => {
            setSelectedEntry(entry);
            setStatsModalOpen(true);
          }}
          currentLeaguePlayerId={data.leaguePlayerId}
        />
      </div>

      {/* Stays mounted after close — `selectedEntry` is never cleared, so the
          dialog animates out with the last entry's data. */}
      {selectedEntry ? (
        <UserStatsModal
          entry={selectedEntry}
          open={statsModalOpen}
          onOpenChange={setStatsModalOpen}
          fetchRecentMatch={fetchRecentMatch}
          playerHrefBase={`/${data.orgSlug}/${data.leagueSlug}/player`}
          seasonId={search.season}
        />
      ) : null}

      {/* Double-gated: league membership AND the current season. */}
      {canReport && data.leaguePlayerId ? (
        <ReportMatchModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          orgId={data.orgId}
          leagueId={data.leagueId}
          seasonId={data.currentSeason?.id}
          leaguePlayerId={data.leaguePlayerId}
          userFlags={data.myFlags ?? []}
          onCreateFlag={handleCreateFlag}
          onUpdateFlag={handleUpdateFlag}
          onDeleteFlag={handleDeleteFlag}
        />
      ) : null}
    </>
  );
}
