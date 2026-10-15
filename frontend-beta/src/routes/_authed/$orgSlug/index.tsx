import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ChevronRight, CircleAlert } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { featuredCard, plainCard } from '@/components/surfaces';
import { Eyebrow } from '@/components/eyebrow';
import { PageTitle } from '@/components/page-title';
import { PlayerAvatar } from '@/components/player-avatar';
import { HttpErrorView } from '@/components/http-error-view';
import { fetchOrgClaimStatus } from '@/lib/claim-actions';
import {
  formatChoiceNames,
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
  const joinedCount = leagues.filter((l) => l.isJoined).length;
  const rejectedClaim = claim.status === 'rejected' ? claim.claim : undefined;

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
        {leagues.length > 0 ? (
          <Eyebrow>
            Joined {joinedCount} of {leagues.length}{' '}
            {leagues.length === 1 ? 'league' : 'leagues'}
          </Eyebrow>
        ) : null}
        <PageTitle>{org.name}</PageTitle>
      </div>

      {formError && <Alert variant="destructive">{formError}</Alert>}

      {claim.canRequest && claimStatus.claimable ? (
        <ClaimBanner
          players={claimStatus.claimable.memberships}
          rejectedClaim={rejectedClaim}
          href={claimHref}
        />
      ) : rejectedClaim ? (
        <section
          className={cn(
            plainCard,
            'flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-5'
          )}
        >
          <RejectedLine claim={rejectedClaim} />
          <Button asChild variant="outline" className="h-11 lg:h-10">
            <AppLink to={claimHref}>See why</AppLink>
          </Button>
        </section>
      ) : null}
      {claim.status === 'pending' && claim.claim ? (
        <PendingClaimCard claim={claim.claim} href={claimHref} />
      ) : null}
      {claim.status === 'unknown' && leagues.some((l) => !l.isJoined) ? (
        <Alert data-testid="league-join-unavailable">
          Couldn&apos;t check for a player to claim, so joining leagues is
          paused. Reload to try again.
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
                    {league.isJoined
                      ? ' · Joined'
                      : claim.status === 'pending'
                        ? ' · Join once your claim is decided'
                        : null}
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
                    {/* While a claim is open, claiming is the one primary. */}
                    <Button
                      type="submit"
                      variant={claim.canRequest ? 'outline' : 'default'}
                      className="h-11 lg:h-10"
                    >
                      Join League
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RejectedLine({ claim }: { claim: MembershipClaimRequestResponse }) {
  return (
    <p className="flex items-start gap-2 text-sm font-semibold">
      <CircleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <span>
        A moderator turned down your claim request for{' '}
        {getClaimablePlayerName(claim.target)}.
      </span>
    </p>
  );
}

function ClaimBanner({
  players,
  rejectedClaim,
  href,
}: {
  players: ClaimableMembershipResponse[];
  rejectedClaim?: MembershipClaimRequestResponse;
  href: string;
}) {
  const names = players.map(getClaimablePlayerName);
  return (
    <section
      aria-labelledby="org-claim-heading"
      className={cn(featuredCard, 'flex flex-col gap-4 p-5 lg:p-6')}
    >
      {rejectedClaim ? <RejectedLine claim={rejectedClaim} /> : null}
      <div className="flex flex-col gap-1.5">
        <h2 id="org-claim-heading" className="text-lg font-bold text-balance">
          Played here before you had an account?
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Your earlier matches may be recorded under a player without an
          account. Claim it before you play your first match here; after that,
          only a moderator can merge them.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex shrink-0 gap-1.5">
            {names.slice(0, 3).map((name, index) => (
              <PlayerAvatar
                key={players[index].organizationMembershipId}
                name={name}
                dashed
              />
            ))}
          </div>
          <span className="min-w-0 text-sm font-medium">
            {formatChoiceNames(names)}
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
  // The link's ::after stretches over the card, so the whole card is the target.
  return (
    <section
      className={cn(
        plainCard,
        'relative flex items-start gap-4 p-5 transition-colors hover:bg-muted/40',
        'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background'
      )}
    >
      <PlayerAvatar name={name} dashed highlight />
      <div className="flex min-w-0 flex-col gap-1">
        <AppLink
          to={href}
          className="self-start font-bold after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
        >
          Player claim awaiting approval
        </AppLink>
        <p className="text-sm text-muted-foreground">
          You asked to claim{' '}
          <strong className="font-semibold text-foreground">{name}</strong>. A
          moderator is checking it, and you can join leagues once it&apos;s
          decided.
        </p>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="ml-auto size-5 shrink-0 self-center text-muted-foreground"
      />
    </section>
  );
}
