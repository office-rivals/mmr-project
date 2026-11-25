import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { PageTitle } from '@/components/page-title';
import { Alert } from '@/components/ui/alert';
import { failServerAction } from '@/lib/server/action-result';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { ClaimForm, pickClaimMatch } from './claim-form';
import type { ReactNode } from 'react';
import type {
  LeaguePlayerResponse,
  OrganizationMemberResponse,
} from '@/api-v3';
import type {
  ClaimTableMatchRequest,
  LiveTableResponse,
  TableMatchResponse,
} from './api';

interface TableClaimData {
  live: LiveTableResponse;
  match: TableMatchResponse | null;
}

const loadTableClaimFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgId: string; tableId: string; matchId?: string }) => input
  )
  .handler(async ({ data }): Promise<TableClaimData> => {
    const { foosballApi } = await requireApiClientV3();
    const [live, claimable] = await Promise.all([
      foosballApi.getLive(data.orgId, data.tableId),
      foosballApi.listClaimable(data.orgId, data.tableId),
    ]);
    return { live, match: pickClaimMatch(claimable, live.match, data.matchId) };
  });

const claimFn = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      orgId: string;
      leagueId: string;
      matchId: string;
      request: ClaimTableMatchRequest;
    }) => input
  )
  .handler(async ({ data }): Promise<{ error?: string }> => {
    const { foosballApi } = await requireApiClientV3();
    try {
      await foosballApi.claimMatch(
        data.orgId,
        data.leagueId,
        data.matchId,
        data.request
      );
      return {};
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to save the match'
      );
      return failServerAction(status, { error: message });
    }
  });

/**
 * Submit page opened from a table (`?table=<id>[&match=<id>]`, the QR/NFC
 * link): the table's score, read-only, and "who played?". Falls back to the
 * normal submit page when there's nothing to claim.
 */
export function TableClaim({
  league,
  tableId,
  matchId,
  players,
  members,
  fallback,
}: {
  league: {
    orgId: string;
    leagueId: string;
    orgSlug: string;
    leagueSlug: string;
    leagueTeamSize: number;
    leaguePlayerId: string | null;
  };
  tableId: string;
  matchId: string | undefined;
  players: LeaguePlayerResponse[];
  members: OrganizationMemberResponse[];
  fallback: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['foosball-claim', tableId, matchId],
    queryFn: () =>
      loadTableClaimFn({ data: { orgId: league.orgId, tableId, matchId } }),
    retry: false,
  });

  const claim = useMutation({
    mutationFn: (request: ClaimTableMatchRequest) =>
      claimFn({
        data: {
          orgId: league.orgId,
          leagueId: league.leagueId,
          matchId: data!.match!.id,
          request,
        },
      }),
    onSuccess: async (result) => {
      if (result.error) return setError(result.error);
      await queryClient.invalidateQueries({
        predicate: (q) =>
          q.queryKey.includes(league.leagueId) ||
          String(q.queryKey[0]).startsWith('foosball-'),
      });
      await router.navigate({
        href: `/${league.orgSlug}/${league.leagueSlug}`,
      });
    },
    onError: () => setError('Failed to save the match'),
  });

  if (isPending) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Loading the table…
      </p>
    );
  }

  // A table's games are rated in the table's own league only.
  const otherLeague = !isError && data.live.table.leagueId !== league.leagueId;
  if (isError || otherLeague || !data.match) {
    return (
      <div className="flex flex-col gap-6">
        <Alert>
          {isError
            ? 'Could not load that table.'
            : otherLeague
              ? `${data.live.table.name} belongs to another league: its games are saved there.`
              : `No game at ${data.live.table.name} is waiting to be saved. It may already be saved, or too old to claim.`}{' '}
          You can still enter a match below.
        </Alert>
        {fallback}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Who played?</PageTitle>
      <p className="-mt-4 text-muted-foreground">{data.live.table.name}</p>
      {error && <Alert variant="destructive">{error}</Alert>}
      <ClaimForm
        key={league.leagueId}
        table={data.live.table}
        match={data.match}
        previousMatch={data.live.previousMatch}
        leagueId={league.leagueId}
        teamSize={league.leagueTeamSize}
        myLeaguePlayerId={league.leaguePlayerId}
        players={players}
        members={members}
        submitting={claim.isPending}
        onSubmit={(request) => claim.mutate(request)}
      />
    </div>
  );
}
