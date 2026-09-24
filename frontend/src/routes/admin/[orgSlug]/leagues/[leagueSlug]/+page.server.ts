import { fail } from '@sveltejs/kit';
import { openFlagsForLeague } from '$lib/utils';
import { getApiErrorDetails } from '$lib/server/api/apiError';
import { resolveOrgAndLeagueIds } from '$lib/server/resolveIds';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({
  parent,
  locals: { apiClientV3 },
}) => {
  const { orgId, leagueId, badges } = await parent();

  const [recentMatches, currentSeason, players, hardware] = await Promise.all([
    apiClientV3.matchesApi.getMatches(orgId, leagueId, { limit: 5 }),
    apiClientV3.seasonsApi.getCurrentSeason(orgId, leagueId).catch(() => null),
    apiClientV3.leaguePlayersApi.listPlayers(orgId, leagueId),
    apiClientV3.hardwareApi.listForLeague(orgId, leagueId),
  ]);

  return {
    recentMatches,
    // Sourced from the badges endpoint, same as the other flag badges.
    openFlagsCount: openFlagsForLeague(badges, leagueId),
    currentSeason,
    playerCount: players.length,
    hardware,
  };
};

export const actions: Actions = {
  registerHardware: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const hardwareId = (formData.get('hardwareId') as string)?.trim();
    if (!hardwareId)
      return fail(400, { success: false, message: 'Hardware ID is required' });

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      const result = await apiClientV3.hardwareApi.register(
        ctx.orgId,
        ctx.leagueId,
        { hardwareId }
      );
      return {
        success: true,
        message: `Registered ${result.hardwareId}`,
        hardwareId: result.hardwareId,
        secret: result.secret,
      };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to register Hardware'
      );
      return fail(status, { success: false, message });
    }
  },

  rotateHardwareSecret: async ({
    request,
    params,
    locals: { apiClientV3 },
  }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const hardwareId = formData.get('hardwareId') as string;
    if (!id) return fail(400, { success: false, message: 'id required' });

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      const result = await apiClientV3.hardwareApi.rotateSecret(
        ctx.orgId,
        ctx.leagueId,
        id
      );
      return {
        success: true,
        message: `Rotated the Hardware Secret for ${hardwareId}`,
        hardwareId,
        secret: result.secret,
      };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to rotate Hardware Secret'
      );
      return fail(status, { success: false, message });
    }
  },

  revokeHardware: async ({ request, params, locals: { apiClientV3 } }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const hardwareId = formData.get('hardwareId') as string;
    if (!id) return fail(400, { success: false, message: 'id required' });

    const ctx = await resolveOrgAndLeagueIds(apiClientV3, params);
    if (!ctx)
      return fail(404, { success: false, message: 'Org or league not found' });

    try {
      await apiClientV3.hardwareApi.revoke(ctx.orgId, ctx.leagueId, id);
      return { success: true, message: `Revoked ${hardwareId}` };
    } catch (err) {
      const { status, message } = await getApiErrorDetails(
        err,
        'Failed to revoke Hardware'
      );
      return fail(status, { success: false, message });
    }
  },
};
