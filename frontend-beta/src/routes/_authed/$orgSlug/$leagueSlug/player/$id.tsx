import { Fragment, useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { HttpErrorView } from '@/components/http-error-view';
import { SeasonPicker } from '@/components/season-picker';
import { LineChart } from '@/components/charts';
import {
  MatchCard,
  MatchDateHeader,
  MatchFlagButton,
} from '@/components/match-card';
import { FlagDialogs } from '@/components/profile/flag-dialogs';
import { PlayerFilter } from '@/components/profile/player-filter';
import {
  ActivityCard,
  ProfileHeader,
  ProfileKpis,
  RecordsCard,
  RivalsCard,
  TeammatesCard,
} from '@/components/profile/profile-overview';
import { Alert } from '@/components/ui/alert';
import { HttpError } from '@/lib/http-error';
import {
  createMatchFlagFn,
  deleteMatchFlagFn,
  updateMatchFlagFn,
} from '@/lib/match-flag-actions';
import {
  WEEK_MS,
  bestRatingDay,
  peakRating,
  profileRecords,
  ratingChangeSince,
} from '@/lib/player-stats';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadPlayerProfileOnce } from '@/lib/server/profile';
import { loadShellDataOnce } from '@/lib/server/shell';
import { getPlayerDisplayName } from '@/lib/utils';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { resolveLeague } from '../route';
import type { FlagActionResult } from '@/lib/match-flag-actions';
import type { PlayerProfileData } from '@/lib/server/profile';

interface ProfileInput {
  orgSlug: string;
  leagueSlug: string;
  playerId: string;
  season?: string;
}

type ProfileResult =
  | { ok: true; data: PlayerProfileData }
  | { ok: false; status: number; message: string };

/**
 * Slugs in, ids out — the org/league ids are always re-derived from `getMe()`
 * on the server and never accepted from the browser (the Svelte page posted
 * them as hidden form inputs).
 */
async function resolveLeagueFromSlugs(orgSlug: string, leagueSlug: string) {
  return resolveLeague(await loadShellDataOnce(), { orgSlug, leagueSlug });
}

const getPlayerProfileFn = createServerFn({ method: 'GET' })
  .validator((input: ProfileInput) => input)
  .handler(async ({ data }): Promise<ProfileResult> => {
    try {
      const league = await resolveLeagueFromSlugs(
        data.orgSlug,
        data.leagueSlug
      );
      const profile = await loadPlayerProfileOnce({
        orgId: league.orgId,
        leagueId: league.leagueId,
        leaguePlayerId: league.leaguePlayerId,
        playerId: data.playerId,
        orgSlug: data.orgSlug,
        leagueSlug: data.leagueSlug,
        season: data.season,
      });
      return { ok: true, data: profile };
    } catch (error) {
      // Returned rather than thrown so the status and the exact message
      // survive the RPC boundary; the loader re-throws it as an HttpError.
      if (error instanceof HttpError) {
        return { ok: false, status: error.status, message: error.message };
      }
      throw error;
    }
  });

/**
 * Document requests get a real 404 with the message `Player not found`, the
 * same funnel the Svelte loader used for a failure of ANY of its seven calls.
 * The per-request memo in `loadPlayerProfileOnce` means the loader below reuses
 * what this guard already fetched instead of pulling 1000 matches twice.
 */
const profileGuard = createRouteGuard(async ({ params, request }) => {
  const url = new URL(request.url);
  // `/:orgSlug/:leagueSlug/player/:id` — the path is the fallback source for
  // the three segments, because route params are handed to request middleware
  // by the runtime rather than by its type, and a missing `id` here would 404
  // a perfectly good profile.
  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const orgSlug = params.orgSlug ?? segments[0] ?? '';
  const leagueSlug = params.leagueSlug ?? segments[1] ?? '';
  const playerId = params.id ?? segments[3] ?? '';

  const league = await resolveLeagueFromSlugs(orgSlug, leagueSlug);
  const season = url.searchParams.get('season') ?? undefined;
  await loadPlayerProfileOnce({
    orgId: league.orgId,
    leagueId: league.leagueId,
    leaguePlayerId: league.leaguePlayerId,
    playerId,
    orgSlug,
    leagueSlug,
    season,
  });
});

