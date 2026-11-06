import { describe, expect, it } from 'vitest';
import { loadOrgClaimStatus } from './claims';

type ClaimApis = Parameters<typeof loadOrgClaimStatus>[0];

const failing = async () => {
  throw new Error('API unavailable');
};

function makeApis(opts: {
  listClaimable?: () => Promise<unknown>;
  getMine?: () => Promise<unknown>;
}): ClaimApis {
  return {
    organizationMembersApi: {
      listClaimable:
        opts.listClaimable ??
        (async () => ({ requesterEligible: true, memberships: [] })),
    },
    organizationClaimRequestsApi: {
      getMine: opts.getMine ?? (async () => undefined),
    },
  } as unknown as ClaimApis;
}

describe('loadOrgClaimStatus — claim data is optional', () => {
  it('reports a failed claimable lookup as null', async () => {
    const status = await loadOrgClaimStatus(
      makeApis({ listClaimable: failing }),
      'org-1'
    );

    expect(status.claimable).toBeNull();
    expect(status.claimRequest).toBeUndefined();
  });

  it('reports a failed own-claim lookup as null, not undefined', async () => {
    const status = await loadOrgClaimStatus(
      makeApis({ getMine: failing }),
      'org-1'
    );

    // null, not undefined: the claim is unknown, not absent.
    expect(status.claimRequest).toBeNull();
    expect(status.claimable).toEqual({
      requesterEligible: true,
      memberships: [],
    });
  });

  it('reports no claim as undefined', async () => {
    const status = await loadOrgClaimStatus(makeApis({}), 'org-1');

    expect(status.claimRequest).toBeUndefined();
  });

  it('passes the organization to both lookups', async () => {
    const orgIds: string[] = [];
    await loadOrgClaimStatus(
      makeApis({
        listClaimable: async (...args: unknown[]) => {
          orgIds.push(String(args[0]));
          return { requesterEligible: false, memberships: [] };
        },
        getMine: async (...args: unknown[]) => {
          orgIds.push(String(args[0]));
          return undefined;
        },
      }),
      'org-1'
    );

    expect(orgIds).toEqual(['org-1', 'org-1']);
  });
});
