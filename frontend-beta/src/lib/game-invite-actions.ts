import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import { ResponseError } from '@/api-v3';
import { failServerAction } from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { getApiErrorDetails } from '@/lib/server/apiError';
import type {
  CurrentGameInviteResponse,
  GameInviteLinkResponse,
  GameInviteResponse,
  LeaguePlayerResponse,
} from '@/api-v3';

export type GameInviteActionName =
  | 'create'
  | 'addPlayers'
  | 'removePlayer'
  | 'leave'
  | 'leaveAndRemoveManaged'
  | 'cancel'
  | 'takeControl'
  | 'accept'
  | 'decline';

export interface GameInviteActionInput {
  orgId: string;
  leagueId: string;
  action: GameInviteActionName;
  inviteId?: string;
  /** Echoed for accept/decline so a stale screen cannot answer a newer draw. */
  roundId?: string;
  /** The player the action applies to: a removal, or a response for a managed player. */
  leaguePlayerId?: string;
  leaguePlayerIds?: string[];
}

export type GameInviteActionResult =
  | { status: 'ok'; invite: GameInviteResponse | null }
  | { status: 'error'; message: string };

const FALLBACKS: Record<GameInviteActionName, string> = {
  create: 'Failed to create the game invite',
  addPlayers: 'Failed to add players',
  removePlayer: 'Failed to remove the player',
  leave: 'Failed to leave the game invite',
  leaveAndRemoveManaged: 'Failed to leave the game invite',
  cancel: 'Failed to cancel the game invite',
  takeControl: 'Failed to take control of the spot',
  accept: 'Failed to accept the match',
  decline: 'Failed to decline the match',
};

const NEEDS_INVITE = new Set<GameInviteActionName>([
  'addPlayers',
  'removePlayer',
  'leave',
  'leaveAndRemoveManaged',
  'cancel',
  'takeControl',
  'accept',
  'decline',
]);

export const gameInviteAction = createServerOnlyFn(
  async function gameInviteAction(
    data: GameInviteActionInput
  ): Promise<GameInviteActionResult> {
    if (!data.orgId || !data.leagueId) {
      return failServerAction(400, {
        status: 'error',
        message: 'Organization and league are required',
      });
    }
    if (NEEDS_INVITE.has(data.action) && !data.inviteId) {
      return failServerAction(400, {
        status: 'error',
        message: 'Game invite ID is required',
      });
    }
    if (
      (data.action === 'accept' || data.action === 'decline') &&
      (!data.roundId || !data.leaguePlayerId)
    ) {
      return failServerAction(400, {
        status: 'error',
        message: 'Round and player are required',
      });
    }
    if (data.action === 'removePlayer' && !data.leaguePlayerId) {
      return failServerAction(400, {
        status: 'error',
        message: 'Player is required',
      });
    }
    if (data.action === 'addPlayers' && !data.leaguePlayerIds?.length) {
      return failServerAction(400, {
        status: 'error',
        message: 'Choose at least one player to add.',
      });
    }

    const api = (await requireApiClientV3()).gameInvitesApi;
    const { orgId, leagueId, inviteId = '' } = data;
    try {
      let invite: GameInviteResponse | null;
      switch (data.action) {
        case 'create':
          invite = await api.createInvite(orgId, leagueId);
          break;
        case 'addPlayers':
          invite = await api.addPlayers(orgId, leagueId, inviteId, {
            leaguePlayerIds: data.leaguePlayerIds!,
          });
          break;
        case 'removePlayer':
          invite = await api.removePlayer(
            orgId,
            leagueId,
            inviteId,
            data.leaguePlayerId!
          );
          break;
        case 'leave':
          invite = await api.leave(orgId, leagueId, inviteId, false);
          break;
        case 'leaveAndRemoveManaged':
          invite = await api.leave(orgId, leagueId, inviteId, true);
          break;
        case 'cancel':
          invite = await api.cancel(orgId, leagueId, inviteId);
          break;
        case 'takeControl':
          invite = await api.takeControl(orgId, leagueId, inviteId);
          break;
        case 'accept':
        case 'decline':
          invite = await api.respond(
            orgId,
            leagueId,
            inviteId,
            data.roundId!,
            data.leaguePlayerId!,
            data.action === 'accept'
          );
          break;
      }
      return { status: 'ok', invite: invite ?? null };
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        FALLBACKS[data.action]
      );
      return failServerAction(status, { status: 'error', message });
    }
  }
);

export const gameInviteActionFn = createServerFn({ method: 'POST' })
  .validator((input: GameInviteActionInput) => input)
  .handler(({ data }): Promise<GameInviteActionResult> =>
    gameInviteAction(data)
  );

/** The caller's current invite in a league, or null. Failures read as "no invite" so the Play tab still renders. */
export const getCurrentGameInviteFn = createServerFn({ method: 'GET' })
  .validator((input: { orgId: string; leagueId: string }) => input)
  .handler(async ({ data }): Promise<GameInviteResponse | null> => {
    const api = (await requireApiClientV3()).gameInvitesApi;
    const current: CurrentGameInviteResponse = await api.getCurrentInvite(
      data.orgId,
      data.leagueId
    );
    return current.invite ?? null;
  });

/** Re-reads one invite by id; used while an acceptance step is on screen. */
export const getGameInviteFn = createServerFn({ method: 'GET' })
  .validator(
    (input: { orgId: string; leagueId: string; inviteId: string }) => input
  )
  .handler(async ({ data }): Promise<GameInviteResponse | null> => {
    const api = (await requireApiClientV3()).gameInvitesApi;
    try {
      return await api.getInvite(data.orgId, data.leagueId, data.inviteId);
    } catch (error) {
      if (error instanceof ResponseError && error.response.status === 404)
        return null;
      throw error;
    }
  });

/** Resolves a shared link. Null when the code does not match an invite. */
export const getGameInviteLinkFn = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(async ({ data: code }): Promise<GameInviteLinkResponse | null> => {
    const api = (await requireApiClientV3()).gameInviteLinksApi;
    try {
      return await api.getByShareCode(code);
    } catch (error) {
      if (error instanceof ResponseError && error.response.status === 404)
        return null;
      throw error;
    }
  });

export const getGameInviteLeaguePlayersFn = createServerFn({ method: 'GET' })
  .validator((input: { orgId: string; leagueId: string }) => input)
  .handler(async ({ data }): Promise<LeaguePlayerResponse[]> => {
    const api = await requireApiClientV3();
    return api.leaguePlayersApi.listPlayers(data.orgId, data.leagueId);
  });

export type JoinGameInviteResult =
  | { status: 'ok'; orgSlug: string; leagueSlug: string }
  | { status: 'error'; message: string };

/** Explicit join from a shared link. Never runs from a preview or a loader. */
export const joinGameInviteFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { code: string; orgSlug: string; leagueSlug: string }) => input
  )
  .handler(async ({ data }): Promise<JoinGameInviteResult> => {
    const api = (await requireApiClientV3()).gameInviteLinksApi;
    try {
      await api.join(data.code);
      return {
        status: 'ok',
        orgSlug: data.orgSlug,
        leagueSlug: data.leagueSlug,
      };
    } catch (error) {
      const { status, message } = await getApiErrorDetails(
        error,
        'Failed to join the game invite'
      );
      return failServerAction(status, { status: 'error', message });
    }
  });
