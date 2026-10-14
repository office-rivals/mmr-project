import {
  MembershipClaimStatus,
  type ClaimableMembershipsResponse,
  type MembershipClaimRequestResponse,
} from '$api3/models';

export type LeagueJoinState = 'available' | 'claimPending' | 'claimUnknown';

/**
 * Whether the member may join leagues. Match activity on the account can block
 * a pending claim's approval, so joining waits until the claim is decided.
 *
 * `claimRequest` is `undefined` when the member has no claim and `null` when
 * the lookup failed.
 */
export function getLeagueJoinState(
  claimRequest: MembershipClaimRequestResponse | null | undefined,
  claimable: ClaimableMembershipsResponse | null
): LeagueJoinState {
  if (claimRequest?.status === MembershipClaimStatus.Pending) {
    return 'claimPending';
  }
  // Eligibility already excludes a pending or approved claim, so it settles
  // a failed lookup.
  if (claimRequest === null && !claimable?.requesterEligible) {
    return 'claimUnknown';
  }
  return 'available';
}
