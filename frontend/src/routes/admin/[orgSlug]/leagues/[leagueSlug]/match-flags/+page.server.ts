import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { resolveOrgAndLeagueIds } from '$lib/server/resolveIds';
import { MatchFlagStatus, ResponseError, type MatchResponse } from '$api3';

const isMatchFlagStatus = (value: string): value is MatchFlagStatus =>
  (Object.values(MatchFlagStatus) as string[]).includes(value);

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
  url,
}) => {
  const { orgId, leagueId } = await parent();
  const rawStatusFilter = url.searchParams.get('status');
  const statusFilter =
    rawStatusFilter && isMatchFlagStatus(rawStatusFilter)
      ? rawStatusFilter
      : undefined;

  try {
    const [flags, players, currentSeasonId] = await Promise.all([
      apiClientV3.adminMatchFlagsApi.listAllFlags(
        orgId,
        leagueId,
        statusFilter
      ),
      apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
      // Only current-season matches can be edited or recalculated (the API
      // rejects the rest), so the page needs the current season to gate those
      // actions. Tolerate no active season — everything is then read-only.
      apiClientV3.seasonsApi
        .getCurrentSeason(orgId, leagueId)
        .then((season) => season.id)
        .catch(() => null),
    ]);

    // Resolving a flag means inspecting (and often editing) the match it's
    // about, so fetch each referenced match. Multiple flags can point at the
    // same match, so fetch unique ids in parallel.
    const uniqueMatchIds = [...new Set(flags.map((flag) => flag.matchId))];
    const matchEntries = await Promise.all(
      uniqueMatchIds.map(async (matchId) => {
        try {
          const match = await apiClientV3.matchesApi.getMatch(
            orgId,
            leagueId,
            matchId
          );
          return [matchId, match] as const;
        } catch (err) {
          // A deleted match is an expected per-flag state (null renders as "no
          // longer exists"). Anything else is a real failure that must not
          // masquerade as a deletion — let it surface as a page error.
          if (err instanceof ResponseError && err.response.status === 404) {
            return [matchId, null] as const;
          }
          throw err;
        }
      })
    );
    const matchesById: Record<string, MatchResponse | null> =
      Object.fromEntries(matchEntries);

    return {
      flags,
      players,
      matchesById,
      currentSeasonId,
      statusFilter: statusFilter ?? null,
    };
  } catch {
    throw error(500, 'Failed to load flags');
  }
};

export const actions = {
  resolve: async ({ request, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const rawStatus = (formData.get('status') as string) || 'Resolved';
    const note = (formData.get('note') as string)?.trim() || undefined;
    const orgId = formData.get('orgId')?.toString();
    const leagueId = formData.get('leagueId')?.toString();

    if (!flagId || !orgId || !leagueId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    if (!isMatchFlagStatus(rawStatus)) {
      return fail(400, { success: false, message: 'Invalid status' });
    }

    try {
      await apiClientV3.adminMatchFlagsApi.resolveFlag(
        orgId,
        leagueId,
        flagId,
        {
          status: rawStatus,
          resolutionNote: note,
        }
      );
    } catch (error) {
      const { status: statusCode, message } = await getApiErrorDetails(
        error,
        'Failed to resolve flag'
      );
      return fail(statusCode, { success: false, message });
    }

    return { success: true, message: 'Flag resolved successfully' };
  },

  edit: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    const teamsRaw = formData.get('teams') as string;
    if (!matchId || !teamsRaw)
      return fail(400, {
        success: false,
        message: 'matchId and teams are required',
      });

    let parsedTeams: Array<{
      score: number;
      players: { leaguePlayerId: string }[];
    }>;
    try {
      parsedTeams = JSON.parse(teamsRaw);
    } catch {
      return fail(400, { success: false, message: 'Invalid teams payload' });
    }

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      await apiClientV3.matchesApi.updateMatch(
        ctx.orgId,
        ctx.leagueId,
        matchId,
        { teams: parsedTeams }
      );
      return { success: true, message: 'Match updated' };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to update match'
      );
      return fail(status, { success: false, message });
    }
  },

  recalculate: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const fromMatchIdRaw = formData.get('fromMatchId') as string | null;
    const fromMatchId = fromMatchIdRaw?.trim()
      ? fromMatchIdRaw.trim()
      : undefined;

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      const result = await apiClientV3.matchesApi.recalculateMatches(
        ctx.orgId,
        ctx.leagueId,
        fromMatchId
      );
      return {
        success: true,
        message: `Recalculated ${result.matchCount} match${result.matchCount === 1 ? '' : 'es'}`,
      };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to recalculate MMR'
      );
      return fail(status, { success: false, message });
    }
  },
} satisfies Actions;
