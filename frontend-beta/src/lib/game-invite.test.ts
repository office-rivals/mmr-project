import { describe, expect, it } from 'vitest';
import {
  AcceptanceStatus,
  GameInviteEligibility,
  GameInviteEndReason,
  GameInviteStatus,
  type GameInviteParticipantResponse,
  type GameInviteResponse,
} from '@/api-v3';
import {
  canRemoveParticipant,
  canRespond,
  canTakeControl,
  endedInviteMessage,
  eligibilityMessage,
  formatCountdown,
  managedParticipants,
  openSpots,
  reopenedMessage,
  safeInviteReturnPath,
  secondsUntil,
} from './game-invite';

const participant = (
  leaguePlayerId: string,
  overrides: Partial<GameInviteParticipantResponse> = {}
): GameInviteParticipantResponse => ({
  leaguePlayerId,
  representativeLeaguePlayerId: leaguePlayerId,
  isCreator: false,
  acceptanceStatus: AcceptanceStatus.Pending,
  joinedAt: '2026-11-05T10:00:00Z',
  ...overrides,
});

const invite = (
  overrides: Partial<GameInviteResponse> = {}
): GameInviteResponse => ({
  id: 'invite-1',
  shareCode: 'ABC123',
  status: GameInviteStatus.Waiting,
  createdAt: '2026-11-05T10:00:00Z',
  expiresAt: '2026-11-05T10:30:00Z',
  capacity: 4,
  createdByLeaguePlayerId: 'creator',
  participants: [participant('creator', { isCreator: true })],
  teams: [],
  ...overrides,
});

describe('safeInviteReturnPath', () => {
  it('admits only a single invite link path', () => {
    expect(safeInviteReturnPath('/game-invites/ABC123')).toBe(
      '/game-invites/ABC123'
    );
  });

  it.each([
    'https://evil.example/game-invites/ABC',
    '//evil.example/game-invites/ABC',
    '/\\evil.example/game-invites/ABC',
    '/game-invites/ABC/../../settings',
    '/game-invites/ABC?next=https://evil.example',
    '/game-invites/',
    '/settings',
    '/game-invites/ABC#x',
    '',
  ])('rejects %s', (value) => {
    expect(safeInviteReturnPath(value)).toBeNull();
  });

  it('rejects non-strings and overlong values', () => {
    expect(safeInviteReturnPath(undefined)).toBeNull();
    expect(safeInviteReturnPath(['/game-invites/ABC'])).toBeNull();
    expect(safeInviteReturnPath(`/game-invites/${'A'.repeat(300)}`)).toBeNull();
  });
});

