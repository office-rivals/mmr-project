import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ChevronRight } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { featuredCard, plainCard } from '@/components/claims/claim-ui';
import { Eyebrow } from '@/components/eyebrow';
import { PageTitle } from '@/components/page-title';
import { PlayerAvatar } from '@/components/player-avatar';
import { HttpErrorView } from '@/components/http-error-view';
import { fetchOrgClaimStatus } from '@/lib/claim-actions';
import {
  formatChoiceCount,
  getClaimablePlayerName,
  getClaimState,
} from '@/lib/claims';
import { HttpError } from '@/lib/http-error';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { createRouteGuard } from '@/lib/server/http-error';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { loadShellData, loadShellDataOnce } from '@/lib/server/shell';
import { cn, formatLeagueFormat } from '@/lib/utils';
import type { AuthedShellData } from '@/lib/shell';
import type {
  ClaimableMembershipResponse,
  LeagueResponse,
  MembershipClaimRequestResponse,
} from '@/api-v3';

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
  const { org, leagues, claimStatus } = Route.useLoaderData();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const claim = getClaimState(claimStatus);
  const claimHref = `/${org.slug}/claim`;

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
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex min-w-0 flex-col gap-1">
        <Eyebrow>
          {leagues.length} {leagues.length === 1 ? 'league' : 'leagues'}
        </Eyebrow>
        <PageTitle>{org.name}</PageTitle>
      </div>

      {formError && <Alert variant="destructive">{formError}</Alert>}

      {claim.status === 'eligible' && claimStatus.claimable ? (
        <ClaimBanner
          players={claimStatus.claimable.memberships}
          href={claimHref}
        />
      ) : null}
      {claim.status === 'pending' && claim.claim ? (
        <PendingClaimCard claim={claim.claim} href={claimHref} />
      ) : null}
      {claim.status === 'unknown' && leagues.some((l) => !l.isJoined) ? (
        <Alert data-testid="league-join-unavailable">
          Joining leagues is unavailable until your player claim status loads.
          Reload the page to try again.
        </Alert>
      ) : null}

      <section
        aria-labelledby="org-leagues-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="org-leagues-heading" className="text-2xl">
          Leagues
        </h2>
        {leagues.length === 0 ? (
          <p className={cn(plainCard, 'p-5 text-sm text-muted-foreground')}>
            No leagues yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-lg border bg-card">
            {leagues.map((league) => (
              <li
                key={league.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b px-4 py-3 last:border-b-0"
              >
                <div className="flex min-w-0 flex-1 basis-40 flex-col">
                  <span className="truncate font-semibold">{league.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatLeagueFormat(league.teamSize)}
                    {league.isJoined ? ' · Joined' : null}
                  </span>
                </div>

                {league.isJoined ? (
                  <Button asChild variant="outline" className="h-11 lg:h-10">
                    <AppLink to={`/${org.slug}/${league.slug}`}>
                      Open League
                    </AppLink>
                  </Button>
                ) : claim.canJoinLeagues ? (
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
                    <Button type="submit" className="h-11 lg:h-10">
                      Join League
                    </Button>
                  </form>
                ) : claim.status === 'pending' ? (
                  <span className="text-sm text-muted-foreground">
                    Available after your claim
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ClaimBanner({
  players,
  href,
}: {
  players: ClaimableMembershipResponse[];
  href: string;
}) {
  return (
    <section
      aria-labelledby="org-claim-heading"
      className={cn(featuredCard, 'flex flex-col gap-4 p-5 lg:p-6')}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="org-claim-heading" className="text-lg font-semibold">
          Played here before you had an account?
        </h2>
        <p className="text-sm text-muted-foreground">
          Your matches may be recorded under a player without an account. Claim
          it to bring its matches and rating here.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {players.slice(0, 3).map((player) => (
              <PlayerAvatar
                key={player.organizationMembershipId}
                name={getClaimablePlayerName(player)}
                dashed
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground">
            {formatChoiceCount(players.length)}
          </span>
        </div>
        <Button asChild className="h-11 w-full sm:w-auto lg:h-10">
          <AppLink to={href}>Claim your player</AppLink>
        </Button>
      </div>
    </section>
  );
}

function PendingClaimCard({
  claim,
  href,
}: {
  claim: MembershipClaimRequestResponse;
  href: string;
}) {
  const name = getClaimablePlayerName(claim.target);
  return (
    <section className={cn(plainCard, 'flex items-start gap-4 p-5')}>
      <PlayerAvatar name={name} dashed />
      <div className="flex min-w-0 flex-col gap-1">
        <AppLink
          to={href}
          className="inline-flex items-center gap-1 self-start rounded-sm font-semibold underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Player claim awaiting approval
          <ChevronRight aria-hidden="true" className="size-4" />
        </AppLink>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{name}</span> · A
          moderator is checking it. You can join leagues once it&apos;s decided.
        </p>
      </div>
    </section>
  );
}
