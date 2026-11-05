import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, Users } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { Eyebrow } from '@/components/eyebrow';
import { PageTitle } from '@/components/page-title';
import { PlayerAvatar } from '@/components/player-avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  eligibilityMessage,
  openSpots,
  endedInviteMessage,
  formatCountdown,
  secondsUntil,
} from '@/lib/game-invite';
import {
  getGameInviteLinkFn,
  getGameInviteLeaguePlayersFn,
  joinGameInviteFn,
} from '@/lib/game-invite-actions';
import {
  GameInviteSection,
  GameInviteShareLink,
  gameInviteQueryKey,
} from '@/components/play/game-invite-section';
import type { AuthedShellData } from '@/lib/shell';
import {
  GameInviteEligibility,
  GameInviteStatus,
  type GameInviteLinkResponse,
  type LeaguePlayerResponse,
} from '@/api-v3';
import { getPlayerDisplayName } from '@/lib/utils';

interface GameInviteLinkPageData {
  link: GameInviteLinkResponse | null;
  /** The viewer's league player in the invite's league, if they belong to it. */
  viewerLeaguePlayerId: string | null;
  leaguePlayers: LeaguePlayerResponse[];
}

function viewerLeaguePlayerIdFor(
  shell: AuthedShellData,
  leagueId: string
): string | null {
  for (const org of shell.organizations) {
    const league = org.leagues?.find((l) => l.id === leagueId);
    if (league) return league.leaguePlayerId || null;
  }
  return null;
}

// Outside the league guard on purpose: ineligible viewers still need a
// membership message. Eligibility is decided by the API, which withholds the
// roster from anyone who may not see it.
export const Route = createFileRoute('/_authed/game-invites/$code')({
  loader: async ({ context, params }): Promise<GameInviteLinkPageData> => {
    const link = await context.queryClient.fetchQuery({
      queryKey: ['game-invite-link', params.code],
      queryFn: () => getGameInviteLinkFn({ data: params.code }),
      staleTime: 0,
    });
    return {
      link,
      viewerLeaguePlayerId: link
        ? viewerLeaguePlayerIdFor(context.authedShell, link.leagueId)
        : null,
      leaguePlayers:
        link?.eligibility === GameInviteEligibility.Eligible
          ? await getGameInviteLeaguePlayersFn({
              data: { orgId: link.organizationId, leagueId: link.leagueId },
            })
          : [],
    };
  },
  head: () => ({ meta: [{ title: 'Game invite' }] }),
  component: GameInviteLinkPage,
});

function GameInviteLinkPage() {
  const {
    link: seedLink,
    viewerLeaguePlayerId,
    leaguePlayers,
  } = Route.useLoaderData();
  const { code } = Route.useParams();
  const linkQuery = useQuery({
    queryKey: ['game-invite-link', code],
    queryFn: () => getGameInviteLinkFn({ data: code }),
    initialData: seedLink,
    refetchInterval: (query) => {
      const status = query.state.data?.invite?.status;
      return status === GameInviteStatus.Started ||
        status === GameInviteStatus.Ended
        ? false
        : 2000;
    },
    staleTime: 0,
    retry: false,
  });
  const link = linkQuery.data;

  if (!link) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Game invite</PageTitle>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <p>This invite link doesn&apos;t match an open game.</p>
            <AppLink
              to="/"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Go to your leagues
            </AppLink>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <GameInviteLinkContent
      key={code}
      code={code}
      link={link}
      viewerLeaguePlayerId={viewerLeaguePlayerId}
      leaguePlayers={leaguePlayers}
    />
  );
}

function isOpen(status: GameInviteStatus): boolean {
  return (
    status === GameInviteStatus.Waiting ||
    status === GameInviteStatus.AwaitingAcceptance
  );
}

