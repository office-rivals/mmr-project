import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Trophy, Users } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Alert } from '@/components/ui/alert';
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
import { fetchOrgClaimStatus } from '@/lib/claim-actions';
import { HttpError } from '@/lib/http-error';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { createRouteGuard } from '@/lib/server/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { loadShellData, loadShellDataOnce } from '@/lib/server/shell';
import { formatLeagueFormat } from '@/lib/utils';
import type { AuthedShellData } from '@/lib/shell';
import type { LeagueResponse } from '@/api-v3';

function resolveOrg(shell: AuthedShellData, orgSlug: string) {
  if (shell.profileLoadFailed) {
    throw new HttpError(500, 'Failed to load user profile');
  }
  const org = shell.organizations.find((o) => o.slug === orgSlug);
  if (!org) throw new HttpError(404, `Organization '${orgSlug}' not found`);
  return org;
}

const orgGuard = createRouteGuard(async ({ params }) => {
  resolveOrg(await loadShellDataOnce(), params.orgSlug ?? '');
});

const listLeaguesFn = createServerFn({ method: 'GET' })
  .validator((orgId: string) => orgId)
  .handler(async ({ data: orgId }): Promise<LeagueResponse[]> => {
    const apiClientV3 = await requireApiClientV3();
    return apiClientV3.leaguesApi.listLeagues(orgId);
  });

type JoinLeagueResult =
  { status: 'error'; error: string } | { status: 'ok'; redirectTo: string };

interface JoinLeagueInput {
  orgSlug: string;
  leagueId: string;
  leagueSlug: string;
}

async function joinLeague(data: JoinLeagueInput): Promise<JoinLeagueResult> {
  if (!data.leagueId || !data.leagueSlug) {
    return failServerAction(400, {
      status: 'error',
      error: 'League selection is invalid',
    });
  }

  const shell = await loadShellData();
  if (shell.profileLoadFailed) {
    return failServerAction(500, {
      status: 'error',
      error: 'Failed to load user profile',
    });
  }
  const org = shell.organizations.find((o) => o.slug === data.orgSlug);
  if (!org) {
    return failServerAction(404, {
      status: 'error',
      error: 'Organization not found',
    });
  }

  const apiClientV3 = await requireApiClientV3();
  try {
    await apiClientV3.leaguePlayersApi.joinLeague(org.id, data.leagueId);
  } catch {
    return failServerAction(400, {
      status: 'error',
      error: 'Failed to join league',
    });
  }

  return {
    status: 'ok',
    redirectTo: `/${data.orgSlug}/${data.leagueSlug}`,
  };
}

const joinLeagueFn = createServerFn({ method: 'POST' })
  .validator((input: JoinLeagueInput) => input)
  .handler(({ data }): Promise<JoinLeagueResult> => joinLeague(data));

export const Route = createFileRoute('/_authed/$orgSlug/')({
  server: {
    middleware: [orgGuard],
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await parseNativeFormData(request);
        if (formData.get('_action') !== 'joinLeague') {
          return new Response('Unsupported form action', { status: 400 });
        }

        const result = await joinLeague({
          orgSlug: params.orgSlug,
          leagueId: String(formData.get('leagueId') ?? ''),
          leagueSlug: String(formData.get('leagueSlug') ?? ''),
        });
        if (result.status === 'error') {
          return nativeFormResponse(request, result);
        }
        return new Response(null, {
          status: 303,
          headers: { location: result.redirectTo },
        });
      },
    },
  },
  loader: async ({ context, params }) => {
    const shell = context.authedShell;
    const org = resolveOrg(shell, params.orgSlug);

    // Claim data is optional: its failure degrades the claim UI, not the page.
    const [leagues, claimStatus] = await Promise.all([
      context.queryClient.fetchQuery({
        queryKey: ['org', org.id, 'leagues'],
        queryFn: () => listLeaguesFn({ data: org.id }),
        staleTime: 0,
      }),
      fetchOrgClaimStatus(context.queryClient, org.id),
    ]);

    const joinedLeagueIds = new Set((org.leagues ?? []).map((l) => l.id));

    return {
      org,
      leagues: leagues.map((league) => ({
        ...league,
        isJoined: joinedLeagueIds.has(league.id),
      })),
      claimStatus,
    };
  },
  errorComponent: HttpErrorView,
  component: OrgHomePage,
});

function OrgHomePage() {
  const { org } = Route.useLoaderData();

  return <OrgHomePageContent key={org.id} />;
}

function OrgHomePageContent() {
  const { org, leagues } = Route.useLoaderData();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const joinLeague = useMutation({
    mutationFn: (input: { leagueId: string; leagueSlug: string }) =>
      joinLeagueFn({ data: { orgSlug: org.slug, ...input } }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setFormError(result.error);
        return;
      }
      setFormError(null);
      await router.navigate({ href: result.redirectTo });
    },
    onError: () => setFormError('Failed to join league'),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        <p className="text-sm text-muted-foreground">
          Browse leagues in this organization and join the ones you want to play
          in.
        </p>
      </div>

      {formError && <Alert variant="destructive">{formError}</Alert>}

      <div className="grid gap-4">
        {leagues.map((league) => (
          <Card key={league.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {league.name}
                </CardTitle>
                <CardDescription>
                  {formatLeagueFormat(league.teamSize)}
                </CardDescription>
              </div>
              <Badge variant={league.isJoined ? 'default' : 'outline'}>
                {league.isJoined ? 'Joined' : 'Available'}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{league.slug}</span>
              </div>

              {league.isJoined ? (
                <Button asChild>
                  <AppLink to={`/${org.slug}/${league.slug}`}>
                    Open League
                  </AppLink>
                </Button>
              ) : (
                <form
                  method="post"
                  action={`/${org.slug}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    joinLeague.mutate({
                      leagueId: league.id,
                      leagueSlug: league.slug,
                    });
                  }}
                >
                  <input
                    hidden
                    type="hidden"
                    name="_action"
                    value="joinLeague"
                  />
                  <input
                    hidden
                    type="hidden"
                    name="leagueId"
                    value={league.id}
                  />
                  <input
                    hidden
                    type="hidden"
                    name="leagueSlug"
                    value={league.slug}
                  />
                  <Button type="submit">Join League</Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
