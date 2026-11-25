import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ChevronRight } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { HttpErrorView } from '@/components/http-error-view';
import { SeasonPicker } from '@/components/season-picker';
import { RatingChart, RatingChartLegend } from '@/components/charts';
import {
  ActivityCard,
  ProfileHeader,
  ProfileKpis,
  RecordsCard,
  RivalsCard,
  TeammatesCard,
} from '@/components/profile/profile-overview';
import { HttpError } from '@/lib/http-error';
import {
  WEEK_MS,
  bestRatingDay,
  peakRating,
  profileRecords,
  ratingChangeSince,
} from '@/lib/player-stats';
import { createRouteGuard } from '@/lib/server/http-error';
import { PLAYER_SEASON_MATCH_LIMIT } from '@/lib/server/player-matches';
import { loadPlayerProfileOnce } from '@/lib/server/profile';
import { loadShellDataOnce } from '@/lib/server/shell';
import { getPlayerDisplayName } from '@/lib/utils';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { resolveLeague } from '../route';
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
  // including `now`, which re-pins the activity grid.
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
  const { formatDate } = useLocaleFormatters();
  const data = Route.useLoaderData();
  const { season } = Route.useSearch();
  const navigate = Route.useNavigate();

  const stats = data.stats;

  const playerHref = (leaguePlayerId: string) =>
    `/${data.orgSlug}/${data.leagueSlug}/player/${leaguePlayerId}`;

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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {history.length > 0 ? (
          <section
            aria-labelledby="profile-rating-heading"
            className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 lg:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="profile-rating-heading" className="text-xl lg:text-2xl">
                Rating over time
              </h2>
              <RatingChartLegend />
            </div>
            <RatingChart
              points={history}
              label="Rating over time"
              current={isCurrentSeason}
            />
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
        {data.partners.teammates.length > 0 ? (
          <TeammatesCard
            rows={data.partners.teammates}
            duo={data.partners.duo}
            playerHref={playerHref}
          />
        ) : null}
        {data.partners.opponents.length > 0 ? (
          <RivalsCard
            rows={data.partners.opponents}
            nemesis={data.partners.nemesis}
            favourite={data.partners.favourite}
            playerHref={playerHref}
          />
        ) : null}
      </div>

      <ActivityCard matches={data.matches} now={data.now} />

      {stats.totalMatches > 0 ? (
        <AppLink
          to={`/${data.orgSlug}/${data.leagueSlug}/matches`}
          search={{
            // Your own matches are the list's default view.
            player: data.isCurrentUser ? undefined : playerId,
            season,
          }}
          className="flex min-h-12 items-center justify-center gap-1 rounded-lg border bg-card px-4 py-3 font-semibold transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {stats.totalMatches >= PLAYER_SEASON_MATCH_LIMIT
            ? // The profile counts at most this many; /matches has them all.
              `All ${PLAYER_SEASON_MATCH_LIMIT}+ matches`
            : `All ${stats.totalMatches} ${stats.totalMatches === 1 ? 'match' : 'matches'}`}
          <ChevronRight aria-hidden="true" className="size-4" />
        </AppLink>
      ) : null}
    </div>
  );
}