describe('secondsUntil', () => {
  it('counts whole seconds and never goes negative', () => {
    const now = Date.parse('2026-11-05T10:00:00Z');
    expect(secondsUntil('2026-11-05T10:00:30Z', now)).toBe(30);
    expect(secondsUntil('2026-11-05T10:00:00.500Z', now)).toBe(1);
    expect(secondsUntil('2026-11-05T09:59:00Z', now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(0);
    expect(secondsUntil('not a date', now)).toBe(0);
  });
});

describe('spots and managed players', () => {
  it('reports open spots from capacity', () => {
    expect(openSpots(invite())).toBe(3);
    expect(
      openSpots(
        invite({
          capacity: 2,
          participants: [participant('a'), participant('b')],
        })
      )
    ).toBe(0);
  });

  it('lists only players the viewer represents, not their own spot', () => {
    const current = invite({
      participants: [
        participant('creator', { isCreator: true }),
        participant('alice', { representativeLeaguePlayerId: 'creator' }),
        participant('bob', { representativeLeaguePlayerId: 'alice' }),
      ],
    });
    expect(
      managedParticipants(current, 'creator').map((p) => p.leaguePlayerId)
    ).toEqual(['alice']);
    expect(
      managedParticipants(current, 'alice').map((p) => p.leaguePlayerId)
    ).toEqual(['bob']);
  });
});

describe('canRemoveParticipant', () => {
  const current = invite({
    participants: [
      participant('creator', { isCreator: true }),
      participant('alice', { representativeLeaguePlayerId: 'creator' }),
      participant('bob', { representativeLeaguePlayerId: 'bob' }),
      participant('carol', { representativeLeaguePlayerId: 'bob' }),
    ],
  });
  const target = (id: string) =>
    current.participants.find((p) => p.leaguePlayerId === id)!;

  it('lets the creator remove anyone except themselves', () => {
    expect(canRemoveParticipant(current, 'creator', target('bob'))).toBe(true);
    expect(canRemoveParticipant(current, 'creator', target('creator'))).toBe(
      false
    );
  });

  it('lets a participant remove only players they added', () => {
    expect(canRemoveParticipant(current, 'bob', target('carol'))).toBe(true);
    expect(canRemoveParticipant(current, 'bob', target('alice'))).toBe(false);
    expect(canRemoveParticipant(current, 'bob', target('bob'))).toBe(false);
  });

  it('never removes through this path once the roster is locked', () => {
    const locked = { ...current, status: GameInviteStatus.AwaitingAcceptance };
    expect(canRemoveParticipant(locked, 'creator', target('alice'))).toBe(
      false
    );
  });
});

describe('canRespond', () => {
  const current = invite({
    status: GameInviteStatus.AwaitingAcceptance,
    roundId: 'round-1',
    participants: [
      participant('creator', { isCreator: true }),
      participant('alice', { representativeLeaguePlayerId: 'creator' }),
    ],
  });

  it('allows responding for yourself and for players you represent', () => {
    expect(canRespond(current, 'creator', current.participants[0])).toBe(true);
    expect(canRespond(current, 'creator', current.participants[1])).toBe(true);
    expect(canRespond(current, 'alice', current.participants[1])).toBe(true);
  });

  it('blocks responses after the step has answered or while waiting', () => {
    const answered = {
      ...current,
      participants: [
        current.participants[0],
        {
          ...current.participants[1],
          acceptanceStatus: AcceptanceStatus.Accepted,
        },
      ],
    };
    expect(canRespond(answered, 'creator', answered.participants[1])).toBe(
      false
    );
    expect(canRespond(invite(), 'creator', invite().participants[0])).toBe(
      false
    );
  });
});

describe('canTakeControl', () => {
  it('offers control only over a spot added by someone else', () => {
    const current = invite({
      participants: [
        participant('creator', { isCreator: true }),
        participant('alice', { representativeLeaguePlayerId: 'creator' }),
      ],
    });
    expect(canTakeControl(current, 'alice')).toBe(true);
    expect(canTakeControl(current, 'creator')).toBe(false);
    expect(
      canTakeControl({ ...current, status: GameInviteStatus.Started }, 'alice')
    ).toBe(false);
  });
});

describe('copy', () => {
  it('explains membership requirements without naming the roster', () => {
    const link = {
      organizationId: 'o',
      organizationSlug: 'org',
      organizationName: 'Org',
      leagueId: 'l',
      leagueSlug: 'league',
      leagueName: 'League',
      eligibility: GameInviteEligibility.NotLeagueMember,
    };
    expect(eligibilityMessage(link)).toContain('League');
    expect(
      eligibilityMessage({
        ...link,
        eligibility: GameInviteEligibility.Eligible,
      })
    ).toBeNull();
  });

  it('describes each end reason', () => {
    expect(endedInviteMessage(GameInviteEndReason.Expired)).toMatch(/expired/);
    expect(endedInviteMessage(GameInviteEndReason.CreatorLeft)).toMatch(
      /creator left/
    );
    expect(endedInviteMessage(undefined)).toBe('This game invite has ended.');
  });

  it('announces a reopened invite only when it returned to waiting', () => {
    expect(
      reopenedMessage(
        GameInviteStatus.AwaitingAcceptance,
        invite({ status: GameInviteStatus.Waiting })
      )
    ).toMatch(/open again/);
    expect(reopenedMessage(GameInviteStatus.Waiting, invite())).toBeNull();
    expect(
      reopenedMessage(
        GameInviteStatus.AwaitingAcceptance,
        invite({ status: GameInviteStatus.Ended })
      )
    ).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('formats minutes and zero-padded seconds', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});
