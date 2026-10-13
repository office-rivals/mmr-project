import { Fragment, useCallback, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import {
  AlertCircle,
  CheckCircle,
  Flag,
  Handshake,
  Swords,
  X,
} from 'lucide-react';
import { HttpErrorView } from '@/components/http-error-view';
import { Kpi } from '@/components/kpi';
import { PageTitle } from '@/components/page-title';
import { SeasonPicker } from '@/components/season-picker';
import { LineChart } from '@/components/charts';
import { MatchCard, MatchDateHeader } from '@/components/match-card';
import { FlagDialogs } from '@/components/profile/flag-dialogs';
import { HeadToHeadTable } from '@/components/profile/head-to-head-table';
import { PlayerFilter } from '@/components/profile/player-filter';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { HttpError } from '@/lib/http-error';
import {
  createMatchFlagFn,
  deleteMatchFlagFn,
  updateMatchFlagFn,
} from '@/lib/match-flag-actions';
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
  const { groupMatchesByDate, formatNumber, formatRelativeTime } =
    useLocaleFormatters();
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <PageTitle>{getPlayerDisplayName(data.player, 'Player')}</PageTitle>
        <div className="flex items-center justify-center gap-2">
          {data.player?.username && data.player?.displayName ? (
            <p className="text-base text-muted-foreground">
              {`@${data.player.username}`}
            </p>
          ) : null}
          {data.isCurrentUser ? (
            <Badge
              variant="secondary"
              className="shrink-0 uppercase tracking-wider"
            >
              You
            </Badge>
          ) : null}
        </div>
      </div>

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

      {data.seasons != null &&
      data.seasons.length > 1 &&
      data.currentSeason != null ? (
        <div className="self-end">
          <SeasonPicker
            seasons={data.seasons}
            currentSeason={data.currentSeason}
            selectedSeasonId={season}
            onSeasonChange={(next) => {
              setFlagResult(null);
              void navigate({
                search: (prev) => ({
                  ...prev,
                  season:
                    next.id === data.currentSeason?.id ? undefined : next.id,
                }),
                replace: true,
              });
            }}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
        <Kpi title="Rank">
          {stats.rank != null && stats.rank > 0 ? `#${stats.rank}` : '—'}
        </Kpi>
        <Kpi title="MMR">{stats.mmr ?? '🐣'}</Kpi>
        <Kpi title="# Matches">{stats.totalMatches}</Kpi>
        <Kpi title="# Wins">{stats.wins}</Kpi>
        <Kpi title="# Losses">{stats.lost}</Kpi>
        <Kpi title="Win rate">
          {/* 1 fraction digit here; the head-to-head tables use 0. */}
          {formatNumber(stats.winrate, {
            style: 'percent',
            maximumFractionDigits: 1,
          })}
        </Kpi>
        {stats.daysSinceLastMatch != null ? (
          <Kpi title="Last match">
            {formatRelativeTime(stats.daysSinceLastMatch, 'day', {
              style: 'narrow',
              numeric: stats.daysSinceLastMatch !== 0 ? 'always' : 'auto',
            })}
          </Kpi>
        ) : null}
        {stats.winningStreak > 0 || stats.losingStreak > 0 ? (
          <Kpi title="Streak">
            {stats.winningStreak > 0 ? <>🔥 {stats.winningStreak}</> : null}
            {stats.losingStreak > 0 ? (
              <>
                {stats.losingStreak >= 7 ? '⛈️' : '🌧️'} {stats.losingStreak}
              </>
            ) : null}
          </Kpi>
        ) : null}
      </div>

      {chartData.length > 0 ? (
        <>
          <h2 className="-mb-6 mt-6 text-2xl md:text-4xl">Rating over time</h2>
          <LineChart data={chartData} height={300} legend={false} />
        </>
      ) : null}

      {data.opponents.length > 0 ? (
        <HeadToHeadTable
          title="Most common opponents"
          icon={<Swords />}
          rows={data.opponents}
          playerHref={playerHref}
        />
      ) : null}

      {data.teammates.length > 0 ? (
        <HeadToHeadTable
          title="Most common teammates"
          icon={<Handshake />}
          rows={data.teammates}
          playerHref={playerHref}
        />
      ) : null}

      {data.matches.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-4xl">Matches</h2>
          </div>
          <div className="flex flex-col space-y-2">
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
            <div className="flex flex-wrap gap-1">
              {filteredPlayers.map((id) => {
                const p = findPlayer(id);
                if (p == null) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center space-x-2 rounded-md bg-secondary p-2 text-sm text-secondary-foreground"
                  >
                    <span>{p.displayName ?? p.username ?? 'Unknown'}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setFilteredPlayers((prev) =>
                          prev.filter((pid) => pid !== id)
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-1 flex-col items-stretch gap-2">
            {matches.length === 0 ? <p>No matches found</p> : null}
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
                      <div className="flex-1">
                        {/* No `playerHref`: names inside a profile's match
                            cards are plain text. */}
                        <MatchCard match={group.match} showMmr />
                      </div>
                      <button
                        type="button"
                        className={`rounded p-2 transition-colors hover:bg-muted ${
                          existingFlag
                            ? 'text-red-500'
                            : 'text-muted-foreground'
                        }`}
                        title={existingFlag ? 'Edit flag' : 'Flag this match'}
                        onClick={() => openFlagDialog(group.match.id)}
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
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
