import { describe, expect, it } from 'vitest';
import {
  MembershipClaimStatus,
  type ClaimableMembershipsResponse,
  type MembershipClaimRequestResponse,
} from '$api3/models';
import { getLeagueJoinState } from './league-join';

const claim = (status: MembershipClaimStatus) =>
  ({ status }) as MembershipClaimRequestResponse;
const eligible: ClaimableMembershipsResponse = {
  requesterEligible: true,
  memberships: [],
};
const ineligible: ClaimableMembershipsResponse = {
  requesterEligible: false,
  memberships: [],
};

describe('getLeagueJoinState', () => {
  it('blocks joining while a claim is pending', () => {
    expect(
      getLeagueJoinState(claim(MembershipClaimStatus.Pending), ineligible)
    ).toBe('claimPending');
  });

  it('blocks joining when the claim lookup failed and eligibility is unknown or false', () => {
    expect(getLeagueJoinState(null, ineligible)).toBe('claimUnknown');
    expect(getLeagueJoinState(null, null)).toBe('claimUnknown');
  });

  it('allows joining when the claim lookup failed but the member is eligible to claim', () => {
    expect(getLeagueJoinState(null, eligible)).toBe('available');
  });

  it('allows joining when the member has no claim', () => {
    expect(getLeagueJoinState(undefined, ineligible)).toBe('available');
    expect(getLeagueJoinState(undefined, null)).toBe('available');
  });

  it.each([
    MembershipClaimStatus.Approved,
    MembershipClaimStatus.Rejected,
    MembershipClaimStatus.Cancelled,
  ])('allows joining after a %s claim', (status) => {
    expect(getLeagueJoinState(claim(status), ineligible)).toBe('available');
  });
});
