import {
  AcceptanceStatus,
  GameInviteEligibility,
  GameInviteEndReason,
  GameInviteStatus,
  type GameInviteLinkResponse,
  type GameInviteParticipantResponse,
  type GameInviteResponse,
} from '@/api-v3';

/** Waiting time for an invite to fill, and the acceptance window once it has. Enforced by the API. */
export const ACCEPTANCE_WINDOW_SECONDS = 30;

const CODE_PATTERN = /^[A-Za-z0-9]{1,64}$/;

export function inviteLinkPath(shareCode: string): string {
  return `/game-invites/${encodeURIComponent(shareCode)}`;
}

/**
 * The only post-sign-in destination the app will honour from `returnTo`. It
 * admits a single invite link path, so a crafted value cannot send a user
 * off-site or to another route.
 */
export function safeInviteReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  const match = /^\/game-invites\/([^/?#]+)$/.exec(value);
  if (!match || !CODE_PATTERN.test(match[1])) return null;
  return value;
}

/** Whole seconds until an ISO deadline, never negative. */
export function secondsUntil(
  iso: string | null | undefined,
  nowMs: number
): number {
  if (!iso) return 0;
  const deadline = Date.parse(iso);
  if (Number.isNaN(deadline)) return 0;
  return Math.max(0, Math.ceil((deadline - nowMs) / 1000));
}

export function openSpots(invite: GameInviteResponse): number {
  return Math.max(0, invite.capacity - invite.participants.length);
}

export function isCreator(
  invite: GameInviteResponse,
  viewerId: string
): boolean {
  return invite.createdByLeaguePlayerId === viewerId;
}

export function findParticipant(
  invite: GameInviteResponse,
  leaguePlayerId: string
): GameInviteParticipantResponse | undefined {
  return invite.participants.find((p) => p.leaguePlayerId === leaguePlayerId);
}

/** Players the viewer added and still represents (not the viewer's own spot). */
export function managedParticipants(
  invite: GameInviteResponse,
  viewerId: string
): GameInviteParticipantResponse[] {
  return invite.participants.filter(
    (p) =>
      p.leaguePlayerId !== viewerId &&
      p.representativeLeaguePlayerId === viewerId
  );
}

/**
 * Mirrors the API rule: while waiting, the creator may remove anyone but
 * themselves, and anyone else may remove only players they represent.
 * Removing yourself is a leave, not a removal.
 */
export function canRemoveParticipant(
  invite: GameInviteResponse,
  viewerId: string,
  target: GameInviteParticipantResponse
): boolean {
  if (invite.status !== GameInviteStatus.Waiting) return false;
  if (target.isCreator || target.leaguePlayerId === viewerId) return false;
  return (
    isCreator(invite, viewerId) ||
    target.representativeLeaguePlayerId === viewerId
  );
}

/** Accept or decline for yourself, or for a player you represent, while the step is open. */
export function canRespond(
  invite: GameInviteResponse,
  viewerId: string,
  target: GameInviteParticipantResponse
): boolean {
  return (
    invite.status === GameInviteStatus.AwaitingAcceptance &&
    target.acceptanceStatus === AcceptanceStatus.Pending &&
    (target.leaguePlayerId === viewerId ||
      target.representativeLeaguePlayerId === viewerId)
  );
}

/** Your own spot was added by someone else; you can take control of it. */
export function canTakeControl(
  invite: GameInviteResponse,
  viewerId: string
): boolean {
  if (
    invite.status === GameInviteStatus.Started ||
    invite.status === GameInviteStatus.Ended
  ) {
    return false;
  }
  const mine = findParticipant(invite, viewerId);
  return !!mine && mine.representativeLeaguePlayerId !== viewerId;
}

export function eligibilityMessage(
  link: GameInviteLinkResponse
): string | null {
  switch (link.eligibility) {
    case GameInviteEligibility.Eligible:
      return null;
    case GameInviteEligibility.NotOrganizationMember:
      return `Join ${link.organizationName} to play in this game. Organization access is arranged separately.`;
    case GameInviteEligibility.NotLeagueMember:
      return `Join ${link.leagueName} in ${link.organizationName} before you can play in this game.`;
  }
}

export function endedInviteMessage(
  reason: GameInviteEndReason | null | undefined
): string {
  switch (reason) {
    case GameInviteEndReason.CreatorCancelled:
      return 'The creator cancelled this game invite.';
    case GameInviteEndReason.CreatorLeft:
      return 'The creator left, so this game invite was cancelled.';
    case GameInviteEndReason.CreatorDeclined:
      return 'The creator declined the match, so this game invite was cancelled.';
    case GameInviteEndReason.CreatorTimedOut:
      return 'The creator did not respond in time, so this game invite was cancelled.';
    case GameInviteEndReason.Expired:
      return 'This game invite expired before it filled.';
    default:
      return 'This game invite has ended.';
  }
}

/**
 * Copy for an acceptance step that failed and reopened the invite. Only shown
 * when the step returned to waiting, not when the invite ended.
 */
export function reopenedMessage(
  previous: GameInviteStatus | undefined,
  next: GameInviteResponse | null
): string | null {
  if (
    previous === GameInviteStatus.AwaitingAcceptance &&
    next?.status === GameInviteStatus.Waiting
  ) {
    return "Someone didn't accept, so the invite is open again. Teams are redrawn once it fills.";
  }
  return null;
}

/** `m:ss` for a countdown. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
