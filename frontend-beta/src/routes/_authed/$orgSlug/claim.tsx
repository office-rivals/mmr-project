import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Check, CircleAlert, TriangleAlert } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { featuredCard, plainCard, StatusPill } from '@/components/surfaces';
import { Eyebrow } from '@/components/eyebrow';
import { HttpErrorView } from '@/components/http-error-view';
import { PageTitle } from '@/components/page-title';
import { PlayerAvatar } from '@/components/player-avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { parseActionSuccessKey } from '@/lib/action-feedback';
import {
  CLAIM_SUCCESS_MESSAGES,
  NETWORK_FAILURE_COPY,
  cancelClaimFn,
  claimFormAction,
  loadClaimPageFn,
  submitClaimFn,
  type ClaimActionResult,
  type ClaimSuccessKey,
} from '@/lib/claim-actions';
import {
  getClaimablePlayerName,
  getClaimState,
  matchesLabel,
} from '@/lib/claims';
import { HttpError } from '@/lib/http-error';
import { createRouteGuard } from '@/lib/server/http-error';
import { loadShellDataOnce } from '@/lib/server/shell';
import { cn } from '@/lib/utils';
import type { AuthedShellData } from '@/lib/shell';
import type {
  ClaimableMembershipResponse,
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

export const Route = createFileRoute('/_authed/$orgSlug/claim')({
  validateSearch: (
    search: Record<string, unknown>
  ): { actionSuccess?: ClaimSuccessKey } => {
    const actionSuccess = parseActionSuccessKey(
      search.actionSuccess,
      CLAIM_SUCCESS_MESSAGES
    );
    return actionSuccess ? { actionSuccess } : {};
  },
  server: {
    middleware: [orgGuard],
    handlers: {
      POST: ({ request, params }) => claimFormAction(request, params.orgSlug),
    },
  },
  loader: async ({ context, params }) => {
    const org = resolveOrg(context.authedShell, params.orgSlug);
    const data = await loadClaimPageFn({ data: org.id }).catch(() => {
      throw new HttpError(500, 'Failed to load player claim');
    });
    return { org, ...data };
  },
  errorComponent: HttpErrorView,
  component: ClaimPage,
});

function ClaimPage() {
  const { org } = Route.useLoaderData();

  return <ClaimPageContent key={org.id} />;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

function ClaimPageContent() {
  const { org, claimable, claimRequest } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const [result, setResult] = useState<ClaimActionResult | null>(() =>
    search.actionSuccess
      ? { success: CLAIM_SUCCESS_MESSAGES[search.actionSuccess] }
      : null
  );
  // Bumped when an action swaps the page's state, so focus can follow it.
  const [swapCount, setSwapCount] = useState(0);
  const swapAlertRef = useRef<HTMLDivElement>(null);
  const claim = getClaimState({ claimable, claimRequest });
  const orgHref = `/${org.slug}`;
  const actionHref = `/${org.slug}/claim`;

  useEffect(() => {
    if (swapCount > 0) swapAlertRef.current?.focus();
  }, [swapCount]);

  const action = useMutation({
    mutationFn: (run: () => Promise<ClaimActionResult>) => run(),
    onSuccess: async (actionResult) => {
      const swapped = Boolean(actionResult.success || actionResult.stale);
      if (swapped) await router.invalidate({ sync: true });
      setResult(actionResult);
      if (swapped) setSwapCount((count) => count + 1);
    },
    onError: () => setResult({ error: NETWORK_FAILURE_COPY }),
  });
  const busy = action.isPending;
  // A failure that left the state alone belongs beside the button that caused it.
  const formError = result?.error && !result.stale ? result.error : undefined;

  const step =
    claim.status === 'pending' ? 1 : claim.status === 'approved' ? 3 : 0;
  const showStepper =
    claim.canRequest ||
    claim.status === 'pending' ||
    claim.status === 'approved';

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Eyebrow>{org.name}</Eyebrow>
          <PageTitle>Claim your player</PageTitle>
        </div>
        {claim.status === 'pending' ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            A moderator is checking your claim request. You can join leagues
            once it&apos;s decided.
          </p>
        ) : claim.canRequest ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            Pick the player your matches were recorded under. A moderator
            confirms it&apos;s you, then its matches and rating move to your
            account. Do this before you play here.
          </p>
        ) : null}
      </div>

      {showStepper ? <ClaimStepper current={step} /> : null}

      {result?.stale && result.error ? (
        <Alert
          ref={swapAlertRef}
          tabIndex={-1}
          variant="destructive"
          className="focus:outline-none"
        >
          {result.error}
        </Alert>
      ) : null}
      {result?.success ? (
        <Alert
          ref={swapAlertRef}
          tabIndex={-1}
          variant="success"
          className="focus:outline-none"
        >
          {result.success}
        </Alert>
      ) : null}

      {claim.status === 'pending' && claim.claim ? (
        <PendingClaim
          claim={claim.claim}
          actionHref={actionHref}
          busy={busy}
          error={formError}
          onCancel={(claimId) =>
            action.mutate(() =>
              cancelClaimFn({ data: { orgSlug: org.slug, claimId } })
            )
          }
        />
      ) : claim.status === 'approved' && claim.claim ? (
        <ApprovedClaim claim={claim.claim} orgHref={orgHref} />
      ) : (
        <>
          {claim.status === 'rejected' && claim.claim ? (
            <RejectedNotice claim={claim.claim} />
          ) : null}
          {claim.canRequest ? (
            <ChooseForm
              players={claimable.memberships}
              actionHref={actionHref}
              orgHref={orgHref}
              busy={busy}
              error={formError}
              onSubmit={(input) =>
                action.mutate(() =>
                  submitClaimFn({ data: { orgSlug: org.slug, ...input } })
                )
              }
            />
          ) : (
            <NothingToClaim orgHref={orgHref} />
          )}
        </>
      )}
    </div>
  );
}

