import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  getRouteApi,
  useRouter,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HttpErrorView } from '@/components/http-error-view';
import { SubmitMatchPage } from '@/components/play/submit-match-page';
import { HttpError } from '@/lib/http-error';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import type {
  SlotName,
  SubmitMatchInput,
} from '@/components/play/submit-match-page';
import type { LeagueContext } from './route';
import type {
  LeaguePlayerResponse,
  OrganizationMemberResponse,
  SubmitMatchPlayerRequest,
} from '@/api-v3';

const leagueRoute = getRouteApi('/_authed/$orgSlug/$leagueSlug');

interface SubmitPageData {
  players: LeaguePlayerResponse[];
  members: OrganizationMemberResponse[];
}

/**
 * Both calls fire in parallel and **any** failure fails the whole page — the
 * Svelte loader wrapped the `Promise.all` in a single try/catch.
 */
const getSubmitPageDataFn = createServerFn({ method: 'GET' })
  .validator((input: { orgId: string; leagueId: string }) => input)
  .handler(async ({ data }): Promise<SubmitPageData> => {
    const apiClientV3 = await requireApiClientV3();
    const [players, members] = await Promise.all([
      apiClientV3.leaguePlayersApi.listPlayers(data.orgId, data.leagueId),
      apiClientV3.organizationMembersApi.listMembers(data.orgId),
    ]);
    return { players, members };
  });

type SubmitMatchResult =
  { status: 'error'; message: string } | { status: 'ok' };

type PlayerReference = SubmitMatchPlayerRequest | { error: string } | null;

/**
 * 1:1 with the Svelte action's `resolvePlayerReference`. The slot encodings are
 * still strings because they are what produces `Player selection is invalid`
 * for anything the UI could not have generated.
 */
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

/**
 * The `default` form action, ported to a server function. The checks and their
 * order are unchanged, and so are the message strings — they are the only
 * feedback the page gives (there are no toasts anywhere in this area).
 */
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

    // Slots left empty (the unused player2 entries of a 1v1 league) are
    // filtered out before resolution, exactly like the Svelte action.
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
        // Raw, including -1 if the client somehow submitted early: the API
        // rejects negatives, and never derives the winner from the client.
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
    const { orgId, leagueId } = context.league;
    try {
      return await getSubmitPageDataFn({ data: { orgId, leagueId } });
    } catch {
      throw new HttpError(500, 'Failed to load players');
    }
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
  data: { players, members },
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
      // A new match moves the leaderboard, the recent-match list and every
      // rating history in this league.
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey.includes(league.leagueId),
      });
      // The 303 the Svelte action threw, in React terms.
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
      formMessage={formMessage}
      submitting={submitMatch.isPending}
      onSubmit={(input) => submitMatch.mutate(input)}
      onGoToStep={(hash) => {
        void router.navigate({
          href: `${window.location.pathname}${window.location.search}#${hash}`,
        });
      }}
    />
  );
}
