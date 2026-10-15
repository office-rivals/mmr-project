import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HttpErrorView } from '@/components/http-error-view';
import { LiveMatchBanner } from '@/components/play/live-match-banner';
import { SubmitMatchPage } from '@/components/play/submit-match-page';
import { HttpError } from '@/lib/http-error';
import { prefetchQueueStatus } from '@/lib/queue-actions';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { scrollToStep } from '@/lib/scroll-to-step';
import type {
  Rematch,
  SlotName,
  SubmitMatchInput,
} from '@/components/play/submit-match-page';
import type { LeagueContext } from './route';
import type {
  LeaguePlayerResponse,
  MatchResponse,
  OrganizationMemberResponse,
  SubmitMatchPlayerRequest,
} from '@/api-v3';

const leagueRoute = getRouteApi('/_authed/$orgSlug/$leagueSlug');

interface SubmitPageData {
  players: LeaguePlayerResponse[];
  members: OrganizationMemberResponse[];
  /** The viewer's most recent match in this league, offered as a rematch. */
  lastMatch: MatchResponse | null;
}

const getSubmitPageDataFn = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      leaguePlayerId: string | null;
    }) => input
  )
  .handler(async ({ data }): Promise<SubmitPageData> => {
    const apiClientV3 = await requireApiClientV3();
    const [players, members, lastMatch] = await Promise.all([
      apiClientV3.leaguePlayersApi.listPlayers(data.orgId, data.leagueId),
      apiClientV3.organizationMembersApi.listMembers(data.orgId),
      // Optional: the form works without it.
      data.leaguePlayerId
        ? apiClientV3.matchesApi
            .getMatches(data.orgId, data.leagueId, {
              leaguePlayerId: data.leaguePlayerId,
              limit: 1,
              offset: 0,
            })
            .then((matches) => matches[0] ?? null)
            .catch(() => null)
        : null,
    ]);
    return { players, members, lastMatch };
  });

/**
 * The last match's line-up with the viewer first, or null when it no longer
 * fits this league's format or one of its players has left.
 */
function rematchFrom(
  match: MatchResponse | null,
  me: string | null,
  players: LeaguePlayerResponse[],
  teamSize: number
): Rematch | null {
  if (!match || !me) return null;
  const mine = match.teams.find((t) =>
    t.players.some((p) => p.leaguePlayerId === me)
  );
  const theirs = match.teams.find((t) => t !== mine);
  if (!mine || !theirs) return null;
  const lineup = (ids: string[]) => {
    const found = ids.map((id) => players.find((p) => p.id === id));
    return found.length === teamSize && found.every((p) => p != null)
      ? (found as LeaguePlayerResponse[])
      : null;
  };
  const team1 = lineup([
    me,
    ...mine.players.map((p) => p.leaguePlayerId).filter((id) => id !== me),
  ]);
  const team2 = lineup(theirs.players.map((p) => p.leaguePlayerId));
  return team1 && team2 ? { team1, team2 } : null;
}

type SubmitMatchResult =
  { status: 'error'; message: string } | { status: 'ok' };

type PlayerReference = SubmitMatchPlayerRequest | { error: string } | null;

function resolvePlayerReference(
  input: SubmitMatchInput,
  fieldName: SlotName
): PlayerReference {
  const rawValue = input.slots[fieldName] ?? '';
  if (rawValue === '') return null;

  if (rawValue.startsWith('league:')) {
    return { leaguePlayerId: rawValue.slice('league:'.length) };
  }

  if (rawValue.startsWith('member:')) {
    return { organizationMembershipId: rawValue.slice('member:'.length) };
  }

  if (rawValue === 'new') {
    const newPlayer = input.newPlayers[fieldName];
    const displayName = (newPlayer?.displayName ?? '').trim();
    const username = (newPlayer?.username ?? '').trim();
    const email = (newPlayer?.email ?? '').trim();

    if (displayName === '') {
      return { error: 'New players must have a display name' };
    }

    return {
      newPlayer: {
        displayName,
        username: username || undefined,
        email: email || undefined,
      },
    };
  }

  return { error: 'Player selection is invalid' };
}

function isResolvedPlayerReference(
  player: PlayerReference
): player is SubmitMatchPlayerRequest {
  return player !== null && !('error' in player);
}

