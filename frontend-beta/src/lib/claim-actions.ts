import { createServerFn, createServerOnlyFn } from '@tanstack/react-start';
import {
  failServerAction,
  nativeFormResponse,
  parseNativeFormData,
} from '@/lib/server/action-result';
import { resolveOrgIdBySlug } from '@/lib/server/admin';
import { getApiErrorDetails } from '@/lib/server/apiError';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { loadOrgClaimStatus } from '@/lib/server/claims';
import type { QueryClient } from '@tanstack/react-query';
import type { OrgClaimStatus } from '@/lib/claims';
import type {
  ClaimableMembershipsResponse,
  MembershipClaimRequestResponse,
} from '@/api-v3';

export type ClaimActionResult = { error?: string; success?: string };

export const CLAIM_SUCCESS_MESSAGES = {
  'claim-submitted': 'Claim request submitted',
  'claim-cancelled': 'Claim request cancelled',
} as const;

export type ClaimSuccessKey = keyof typeof CLAIM_SUCCESS_MESSAGES;

const loadOrgClaimStatusFn = createServerFn({ method: 'GET' })
  .validator((orgId: string) => orgId)
  .handler(async ({ data: orgId }): Promise<OrgClaimStatus> =>
    loadOrgClaimStatus(await requireApiClientV3(), orgId)
  );

// A transport failure leaves the claim as unknown as an API failure does.
const UNKNOWN_CLAIM_STATUS: OrgClaimStatus = {
  claimable: null,
  claimRequest: null,
};

/** The organization page's claim status. Never rejects. */
export function fetchOrgClaimStatus(
  queryClient: QueryClient,
  orgId: string
): Promise<OrgClaimStatus> {
  return queryClient.fetchQuery({
    queryKey: ['org', orgId, 'claim'],
    queryFn: () =>
      loadOrgClaimStatusFn({ data: orgId }).catch(() => UNKNOWN_CLAIM_STATUS),
    staleTime: 0,
  });
}

export interface ClaimPageData {
  claimable: ClaimableMembershipsResponse;
  claimRequest: MembershipClaimRequestResponse | undefined;
}

// Unlike the organization page, the claim page has nothing to show without it.
export const loadClaimPageFn = createServerFn({ method: 'GET' })
  .validator((orgId: string) => orgId)
  .handler(async ({ data: orgId }): Promise<ClaimPageData> => {
    const apiClientV3 = await requireApiClientV3();
    const [claimable, claimRequest] = await Promise.all([
      apiClientV3.organizationMembersApi.listClaimable(orgId),
      apiClientV3.organizationClaimRequestsApi.getMine(orgId),
    ]);
    return { claimable, claimRequest };
  });

export interface SubmitClaimInput {
  orgSlug: string;
  membershipId: string;
  note: string;
}

const submitClaim = createServerOnlyFn(async function submitClaim(
  data: SubmitClaimInput
): Promise<ClaimActionResult> {
  if (!data.membershipId) {
    return failServerAction(400, {
      error: 'Choose the player that represents you',
    });
  }

  const apiClientV3 = await requireApiClientV3();
  const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
  if (!orgId) return failServerAction(404, { error: 'Organization not found' });

  try {
    await apiClientV3.organizationClaimRequestsApi.create(orgId, {
      organizationMembershipId: data.membershipId,
      note: data.note.trim() || undefined,
    });
    return { success: CLAIM_SUCCESS_MESSAGES['claim-submitted'] };
  } catch (error) {
    const { status, message } = await getApiErrorDetails(
      error,
      'Failed to submit claim request'
    );
    return failServerAction(status, { error: message });
  }
});

export const submitClaimFn = createServerFn({ method: 'POST' })
  .validator((input: SubmitClaimInput) => input)
  .handler(({ data }): Promise<ClaimActionResult> => submitClaim(data));

export interface CancelClaimInput {
  orgSlug: string;
  claimId: string;
}

const cancelClaim = createServerOnlyFn(async function cancelClaim(
  data: CancelClaimInput
): Promise<ClaimActionResult> {
  if (!data.claimId) {
    return failServerAction(400, { error: 'Claim request is invalid' });
  }

  const apiClientV3 = await requireApiClientV3();
  const orgId = await resolveOrgIdBySlug(apiClientV3, data.orgSlug);
  if (!orgId) return failServerAction(404, { error: 'Organization not found' });

  try {
    await apiClientV3.organizationClaimRequestsApi.cancel(orgId, data.claimId);
    return { success: CLAIM_SUCCESS_MESSAGES['claim-cancelled'] };
  } catch (error) {
    const { status, message } = await getApiErrorDetails(
      error,
      'Failed to cancel claim request'
    );
    return failServerAction(status, { error: message });
  }
});

export const cancelClaimFn = createServerFn({ method: 'POST' })
  .validator((input: CancelClaimInput) => input)
  .handler(({ data }): Promise<ClaimActionResult> => cancelClaim(data));

// The claim page's no-JS form POST, selected by its `_action` field.
export const claimFormAction = createServerOnlyFn(
  async function claimFormAction(
    request: Request,
    orgSlug: string
  ): Promise<Response> {
    const formData = await parseNativeFormData(request);
    let result: ClaimActionResult;
    let successQueryValue: ClaimSuccessKey | undefined;
    try {
      switch (formData.get('_action')) {
        case 'submit':
          successQueryValue = 'claim-submitted';
          result = await submitClaim({
            orgSlug,
            membershipId: String(formData.get('membershipId') ?? ''),
            note: String(formData.get('note') ?? ''),
          });
          break;
        case 'cancel':
          successQueryValue = 'claim-cancelled';
          result = await cancelClaim({
            orgSlug,
            claimId: String(formData.get('claimId') ?? ''),
          });
          break;
        default:
          return new Response('Unsupported form action', { status: 400 });
      }
    } catch {
      result = failServerAction(500, {
        error: 'Request failed. Please try again.',
      });
    }
    return nativeFormResponse(request, result, { successQueryValue });
  }
);
