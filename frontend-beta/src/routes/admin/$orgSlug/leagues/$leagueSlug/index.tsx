import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { CalendarDays, Flag, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { HttpErrorView } from '@/components/http-error-view';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { requireAdminOrg } from '@/lib/server/admin';
import {
  formatLeagueFormat,
  getPlayerDisplayName,
  openFlagsForLeague,
} from '@/lib/utils';
import type { MatchResponse, SeasonResponse } from '@/api-v3';

interface LeagueOverview {
  recentMatches: MatchResponse[];
  currentSeason: SeasonResponse | null;
  playerCount: number;
}

const loadLeagueOverviewFn = createServerFn({ method: 'GET' })
  .validator((input: { orgSlug: string; leagueId: string }) => input)
  .handler(async ({ data }): Promise<LeagueOverview> => {
    const org = await requireAdminOrg(data.orgSlug);
    const apiClientV3 = await requireApiClientV3();

    // The current season degrades silently; matches and players do not — a
    // failure there is a page error. Open flags come from the badges endpoint.
    const [recentMatches, currentSeason, players] = await Promise.all([
      apiClientV3.matchesApi.getMatches(org.id, data.leagueId, { limit: 5 }),
      apiClientV3.seasonsApi
        .getCurrentSeason(org.id, data.leagueId)
        .catch(() => null),
      apiClientV3.leaguePlayersApi.listPlayers(org.id, data.leagueId),
    ]);

    return {
      recentMatches,
      currentSeason,
      playerCount: players.length,
    };
  });

export const Route = createFileRoute('/admin/$orgSlug/leagues/$leagueSlug/')({
  loader: ({ context, params }) =>
    loadLeagueOverviewFn({
      data: { orgSlug: params.orgSlug, leagueId: context.leagueId },
    }),
  errorComponent: HttpErrorView,
  component: LeagueAdminOverviewPage,
});

const adminRoute = getRouteApi('/admin');

function LeagueAdminOverviewPage() {
  const { formatDate } = useLocaleFormatters();
  const { orgSlug, leagueSlug } = Route.useParams();
  const { league } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const { badges } = adminRoute.useLoaderData();

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Current season
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {data.currentSeason ? (
              <>
                <div className="text-lg font-semibold">
                  {formatDate(data.currentSeason.startsAt)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active since this date
                </p>
              </>
            ) : (
              <div className="text-lg font-semibold">None</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.playerCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Format</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatLeagueFormat(league.teamSize)}
            </div>
            <p className="text-xs text-muted-foreground">
              {league.winningScore == null
                ? 'Free-form scoring'
                : `First to ${league.winningScore}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open flags</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {openFlagsForLeague(badges, league.id)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent matches</CardTitle>
          <CardDescription>
            Five most recent matches in this league.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentMatches.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No matches yet.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentMatches.map((match) => {
                // Positional, deliberately NOT by `team.index` — unlike
                // MatchCard.
                const team1 = match.teams[0];
                const team2 = match.teams[1];
                return (
                  <div
                    key={match.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="text-sm">
                      <span className={team1?.isWinner ? 'font-semibold' : ''}>
                        {(team1?.players ?? [])
                          .map((p) => getPlayerDisplayName(p, '?'))
                          .join(' & ')}
                      </span>{' '}
                      <span className="mx-2 text-muted-foreground">
                        {`${team1?.score ?? ''} – ${team2?.score ?? ''}`}
                      </span>{' '}
                      <span className={team2?.isWinner ? 'font-semibold' : ''}>
                        {(team2?.players ?? [])
                          .map((p) => getPlayerDisplayName(p, '?'))
                          .join(' & ')}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {formatDate(match.playedAt)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link
            to="/admin/$orgSlug/leagues/$leagueSlug/matches"
            params={{ orgSlug, leagueSlug }}
          >
            All matches
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link
            to="/admin/$orgSlug/leagues/$leagueSlug/match-flags"
            params={{ orgSlug, leagueSlug }}
          >
            Match flags
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link
            to="/admin/$orgSlug/leagues/$leagueSlug/seasons"
            params={{ orgSlug, leagueSlug }}
          >
            Seasons
          </Link>
        </Button>
      </div>
    </div>
  );
}
