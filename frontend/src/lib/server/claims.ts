import type { OrgClaimStatus } from '@/lib/claims';
import type { ApiClientV3 } from './apiClientV3';

type ClaimApis = Pick<
  ApiClientV3,
  'organizationMembersApi' | 'organizationClaimRequestsApi'
>;

/**
 * A failed claim request degrades the claim UI instead of failing the page.
 * `getMine` resolves undefined for "no claim", so its failure becomes null to
 * stay distinguishable: an unknown claim may be pending.
 */
export async function loadOrgClaimStatus(
  apiClientV3: ClaimApis,
  orgId: string
): Promise<OrgClaimStatus> {
  const [claimable, claimRequest] = await Promise.all([
    apiClientV3.organizationMembersApi.listClaimable(orgId).catch(() => null),
    apiClientV3.organizationClaimRequestsApi.getMine(orgId).catch(() => null),
  ]);
  return { claimable, claimRequest };
}
