import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { resolveOrgAndLeague } from '$lib/server/resolveIds';

export const load: PageServerLoad = async ({ parent, fetch, url }) => {
  const { orgId, leagueId } = await parent();
  const base = `/api/v3/organizations/${orgId}/leagues/${leagueId}`;

  const statusFilter = url.searchParams.get('status') ?? undefined;
  const statusQuery = statusFilter ? `?status=${statusFilter}` : '';

  const [flagsRes, playersRes] = await Promise.all([
    fetch(`${base}/admin/match-flags${statusQuery}`),
    fetch(`${base}/players`),
  ]);

  if (!flagsRes.ok) {
    throw error(500, 'Failed to load flags');
  }

  const flags = await flagsRes.json();
  const players = playersRes.ok ? await playersRes.json() : [];

  return {
    flags,
    players,
    statusFilter: statusFilter ?? null,
  };
};

export const actions = {
  resolve: async ({ request, fetch, params }) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const status = (formData.get('status') as string) || 'Resolved';
    const note = (formData.get('note') as string)?.trim() || undefined;

    if (!flagId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    const resolved = await resolveOrgAndLeague(fetch, params);

    const res = await fetch(
      `${resolved.base}/admin/match-flags/${flagId}/resolve`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolutionNote: note }),
      }
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to resolve flag' });
    }

    return { success: true, message: 'Flag resolved successfully' };
  },
} satisfies Actions;
