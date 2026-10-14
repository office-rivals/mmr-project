import { describe, expect, it } from 'vitest';
import { MembershipClaimStatus } from '@/api-v3';
import { getClaimState } from './claims';
import type {
  ClaimableMembershipsResponse,
  MembershipClaimRequestResponse,
} from '@/api-v3';
import type { OwnClaimRequest } from './claims';

const claim = (
  status: MembershipClaimStatus,
  overrides: Partial<MembershipClaimRequestResponse> = {}
): MembershipClaimRequestResponse => ({
  id: 'claim-1',
  organizationId: 'org-1',
  organizationMembershipId: 'membership-1',
  userId: 'user-1',
  requesterEmail: 'zed@example.com',
  target: {
    organizationMembershipId: 'membership-1',
    displayName: 'Zed Guest',
    matchCount: 3,
    leagues: [],
  },
  status,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const eligible: ClaimableMembershipsResponse = {
  requesterEligible: true,
  memberships: [],
};
const ineligible: ClaimableMembershipsResponse = {
  requesterEligible: false,
  memberships: [],
};

const state = (
  claimRequest: OwnClaimRequest,
  claimable: ClaimableMembershipsResponse | null
) => getClaimState({ claimRequest, claimable });

describe('getClaimState', () => {
  it('is none without a claim or anything to claim', () => {
    expect(state(undefined, ineligible)).toEqual({
      status: 'none',
      canRequest: false,
      canJoinLeagues: true,
    });
  });

  it('is eligible when the member can claim a player', () => {
    expect(state(undefined, eligible)).toEqual({
      status: 'eligible',
      canRequest: true,
      canJoinLeagues: true,
    });
  });

  it('is pending, and blocks joining, while a claim awaits review', () => {
    const pending = claim(MembershipClaimStatus.Pending);
    expect(state(pending, ineligible)).toEqual({
      status: 'pending',
      canRequest: false,
      canJoinLeagues: false,
      claim: pending,
    });
    // A pending claim wins even if eligibility says otherwise.
    expect(state(pending, eligible).status).toBe('pending');
    expect(state(pending, eligible).canRequest).toBe(false);
  });

  it('is approved once a moderator accepts the claim', () => {
    const approved = claim(MembershipClaimStatus.Approved);
    expect(state(approved, ineligible)).toEqual({
      status: 'approved',
      canRequest: false,
      canJoinLeagues: true,
      claim: approved,
    });
  });

  it("is rejected with the moderator's reason, and lets an eligible member try again", () => {
    const rejected = claim(MembershipClaimStatus.Rejected, {
      reviewNote: 'Not the same person',
    });
    expect(state(rejected, eligible)).toEqual({
      status: 'rejected',
      canRequest: true,
      canJoinLeagues: true,
      claim: rejected,
    });
    expect(state(rejected, ineligible).canRequest).toBe(false);
    expect(state(rejected, eligible).claim?.reviewNote).toBe(
      'Not the same person'
    );
  });

  it('treats a cancelled claim like no claim', () => {
    const cancelled = claim(MembershipClaimStatus.Cancelled);
    expect(state(cancelled, eligible).status).toBe('eligible');
    expect(state(cancelled, ineligible).status).toBe('none');
    expect(state(cancelled, ineligible).canJoinLeagues).toBe(true);
  });

  describe('when a lookup failed', () => {
    it('is unknown, and blocks joining, if the claim may be pending', () => {
      const unknown = {
        status: 'unknown',
        canRequest: false,
        canJoinLeagues: false,
      };
      expect(state(null, ineligible)).toEqual(unknown);
      expect(state(null, null)).toEqual(unknown);
    });

    it('is eligible if the member can claim, which rules out a pending claim', () => {
      expect(state(null, eligible)).toEqual({
        status: 'eligible',
        canRequest: true,
        canJoinLeagues: true,
      });
    });

    it('is none if only eligibility is unknown', () => {
      expect(state(undefined, null)).toEqual({
        status: 'none',
        canRequest: false,
        canJoinLeagues: true,
      });
    });
  });
});