function GameInviteLinkContent({
  code,
  link,
  viewerLeaguePlayerId,
  leaguePlayers,
}: {
  code: string;
  link: GameInviteLinkResponse;
  viewerLeaguePlayerId: string | null;
  leaguePlayers: LeaguePlayerResponse[];
}) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<string | null>(null);
  const playHref = `/${link.organizationSlug}/${link.leagueSlug}/matchmaking`;
  const eligible = link.eligibility === GameInviteEligibility.Eligible;
  const invite = link.invite ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const join = useMutation({
    mutationFn: () =>
      joinGameInviteFn({
        data: {
          code,
          orgSlug: link.organizationSlug,
          leagueSlug: link.leagueSlug,
        },
      }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setFailure(result.message);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: gameInviteQueryKey(link.organizationId, link.leagueId),
      });
      await queryClient.invalidateQueries({
        queryKey: ['game-invite-link', code],
      });
    },
    onError: () => setFailure('Failed to join the game invite'),
  });

  const alreadyIn =
    !!invite &&
    !!viewerLeaguePlayerId &&
    invite.participants.some((p) => p.leaguePlayerId === viewerLeaguePlayerId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Eyebrow>
          {link.organizationName} · {link.leagueName}
        </Eyebrow>
        <PageTitle>Game invite</PageTitle>
      </div>

      {failure ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" className="size-4" />
          {failure}
        </Alert>
      ) : null}

      {eligible && invite && alreadyIn ? (
        <>
          <GameInviteSection
            orgId={link.organizationId}
            leagueId={link.leagueId}
            leaguePlayerId={viewerLeaguePlayerId}
            leaguePlayers={leaguePlayers}
            seedInvite={invite}
            inviteId={invite.id}
            inQueue={false}
          />
          <AppLink
            to={playHref}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open the Play tab
          </AppLink>
        </>
      ) : !eligible ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <p>{eligibilityMessage(link)}</p>
            <AppLink
              to="/"
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Go to your leagues
            </AppLink>
          </CardContent>
        </Card>
      ) : !invite || !isOpen(invite.status) ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <p>
              {invite?.status === GameInviteStatus.Started
                ? 'Everyone accepted. The match is live under Live now in Play.'
                : invite?.status === GameInviteStatus.Ended
                  ? endedInviteMessage(invite.endReason)
                  : 'This game invite is no longer open.'}
            </p>
            {invite?.status === GameInviteStatus.Started ? (
              <AppLink
                to={playHref}
                className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Open the Play tab
              </AppLink>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users aria-hidden="true" className="size-4" />
              {invite.status === GameInviteStatus.Waiting
                ? `${openSpots(invite)} ${openSpots(invite) === 1 ? 'spot' : 'spots'} left`
                : 'Teams are being confirmed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {invite.status === GameInviteStatus.Waiting
                ? 'Open for '
                : 'Acceptance closes in '}
              <span className="tabular-nums">
                {formatCountdown(
                  secondsUntil(
                    invite.status === GameInviteStatus.Waiting
                      ? invite.expiresAt
                      : invite.acceptanceExpiresAt,
                    now
                  )
                )}
              </span>
            </p>
            <GameInviteShareLink shareCode={invite.shareCode} />
            <ul
              aria-label="Players in this game"
              className="flex flex-col gap-2"
            >
              {invite.participants.map((player) => (
                <li
                  key={player.leaguePlayerId}
                  className="flex items-center gap-3 text-sm"
                >
                  <PlayerAvatar
                    name={getPlayerDisplayName(player)}
                    className="size-8 text-xs"
                  />
                  <span className="truncate font-semibold">
                    {getPlayerDisplayName(player)}
                  </span>
                  {player.isCreator ? (
                    <span className="text-xs text-muted-foreground">
                      Creator
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            {alreadyIn ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm">
                  You&apos;re already in this game invite.
                </p>
                <AppLink
                  to={playHref}
                  className="inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Open the Play tab
                </AppLink>
              </div>
            ) : invite.status === GameInviteStatus.Waiting &&
              viewerLeaguePlayerId ? (
              <Button
                type="button"
                className="h-12 w-full text-base font-bold"
                disabled={join.isPending}
                onClick={() => {
                  setFailure(null);
                  join.mutate();
                }}
              >
                Join game
              </Button>
            ) : invite.status === GameInviteStatus.Waiting ? (
              <p className="text-sm text-muted-foreground">
                Join the league to take a spot.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                This game is full and waiting for everyone to accept.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
