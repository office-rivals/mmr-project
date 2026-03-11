import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, fetch }) => {
  const { orgId, leagueId, leaguePlayerId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const [queueRes, activeMatchesRes] = await Promise.all([
    fetch(`${base}/matchmaking/queue`),
    fetch(`${base}/matchmaking/active`),
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
    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    const league = org?.leagues?.find(
      (l: { slug: string }) => l.slug === params.leagueSlug
    );
    if (!org || !league) {
      return fail(404, { message: 'Organization or league not found' });
    }

    const base = `/api/v3/organizations/${org.id}/leagues/${league.id}`;
    const response = await fetch(`${base}/matchmaking/queue`, {
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
    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    const league = org?.leagues?.find(
      (l: { slug: string }) => l.slug === params.leagueSlug
    );
    if (!org || !league) {
      return fail(404, { message: 'Organization or league not found' });
    }

    const base = `/api/v3/organizations/${org.id}/leagues/${league.id}`;
    const response = await fetch(`${base}/matchmaking/queue`, {
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

    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    const league = org?.leagues?.find(
      (l: { slug: string }) => l.slug === params.leagueSlug
    );
    if (!org || !league) {
      return fail(404, { message: 'Organization or league not found' });
    }

    const base = `/api/v3/organizations/${org.id}/leagues/${league.id}`;
    const response = await fetch(
      `${base}/matchmaking/pending/${matchId}/accept`,
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

    const meResponse = await fetch('/api/v3/me');
    const me = await meResponse.json();
    const org = me.organizations?.find(
      (o: { slug: string }) => o.slug === params.orgSlug
    );
    const league = org?.leagues?.find(
      (l: { slug: string }) => l.slug === params.leagueSlug
    );
    if (!org || !league) {
      return fail(404, { message: 'Organization or league not found' });
    }

    const base = `/api/v3/organizations/${org.id}/leagues/${league.id}`;
    const response = await fetch(
      `${base}/matchmaking/pending/${matchId}/decline`,
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
