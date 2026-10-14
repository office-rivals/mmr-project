using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.RateLimiting;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/claim-requests")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
public class OrganizationClaimRequestsController(IMembershipClaimService claimService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    [EnableRateLimiting(RateLimitPolicies.ClaimRequestCreate)]
    public async Task<ActionResult<MembershipClaimRequestResponse>> Create(
        [FromRoute] Guid orgId, [FromBody] CreateMembershipClaimRequest request)
    {
        var result = await claimService.CreateAsync(orgId, request);
        return Created($"api/v3/organizations/{orgId}/claim-requests/{result.Id}", result);
    }

    [HttpGet("mine")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MembershipClaimRequestResponse>> GetMine([FromRoute] Guid orgId)
    {
        var result = await claimService.GetMineAsync(orgId);
        return result == null ? NoContent() : Ok(result);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<List<MembershipClaimRequestResponse>>> List(
        [FromRoute] Guid orgId, [FromQuery] MembershipClaimStatus status = MembershipClaimStatus.Pending)
    {
        return await claimService.ListAsync(orgId, status);
    }

    [HttpDelete("{claimId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<IActionResult> Cancel([FromRoute] Guid orgId, [FromRoute] Guid claimId)
    {
        await claimService.CancelAsync(orgId, claimId);
        return NoContent();
    }

    [HttpPost("{claimId:guid}/approve")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<MembershipClaimRequestResponse>> Approve(
        [FromRoute] Guid orgId, [FromRoute] Guid claimId)
    {
        return await claimService.ApproveAsync(orgId, claimId);
    }

    [HttpPost("{claimId:guid}/reject")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<MembershipClaimRequestResponse>> Reject(
        [FromRoute] Guid orgId,
        [FromRoute] Guid claimId,
        [FromBody] ReviewMembershipClaimRequest request)
    {
        return await claimService.RejectAsync(orgId, claimId, request);
    }
}
