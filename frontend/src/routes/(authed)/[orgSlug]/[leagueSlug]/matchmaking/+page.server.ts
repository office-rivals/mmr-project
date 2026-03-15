import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { resolveOrgAndLeague } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({ parent, fetch }) => {
  const { orgId, leagueId, leaguePlayerId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const [queueRes, activeMatchesRes] = await Promise.all([
    fetch(`${base}/queue`),
    fetch(`${base}/active-matches`),
  ]);

  const queueStatus = queueRes.ok ? await queueRes.json() : null;
  const activeMatches = activeMatchesRes.ok
    ? await activeMatchesRes.json()
    : [];

  return {
    queueStatus,
    activeMatches,
    hasLeaguePlayer: !!leaguePlayerId,
  };
};

export const actions: Actions = {
  join: async ({ fetch, params }) => {
    const resolved = await resolveOrgAndLeague(fetch, params);

    const response = await fetch(`${resolved.base}/queue`, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return fail(response.status, {
        message: errorData?.detail ?? 'Failed to join queue',
      });
    }
  },

  leave: async ({ fetch, params }) => {
    const resolved = await resolveOrgAndLeague(fetch, params);

    const response = await fetch(`${resolved.base}/queue`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return fail(response.status, {
        message: errorData?.detail ?? 'Failed to leave queue',
      });
    }
  },

  accept: async ({ fetch, params, request }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;

    const resolved = await resolveOrgAndLeague(fetch, params);

    const response = await fetch(
      `${resolved.base}/pending-matches/${matchId}/accept`,
      { method: 'POST' }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return fail(response.status, {
        message: errorData?.detail ?? 'Failed to accept match',
      });
    }
  },

  decline: async ({ fetch, params, request }) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;

    const resolved = await resolveOrgAndLeague(fetch, params);

    const response = await fetch(
      `${resolved.base}/pending-matches/${matchId}/decline`,
      { method: 'POST' }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return fail(response.status, {
        message: errorData?.detail ?? 'Failed to decline match',
      });
    }
  },
};