export const Route = createFileRoute(
  '/_authed/$orgSlug/$leagueSlug/player/$id'
)({
  server: { middleware: [profileGuard] },
  validateSearch: (search: Record<string, unknown>) => ({
    season: typeof search.season === 'string' ? search.season : undefined,
  }),
  // `season` is a loader dep, so switching seasons refetches everything —
  // including `now`, which re-pins the match-history date boundaries.
  loaderDeps: ({ search: { season } }) => ({ season }),
  loader: async ({ params, deps }) => {
    const result = await getPlayerProfileFn({
      data: {
        orgSlug: params.orgSlug,
        leagueSlug: params.leagueSlug,
        playerId: params.id,
        season: deps.season,
      },
    });
    if (!result.ok) throw new HttpError(result.status, result.message);
    return result.data;
  },
  staticData: { wide: true },
  errorComponent: HttpErrorView,
  component: PlayerProfileRoute,
});

function PlayerProfileRoute() {
  const data = Route.useLoaderData();
  return (
    <PlayerProfilePage
      key={`${data.orgId}:${data.leagueId}:${data.player.id}`}
    />
  );
}

function PlayerProfilePage() {
  const { groupMatchesByDate, formatDate } = useLocaleFormatters();
  const data = Route.useLoaderData();
  const { season } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();

  const [flagResult, setFlagResult] = useState<FlagActionResult | null>(null);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [flagMatchId, setFlagMatchId] = useState('');
  // Only the value the textarea STARTS with. The live value lives inside
  // `FlagDialogs`, so typing a reason never re-renders this page.
  const [flagReasonSeed, setFlagReasonSeed] = useState('');
  const [editingFlagId, setEditingFlagId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [filteredPlayers, setFilteredPlayers] = useState<string[]>([]);

  const stats = data.stats;

  // These three were `$derived` in Svelte and recomputed only when their inputs
  // changed. `useMemo` restores that: without it, any unrelated page state
  // change re-filters up to 1000 matches, re-runs `groupMatchesByDate` and — the
  // expensive one — hands `LineChart` a fresh `data` array identity, which makes
  // Carbon re-run its chart update.

  // AND semantics: a match must contain EVERY selected player, on either team.
  // Client state only — never mirrored into the URL, and reset on navigation.
  const matches = useMemo(
    () =>
      (data.matches ?? []).filter((match) => {
        if (filteredPlayers.length === 0) return true;
        return filteredPlayers.every((id) =>
          match.teams.some((t) =>
            t.players.some((p) => p.leaguePlayerId === id)
          )
        );
      }),
    [data.matches, filteredPlayers]
  );

  // Grouped AFTER filtering, and with the server's `now` — never `Date.now()`,
  // which would disagree between SSR and hydration across local midnight.
  const matchGroups = useMemo(
    () => groupMatchesByDate(matches, data.now),
    [matches, data.now, groupMatchesByDate]
  );

  const chartData = useMemo(() => {
    const playerName =
      data.player.displayName ?? data.player.username ?? 'Player';
    return (
      data.ratingHistory?.entries?.map((entry) => ({
        date: entry.playedAt,
        player: playerName,
        rating: entry.mmr,
      })) ?? []
    );
  }, [data.player, data.ratingHistory]);

  const myFlags = data.myFlags;
  const myFlagForMatch = useCallback(
    (matchId: string) => myFlags?.find((f) => f.matchId === matchId),
    [myFlags]
  );

  const openFlagDialog = useCallback(
    (matchId: string) => {
      const existing = myFlagForMatch(matchId);
      setFlagMatchId(matchId);
      if (existing) {
        setEditingFlagId(existing.id);
        setFlagReasonSeed(existing.reason);
      } else {
        setEditingFlagId(null);
        setFlagReasonSeed('');
      }
      setFlagDialogOpen(true);
    },
    [myFlagForMatch]
  );

  const closeFlagDialog = () => {
    setFlagDialogOpen(false);
    setFlagMatchId('');
    setFlagReasonSeed('');
    setEditingFlagId(null);
  };

  // Every flag action re-runs the loader first (the `await update()` of the
  // Svelte `use:enhance`) and only then closes the dialog, and only on success.
  const settle = async (result: FlagActionResult) => {
    setFlagResult(result);
    await router.invalidate({ sync: true });
    return result;
  };

  const flagMatch = useMutation({
    mutationFn: (input: { matchId: string; reason: string }) =>
      createMatchFlagFn({
        data: {
          orgId: data.orgId,
          leagueId: data.leagueId,
          ...input,
        },
      }),
    onSuccess: async (result) => {
      await settle(result);
      if (result.success) closeFlagDialog();
    },
    onError: () =>
      setFlagResult({ success: false, message: 'Failed to create flag' }),
  });

  const updateFlag = useMutation({
    mutationFn: (input: { flagId: string; reason: string }) =>
      updateMatchFlagFn({
        data: {
          orgId: data.orgId,
          leagueId: data.leagueId,
          ...input,
        },
      }),
    onSuccess: async (result) => {
      await settle(result);
      if (result.success) closeFlagDialog();
    },
    onError: () =>
      setFlagResult({ success: false, message: 'Failed to update flag' }),
  });

  const deleteFlag = useMutation({
    mutationFn: (input: { flagId: string }) =>
      deleteMatchFlagFn({
        data: {
          orgId: data.orgId,
          leagueId: data.leagueId,
          ...input,
        },
      }),
    onSuccess: async (result) => {
      await settle(result);
      if (result.success) {
        setDeleteConfirmOpen(false);
        closeFlagDialog();
      }
    },
    onError: () =>
      setFlagResult({ success: false, message: 'Failed to delete flag' }),
  });

  const playerHref = (leaguePlayerId: string) =>
    `/${data.orgSlug}/${data.leagueSlug}/player/${leaguePlayerId}`;

  const findPlayer = (id: string) => data.players.find((p) => p.id === id);

  const playerId = data.player.id;
  const records = useMemo(
    () => profileRecords(data.matches, playerId),
    [data.matches, playerId]
  );
  const bestDay = useMemo(
    () =>
      bestRatingDay(data.matches, playerId, (at) =>
        formatDate(at, '', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
        })
      ),
    [data.matches, playerId, formatDate]
  );
  const history = useMemo(
    () =>
      [...(data.ratingHistory?.entries ?? [])].sort(
        (a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt)
      ),
    [data.ratingHistory]
  );
  const peak = peakRating(history);
  const isCurrentSeason = season == null || season === data.currentSeason?.id;
  const weekDelta = isCurrentSeason
    ? ratingChangeSince(history, data.now - WEEK_MS)
    : null;

  const seasonPicker =
    data.seasons != null &&
    data.seasons.length > 1 &&
    data.currentSeason != null ? (
      <SeasonPicker
        seasons={data.seasons}
        currentSeason={data.currentSeason}
        selectedSeasonId={season}
        onSeasonChange={(next) => {
          setFlagResult(null);
          void navigate({
            search: (prev) => ({
              ...prev,
              season: next.id === data.currentSeason?.id ? undefined : next.id,
            }),
            replace: true,
          });
        }}
      />
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        title={
          <h1 className="min-w-0 truncate text-3xl font-bold tracking-tight lg:text-5xl">
            {getPlayerDisplayName(data.player, 'Player')}
          </h1>
        }
        name={getPlayerDisplayName(data.player, 'Player')}
        username={
          data.player.username && data.player.displayName
            ? data.player.username
            : null
        }
        isCurrentUser={data.isCurrentUser}
        matchesPlayed={stats.totalMatches}
        stats={stats}
        peak={peak}
        weekDelta={weekDelta}
        actions={seasonPicker}
      />

      {flagResult?.success && flagResult.message ? (
        <Alert variant="default">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">{flagResult.message}</span>
          </div>
        </Alert>
      ) : flagResult?.success === false ? (
        <Alert variant="destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">{flagResult.message}</span>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {chartData.length > 0 ? (
          <section
            aria-labelledby="profile-rating-heading"
            className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 lg:p-5 [&_.cds--chart-holder]:bg-transparent"
          >
            <h2 id="profile-rating-heading" className="text-xl lg:text-2xl">
              Rating over time
            </h2>
            <LineChart data={chartData} height={300} legend={false} />
          </section>
        ) : null}
        <ProfileKpis stats={stats} records={records} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start xl:grid-cols-3">
        <RecordsCard
          records={records}
          bestDay={bestDay}
          className="lg:order-last"
        />
        {data.teammates.length > 0 ? (
          <TeammatesCard rows={data.teammates} playerHref={playerHref} />
        ) : null}
        {data.opponents.length > 0 ? (
          <RivalsCard rows={data.opponents} playerHref={playerHref} />
        ) : null}
      </div>

      <ActivityCard matches={data.matches} now={data.now} />

      {data.matches.length > 0 ? (
        <section
          aria-labelledby="profile-matches-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="profile-matches-heading" className="text-2xl">
            Matches
          </h2>
          <div className="flex flex-col gap-2 lg:max-w-md">
            <PlayerFilter
              players={data.players ?? []}
              // Deduped on select: the Svelte version pushed a duplicate id and
              // crashed its keyed loop.
              onSelected={(id) =>
                setFilteredPlayers((prev) =>
                  prev.includes(id) ? prev : [...prev, id]
                )
              }
            />
            <div className="flex flex-wrap gap-1.5">
              {filteredPlayers.map((id) => {
                const p = findPlayer(id);
                if (p == null) return null;
                const name = p.displayName ?? p.username ?? 'Unknown';
                return (
                  <div
                    key={id}
                    className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 text-sm text-secondary-foreground"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${name} from the filter`}
                      className="rounded-full p-1 hover:bg-background/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      onClick={() =>
                        setFilteredPlayers((prev) =>
                          prev.filter((pid) => pid !== id)
                        )
                      }
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-2">
            {matches.length === 0 ? (
              <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
                No matches found
              </p>
            ) : null}
            {/* Date headers are flex SIBLINGS of the rows, not wrappers — a
                wrapper element would change the vertical rhythm. */}
            {matchGroups.map((group) => {
              const existingFlag = myFlagForMatch(group.match.id);
              return (
                <Fragment key={group.match.id}>
                  {group.label ? <MatchDateHeader label={group.label} /> : null}
                  <div
                    className={`rounded-lg ${existingFlag ? 'ring-1 ring-red-400' : ''}`}
                  >
                    <div className="flex items-stretch gap-1">
                      <div className="min-w-0 flex-1">
                        {/* No `playerHref`: names inside a profile's match
                            cards are plain text. */}
                        <MatchCard
                          match={group.match}
                          showMmr
                          viewerId={playerId}
                        />
                      </div>
                      <MatchFlagButton
                        flagged={existingFlag != null}
                        onClick={() => openFlagDialog(group.match.id)}
                      />
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </section>
      ) : null}

      <FlagDialogs
        open={flagDialogOpen}
        editingFlagId={editingFlagId}
        initialReason={flagReasonSeed}
        onClose={closeFlagDialog}
        onSubmit={(reason) => {
          if (editingFlagId) {
            updateFlag.mutate({ flagId: editingFlagId, reason });
          } else {
            flagMatch.mutate({ matchId: flagMatchId, reason });
          }
        }}
        deleteConfirmOpen={deleteConfirmOpen}
        onDeleteConfirmChange={setDeleteConfirmOpen}
        onDelete={() => {
          if (editingFlagId) deleteFlag.mutate({ flagId: editingFlagId });
        }}
      />
    </div>
  );
}
