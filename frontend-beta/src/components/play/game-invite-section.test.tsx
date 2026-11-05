// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  act,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  AcceptanceStatus,
  GameInviteEndReason,
  GameInviteStatus,
  type GameInviteResponse,
} from '@/api-v3';
import { GameInviteSection } from './game-invite-section';

const api = vi.hoisted(() => ({
  gameInviteActionFn: vi.fn(),
  getCurrentGameInviteFn: vi.fn(),
  getGameInviteFn: vi.fn(),
}));
vi.mock('@/lib/game-invite-actions', () => api);

let current: GameInviteResponse | null;
let queryClient: QueryClient;

function fixture(): GameInviteResponse {
  return {
    id: 'invite',
    shareCode: 'ABC123',
    status: GameInviteStatus.Waiting,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
    capacity: 4,
    createdByLeaguePlayerId: 'creator',
    teams: [],
    participants: [
      {
        leaguePlayerId: 'creator',
        displayName: 'Creator',
        representativeLeaguePlayerId: 'creator',
        isCreator: true,
        acceptanceStatus: AcceptanceStatus.Pending,
        joinedAt: new Date().toISOString(),
      },
      {
        leaguePlayerId: 'viewer',
        displayName: 'Viewer',
        representativeLeaguePlayerId: 'viewer',
        isCreator: false,
        acceptanceStatus: AcceptanceStatus.Pending,
        joinedAt: new Date().toISOString(),
      },
      {
        leaguePlayerId: 'colleague',
        displayName: 'Colleague',
        representativeLeaguePlayerId: 'viewer',
        isCreator: false,
        acceptanceStatus: AcceptanceStatus.Pending,
        joinedAt: new Date().toISOString(),
      },
    ],
  };
}

function mount(
  invite: GameInviteResponse,
  viewer = 'viewer',
  inviteId?: string
) {
  current = invite;
  return render(
    <QueryClientProvider client={queryClient}>
      <GameInviteSection
        orgId="org"
        leagueId="league"
        leaguePlayerId={viewer}
        leaguePlayers={[]}
        seedInvite={invite}
        inQueue={false}
        inviteId={inviteId}
      />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  api.getCurrentGameInviteFn.mockImplementation(async () => current);
  api.getGameInviteFn.mockImplementation(async () => current);
  api.gameInviteActionFn.mockImplementation(async () => {
    current = null;
    return { status: 'ok', invite: null };
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe('game invite interactions', () => {
  it.each([
    ['Leave and keep them in the invite', 'leave'],
    ['Leave and remove them', 'leaveAndRemoveManaged'],
  ])('offers the representative leave choice: %s', async (label, action) => {
    const user = userEvent.setup();
    mount(fixture());
    await user.click(screen.getByRole('button', { name: 'Leave invite' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Leave this game invite?',
    });
    expect(api.gameInviteActionFn).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: label }));
    await waitFor(() =>
      expect(api.gameInviteActionFn).toHaveBeenCalledWith({
        data: { action, orgId: 'org', leagueId: 'league', inviteId: 'invite' },
      })
    );
    await screen.findByText('You left the game invite.');
  });

  it('returns focus to Leave when the dialog is dismissed with Escape', async () => {
    const user = userEvent.setup();
    mount(fixture());
    const trigger = screen.getByRole('button', { name: 'Leave invite' });
    await user.click(trigger);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(api.gameInviteActionFn).not.toHaveBeenCalled();
  });

  it('leaves without a prompt once added players manage themselves', async () => {
    const user = userEvent.setup();
    const invite = fixture();
    invite.participants[2].representativeLeaguePlayerId = 'colleague';
    mount(invite);
    await user.click(screen.getByRole('button', { name: 'Leave invite' }));
    await waitFor(() => expect(api.gameInviteActionFn).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets an added player take control during acceptance', async () => {
    const user = userEvent.setup();
    const invite = fixture();
    invite.status = GameInviteStatus.AwaitingAcceptance;
    invite.roundId = 'current-round';
    invite.acceptanceExpiresAt = new Date(Date.now() + 30_000).toISOString();
    invite.participants[1].representativeLeaguePlayerId = 'creator';
    api.gameInviteActionFn.mockImplementation(async () => {
      current = {
        ...invite,
        participants: invite.participants.map((p) =>
          p.leaguePlayerId === 'viewer'
            ? { ...p, representativeLeaguePlayerId: 'viewer' }
            : p
        ),
      };
      return { status: 'ok', invite: current };
    });
    mount(invite);
    await user.click(
      screen.getByRole('button', { name: 'Take control of my spot' })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Take control of my spot' })
      ).toBeNull()
    );
    expect(api.gameInviteActionFn).toHaveBeenCalledWith({
      data: {
        orgId: 'org',
        leagueId: 'league',
        inviteId: 'invite',
        action: 'takeControl',
      },
    });
  });

  it('responds for a represented player using the displayed round', async () => {
    const user = userEvent.setup();
    const invite = fixture();
    invite.status = GameInviteStatus.AwaitingAcceptance;
    invite.roundId = 'current-round';
    invite.acceptanceExpiresAt = new Date(Date.now() + 30_000).toISOString();
    mount(invite);
    expect(
      screen.queryByRole('button', { name: 'Accept for Creator' })
    ).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Accept for Colleague' })
    );
    await waitFor(() =>
      expect(api.gameInviteActionFn).toHaveBeenCalledWith({
        data: {
          orgId: 'org',
          leagueId: 'league',
          inviteId: 'invite',
          action: 'accept',
          leaguePlayerId: 'colleague',
          roundId: 'current-round',
        },
      })
    );
  });

  it('keeps a shared view tied to its invite instead of another current invite', async () => {
    mount(fixture(), 'viewer', 'invite');
    await waitFor(() =>
      expect(api.getGameInviteFn).toHaveBeenCalledWith({
        data: { orgId: 'org', leagueId: 'league', inviteId: 'invite' },
      })
    );
    expect(api.getCurrentGameInviteFn).not.toHaveBeenCalled();
  });

  it('retains a shared invite completion instead of offering to create another', async () => {
    const invite = fixture();
    invite.status = GameInviteStatus.Started;
    mount(invite, 'viewer', 'invite');
    await screen.findByText(
      'Everyone accepted. The match is live under Live now in Play.'
    );
    expect(
      screen.queryByRole('button', { name: 'Create game invite' })
    ).toBeNull();
  });

  it.each([
    [GameInviteStatus.Ended, 'The creator cancelled this game invite.'],
    [
      GameInviteStatus.Started,
      'Everyone accepted. The match is live under Live now.',
    ],
  ])(
    'explains a polled completion to a non-acting participant: %s',
    async (status, message) => {
      const invite = fixture();
      mount(invite);
      await waitFor(() =>
        expect(api.getCurrentGameInviteFn).toHaveBeenCalled()
      );
      api.getGameInviteFn.mockResolvedValue({
        ...invite,
        status,
        endReason: GameInviteEndReason.CreatorCancelled,
        participants: [],
        teams: [],
      });
      current = null;
      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: ['league', 'org', 'league', 'gameInvite'],
        });
      });
      await screen.findByText(message);
    }
  );

  it('does not offer to create a different game when a shared invite disappears', async () => {
    api.getGameInviteFn.mockResolvedValue(null);
    mount(fixture(), 'viewer', 'invite');
    await screen.findByText('This game invite is no longer available.');
    expect(
      screen.queryByRole('button', { name: 'Create game invite' })
    ).toBeNull();
  });
});