const STEPS = [
  { label: 'Choose', short: 'Choose', srOnly: 'choose your player' },
  {
    label: 'Moderator checks',
    short: 'Check',
    srOnly: 'a moderator checks your claim request',
  },
  { label: 'Linked', short: 'Linked', srOnly: 'your player is linked' },
];

/** `current` is the active step's index; `STEPS.length` means all are done. */
function ClaimStepper({ current }: { current: number }) {
  const complete = current >= STEPS.length;
  return (
    <div>
      <p className="sr-only">
        {complete
          ? `All ${STEPS.length} steps done: ${STEPS[STEPS.length - 1].srOnly}.`
          : `Step ${current + 1} of ${STEPS.length}: ${STEPS[current].srOnly}.`}
      </p>
      <div aria-hidden="true" className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          // A finished flow fills its last step so the end reads as reached.
          const filled = active || (complete && index === STEPS.length - 1);
          return (
            <Fragment key={step.label}>
              {index > 0 ? (
                <span
                  className={cn(
                    'h-px min-w-3 flex-1',
                    index <= current ? 'bg-primary/60' : 'bg-border'
                  )}
                />
              ) : null}
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full border text-xs font-bold tabular-nums',
                    filled &&
                      'border-primary-fill bg-primary-fill text-primary-foreground',
                    done && !filled && 'border-primary text-primary',
                    !active &&
                      !done &&
                      'border-muted-foreground/40 text-muted-foreground'
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    active && 'font-semibold',
                    active || done ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  <span className="sm:hidden">{step.short}</span>
                  <span className="hidden sm:inline">{step.label}</span>
                </span>
              </span>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

const statLabel =
  'text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase';

function ChooseForm({
  players,
  actionHref,
  orgHref,
  busy,
  error,
  onSubmit,
}: {
  players: ClaimableMembershipResponse[];
  actionHref: string;
  orgHref: string;
  busy: boolean;
  error?: string;
  onSubmit: (input: { membershipId: string; note: string }) => void;
}) {
  const { formatDate, formatNumber } = useLocaleFormatters();

  return (
    <form
      method="post"
      action={actionHref}
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        onSubmit({
          membershipId: String(formData.get('membershipId') ?? ''),
          note: String(formData.get('note') ?? ''),
        });
      }}
    >
      <input type="hidden" name="_action" value="submit" />
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 text-2xl">Which player are you?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((player) => {
            const name = getClaimablePlayerName(player);
            const username = player.username?.trim();
            return (
              <label
                key={player.organizationMembershipId}
                className={cn(
                  plainCard,
                  'group flex cursor-pointer flex-col gap-4 p-4 transition-colors hover:bg-muted/40',
                  'has-[:checked]:border-primary/50 has-[:checked]:bg-gradient-to-br has-[:checked]:from-primary/15 has-[:checked]:via-primary/5 has-[:checked]:to-transparent',
                  'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                  'has-[:disabled]:cursor-not-allowed'
                )}
              >
                <span className="flex items-center gap-3">
                  {/* Stays dashed when chosen: the ring closes on approval. */}
                  <PlayerAvatar
                    name={name}
                    dashed
                    className="group-has-[:checked]:border-primary group-has-[:checked]:text-primary"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{name}</span>
                    {username && username !== name ? (
                      <span className="truncate text-xs text-muted-foreground">
                        @{username}
                      </span>
                    ) : null}
                  </span>
                  <input
                    type="radio"
                    name="membershipId"
                    value={player.organizationMembershipId}
                    required
                    className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-muted-foreground/50 transition-[border] checked:border-[5px] checked:border-primary focus-visible:outline-none motion-reduce:transition-none"
                  />
                </span>
                {player.matchCount > 0 ? (
                  <dl className="mt-auto flex items-start gap-8">
                    <div className="flex flex-col gap-1.5">
                      <dt className={statLabel}>Matches</dt>
                      <dd className="text-3xl leading-none font-bold tabular-nums group-has-[:checked]:text-primary">
                        {formatNumber(player.matchCount, {})}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <dt className={statLabel}>Last played</dt>
                      <dd className="text-sm font-medium">
                        {formatDate(player.lastPlayedAt, '—', DATE_OPTIONS)}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <span className="mt-auto text-sm text-muted-foreground">
                    No matches yet
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="claim-note">Note for the moderator (optional)</Label>
        <textarea
          id="claim-note"
          name="note"
          rows={3}
          disabled={busy}
          placeholder="Anything that helps them recognize you"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="submit"
          data-testid="claim-submit"
          className="h-11 lg:h-10"
          disabled={busy}
        >
          Send claim request
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-11 lg:h-10"
          data-testid="claim-skip"
        >
          <AppLink to={orgHref}>Skip for now</AppLink>
        </Button>
      </div>
    </form>
  );
}

function PendingClaim({
  claim,
  actionHref,
  busy,
  error,
  onCancel,
}: {
  claim: MembershipClaimRequestResponse;
  actionHref: string;
  busy: boolean;
  error?: string;
  onCancel: (claimId: string) => void;
}) {
  const { formatDate, formatNumber } = useLocaleFormatters();
  const name = getClaimablePlayerName(claim.target);
  const matches = claim.target.matchCount;
  const note = claim.note?.trim();
  return (
    <div data-testid="claim-pending" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className={cn(featuredCard, 'flex items-center gap-4 p-5')}>
          <PlayerAvatar
            name={name}
            dashed
            highlight
            className="size-12 text-sm"
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-lg font-bold">{name}</span>
            <span className="text-sm text-muted-foreground">
              {formatNumber(matches, {})} {matchesLabel(matches)} · requested{' '}
              {formatDate(claim.createdAt, '—', DATE_OPTIONS)}
            </span>
          </div>
          <StatusPill>Pending</StatusPill>
        </div>
        {note ? (
          <p className="px-1 text-sm text-muted-foreground italic">“{note}”</p>
        ) : null}
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-4 text-sm">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-primary"
        />
        <p>
          Don&apos;t play matches until this is decided. New matches on this
          account can stop the claim from going through.
        </p>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <form
        method="post"
        action={actionHref}
        onSubmit={(event) => {
          event.preventDefault();
          onCancel(claim.id);
        }}
      >
        <input type="hidden" name="_action" value="cancel" />
        <input type="hidden" name="claimId" value={claim.id} />
        <Button
          type="submit"
          variant="outline"
          data-testid="claim-cancel"
          className="h-11 w-full sm:w-auto lg:h-10"
          disabled={busy}
        >
          Cancel claim request
        </Button>
      </form>
    </div>
  );
}

function ApprovedClaim({
  claim,
  orgHref,
}: {
  claim: MembershipClaimRequestResponse;
  orgHref: string;
}) {
  const { formatNumber } = useLocaleFormatters();
  const name = getClaimablePlayerName(claim.target);
  const matches = claim.target.matchCount;
  return (
    <div className={cn(featuredCard, 'flex flex-col gap-5 p-5 lg:p-6')}>
      <p className="flex items-baseline gap-2">
        <span className="text-4xl leading-none font-bold text-primary tabular-nums">
          {formatNumber(matches, {})}
        </span>
        <span className="text-sm text-muted-foreground">
          {matchesLabel(matches)}
        </span>
      </p>
      <div className="flex items-center gap-4">
        <PlayerAvatar name={name} highlight className="size-12 text-sm" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-lg font-bold">You&apos;re linked to {name}.</p>
          <p className="text-sm text-muted-foreground">
            {name}&apos;s matches and rating now count for you.
          </p>
        </div>
      </div>
      <Button asChild className="h-11 w-full sm:w-auto sm:self-start lg:h-10">
        <AppLink to={orgHref}>Back to organization</AppLink>
      </Button>
    </div>
  );
}

function RejectedNotice({ claim }: { claim: MembershipClaimRequestResponse }) {
  const reason = claim.reviewNote?.trim();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/60 p-4 text-sm">
      <CircleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-destructive"
      />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">
          A moderator turned down your claim request for{' '}
          {getClaimablePlayerName(claim.target)}.
        </p>
        <p className="text-muted-foreground">
          {reason ? `“${reason}”` : "Ask a moderator if you're not sure why."}
        </p>
      </div>
    </div>
  );
}

function NothingToClaim({ orgHref }: { orgHref: string }) {
  return (
    <div className={cn(plainCard, 'flex flex-col gap-4 p-5')}>
      <p className="text-sm">
        There&apos;s no player to claim right now. If your matches were recorded
        under another name, ask a moderator to link them.
      </p>
      <Button
        asChild
        variant="outline"
        className="h-11 w-full sm:w-auto sm:self-start lg:h-10"
      >
        <AppLink to={orgHref}>Back to organization</AppLink>
      </Button>
    </div>
  );
}