const submitMatchFn = createServerFn({ method: 'POST' })
  .validator((input: SubmitMatchInput) => input)
  .handler(async ({ data }): Promise<SubmitMatchResult> => {
    const team1Player1 = data.slots.team1_player1;
    const team2Player1 = data.slots.team2_player1;
    const team1Score = Number(data.team1Score);
    const team2Score = Number(data.team2Score);

    if (!team1Player1 || !team2Player1) {
      return failServerAction(400, {
        status: 'error',
        message: 'Each team must have at least one player',
      });
    }

    if (isNaN(team1Score) || isNaN(team2Score)) {
      return failServerAction(400, {
        status: 'error',
        message: 'Scores are required',
      });
    }

    if (!data.orgId || !data.leagueId) {
      return failServerAction(400, {
        status: 'error',
        message: 'Organization and league are required',
      });
    }

    const resolveTeam = (names: SlotName[]) =>
      names
        .filter((name) => (data.slots[name] ?? '') !== '')
        .map((name) => resolvePlayerReference(data, name));

    const team1PlayerRefs = resolveTeam(['team1_player1', 'team1_player2']);
    const team2PlayerRefs = resolveTeam(['team2_player1', 'team2_player2']);

    const playerError = [...team1PlayerRefs, ...team2PlayerRefs].find(
      (player) => player && 'error' in player
    );
    if (playerError && 'error' in playerError) {
      return failServerAction(400, {
        status: 'error',
        message: playerError.error,
      });
    }

    const teams = [
      {
        players: team1PlayerRefs.filter(isResolvedPlayerReference),
        score: team1Score,
      },
      {
        players: team2PlayerRefs.filter(isResolvedPlayerReference),
        score: team2Score,
      },
    ];

    const apiClientV3 = await requireApiClientV3();
    try {
      await apiClientV3.matchesApi.submitMatch(data.orgId, data.leagueId, {
        teams,
      });
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to submit match'
      );
      return failServerAction(status, { status: 'error', message });
    }

    return { status: 'ok' };
  });

export const Route = createFileRoute('/_authed/$orgSlug/$leagueSlug/submit')({
  loader: async ({ context }) => {
    const { orgId, leagueId, leaguePlayerId } = context.league;
    const [data] = await Promise.all([
      getSubmitPageDataFn({
        data: { orgId, leagueId, leaguePlayerId },
      }).catch(() => {
        throw new HttpError(500, 'Failed to load players');
      }),
      // The live-match banner sits above the form; without this it would
      // appear after hydration and push the form down.
      prefetchQueueStatus(context.queryClient, orgId, leagueId),
    ]);
    return data;
  },
  errorComponent: HttpErrorView,
  component: SubmitRoute,
});

function SubmitRoute() {
  const league = leagueRoute.useLoaderData();
  const data = Route.useLoaderData();

  return (
    <LeagueSubmitRoute key={league.leagueId} league={league} data={data} />
  );
}

function LeagueSubmitRoute({
  league,
  data: { players, members, lastMatch },
}: {
  league: LeagueContext;
  data: SubmitPageData;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const submitMatch = useMutation({
    mutationFn: (input: SubmitMatchInput) => submitMatchFn({ data: input }),
    onSuccess: async (result) => {
      if (result.status === 'error') {
        setFormMessage(result.message);
        return;
      }
      setFormMessage(null);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes(league.leagueId),
      });
      await router.navigate({
        href: `/${league.orgSlug}/${league.leagueSlug}`,
      });
    },
    onError: () => setFormMessage('Failed to submit match'),
  });

  return (
    <SubmitMatchPage
      orgId={league.orgId}
      leagueId={league.leagueId}
      leagueTeamSize={league.leagueTeamSize}
      leagueWinningScore={league.leagueWinningScore}
      players={players}
      members={members}
      rematch={rematchFrom(
        lastMatch,
        league.leaguePlayerId,
        players,
        league.leagueTeamSize
      )}
      formMessage={formMessage}
      submitting={submitMatch.isPending}
      onSubmit={(input) => submitMatch.mutate(input)}
      onGoToStep={scrollToStep}
      banner={
        <LiveMatchBanner
          base={`/${league.orgSlug}/${league.leagueSlug}`}
          orgId={league.orgId}
          leagueId={league.leagueId}
          leaguePlayerId={league.leaguePlayerId}
        />
      }
    />
  );
}
