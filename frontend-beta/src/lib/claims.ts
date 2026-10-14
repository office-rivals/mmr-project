import { MembershipClaimStatus } from '@/api-v3';
import type {
  ClaimableMembershipResponse,
  ClaimableMembershipsResponse,
  MembershipClaimRequestResponse,
} from '@/api-v3';

/**
 * The member's own claim: `undefined` when they have none, `null` when the
 * lookup failed. The two stay distinct because an unknown claim may be
 * pending.
 */
export type OwnClaimRequest = MembershipClaimRequestResponse | null | undefined;

export interface OrgClaimStatus {
  /** `null` when the lookup failed. */
  claimable: ClaimableMembershipsResponse | null;
  claimRequest: OwnClaimRequest;
}

export type ClaimStatus =
  'unknown' | 'none' | 'eligible' | 'pending' | 'approved' | 'rejected';

export interface ClaimState {
  status: ClaimStatus;
  /**
   * The member can request one of the players now, including again after a
   * rejection.
   */
  canRequest: boolean;
  /**
   * Match activity on the account can block a pending claim's approval, so
   * joining leagues waits until the claim is decided and its status is known.
   */
  canJoinLeagues: boolean;
  /** The member's latest claim, including a cancelled one. */
  claim?: MembershipClaimRequestResponse;
}

export function getClaimState({
  claimable,
  claimRequest,
}: OrgClaimStatus): ClaimState {
  const claim = claimRequest ?? undefined;
  const eligible = claimable?.requesterEligible ?? false;
  const canRequest = eligible && (claimable?.memberships.length ?? 0) > 0;

  switch (claim?.status) {
    case MembershipClaimStatus.Pending:
      return {
        status: 'pending',
        canRequest: false,
        canJoinLeagues: false,
        claim,
      };
    case MembershipClaimStatus.Approved:
      return {
        status: 'approved',
        canRequest: false,
        canJoinLeagues: true,
        claim,
      };
    case MembershipClaimStatus.Rejected:
      return { status: 'rejected', canRequest, canJoinLeagues: true, claim };
  }

  if (canRequest) {
    return { status: 'eligible', canRequest, canJoinLeagues: true, claim };
  }
  // Eligibility already excludes a pending or approved claim, so only an
  // ineligible member's failed lookup stays unknown.
  if (claimRequest === null && !eligible) {
    return { status: 'unknown', canRequest: false, canJoinLeagues: false };
  }
  return { status: 'none', canRequest: false, canJoinLeagues: true, claim };
}

export const getClaimablePlayerName = (player: ClaimableMembershipResponse) =>
  player.displayName?.trim() || player.username?.trim() || 'Unnamed player';

export const matchesLabel = (count: number) =>
  count === 1 ? 'match' : 'matches';

export const formatMatchCount = (count: number) =>
  `${count} ${matchesLabel(count)}`;

export const formatChoiceCount = (count: number) =>
  count === 1 ? '1 player' : `${count} players to choose from`;
