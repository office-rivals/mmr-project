import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Flag, Trophy, UserCircle, Users } from 'lucide-react';
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
import { OpenFlagBadge } from '@/components/admin/open-flag-badge';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { requireAdminOrg } from '@/lib/server/admin';
import {
  formatLeagueFormat,
  getRoleBadgeVariant,
  openFlagsForLeague,
  openFlagsForOrg,
} from '@/lib/utils';
import type { LeagueResponse } from '@/api-v3';

interface OrgOverview {
  leagues: LeagueResponse[];
  leagueCount: number;
  activeMemberCount: number;
  ownerCount: number;
  moderatorCount: number;
  memberCount: number;
}

const loadOrgOverviewFn = createServerFn({ method: 'GET' })
  .validator((orgSlug: string) => orgSlug)
  .handler(async ({ data: orgSlug }): Promise<OrgOverview> => {
    const org = await requireAdminOrg(orgSlug);
    const apiClientV3 = await requireApiClientV3();

    const [members, leagues] = await Promise.all([
      apiClientV3.organizationMembersApi.listMembers(org.id),
      apiClientV3.leaguesApi.listLeagues(org.id),
    ]);

    // Open-flag counts come from the badges endpoint (one grouped query
    // server-side) rather than a per-league fan-out.
    const activeMembers = members.filter((m) => m.status === 'Active');

    return {
      leagues,
      leagueCount: leagues.length,
      activeMemberCount: activeMembers.length,
      ownerCount: activeMembers.filter((m) => m.role === 'Owner').length,
      moderatorCount: activeMembers.filter((m) => m.role === 'Moderator')
        .length,
      memberCount: activeMembers.filter((m) => m.role === 'Member').length,
    };
  });

export const Route = createFileRoute('/admin/$orgSlug/')({
  loader: ({ params }) => loadOrgOverviewFn({ data: params.orgSlug }),
  errorComponent: HttpErrorView,
  component: OrgAdminOverviewPage,
});

const plural = (n: number) => (n === 1 ? '' : 's');

const adminRoute = getRouteApi('/admin');

function OrgAdminOverviewPage() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const { badges } = adminRoute.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        <p className="text-sm text-muted-foreground">
          Overview of activity in this organization.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leagues</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.leagueCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeMemberCount}</div>
            <p className="text-xs text-muted-foreground">
              {data.ownerCount} Owner{plural(data.ownerCount)} ·{' '}
              {data.moderatorCount} Mod{plural(data.moderatorCount)} ·{' '}
              {data.memberCount} Member{plural(data.memberCount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Open match flags
            </CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {openFlagsForOrg(badges, org.id)}
            </div>
            <p className="text-xs text-muted-foreground">across all leagues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your role</CardTitle>
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant={getRoleBadgeVariant(org.role)}>{org.role}</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leagues</CardTitle>
          <CardDescription>
            Manage matches, flags and seasons inside each league.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.leagues.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No leagues yet. Create one from the league list.
            </p>
          ) : (
            <div className="space-y-2">
              {data.leagues.map((league) => {
                const openFlags = openFlagsForLeague(badges, league.id);
                return (
                  <Link
                    key={league.id}
                    to="/admin/$orgSlug/leagues/$leagueSlug"
                    params={{ orgSlug: org.slug, leagueSlug: league.slug }}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/40"
                  >
                    <div>
                      <div className="font-medium">{league.name}</div>
                      <p className="text-xs text-muted-foreground">
                        {formatLeagueFormat(league.teamSize)} · {league.slug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <OpenFlagBadge count={openFlags} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/admin/$orgSlug/members" params={{ orgSlug: org.slug }}>
            Manage members
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/admin/$orgSlug/leagues" params={{ orgSlug: org.slug }}>
            Manage leagues
          </Link>
        </Button>
      </div>
    </div>
  );
}
