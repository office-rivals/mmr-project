import { fail } from '@sveltejs/kit';
import { resolveOrgAndLeague } from '$lib/server/resolveIds';

type ActionParams = {
  request: Request;
  fetch: typeof globalThis.fetch;
  params: { orgSlug: string; leagueSlug: string };
};

export const matchFlagActions = {
  flagMatch: async ({ request, fetch, params }: ActionParams) => {
    const formData = await request.formData();
    const matchId = formData.get('matchId') as string;
    const reason = (formData.get('reason') as string)?.trim();

    if (!matchId || !reason) {
      return fail(400, { success: false, message: 'Match ID and reason are required' });
    }

    const resolved = await resolveOrgAndLeague(fetch, params);

    const res = await fetch(`${resolved.base}/match-flags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, reason }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to create flag' });
    }

    return { success: true, message: 'Match flagged successfully' };
  },

  updateFlag: async ({ request, fetch, params }: ActionParams) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;
    const reason = (formData.get('reason') as string)?.trim();

    if (!flagId || !reason) {
      return fail(400, { success: false, message: 'Flag ID and reason are required' });
    }

    const resolved = await resolveOrgAndLeague(fetch, params);

    const res = await fetch(`${resolved.base}/match-flags/${flagId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to update flag' });
    }

    return { success: true, message: 'Flag updated successfully' };
  },

  deleteFlag: async ({ request, fetch, params }: ActionParams) => {
    const formData = await request.formData();
    const flagId = formData.get('flagId') as string;

    if (!flagId) {
      return fail(400, { success: false, message: 'Flag ID is required' });
    }

    const resolved = await resolveOrgAndLeague(fetch, params);

    const res = await fetch(`${resolved.base}/match-flags/${flagId}`, { method: 'DELETE' });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return fail(res.status, { success: false, message: body.detail || 'Failed to delete flag' });
    }

    return { success: true, message: 'Flag deleted successfully' };
  },
};
