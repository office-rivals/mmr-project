using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/members")]
[Authorize]
public class OrganizationMembersController(IOrganizationService organizationService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<OrganizationMemberResponse>>> ListMembers([FromRoute] Guid orgId)
    {
        return await organizationService.ListMembersAsync(orgId);
    }

    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<OrganizationMemberResponse>> InviteMember(
        [FromRoute] Guid orgId, [FromBody] InviteMemberRequest request)
    {
        var result = await organizationService.InviteMemberAsync(orgId, request);
        return Created($"api/v3/organizations/{orgId}/members/{result.Id}", result);
    }

    [HttpPatch("{membershipId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<OrganizationMemberResponse>> UpdateMemberRole(
        [FromRoute] Guid orgId, [FromRoute] Guid membershipId, [FromBody] UpdateMemberRoleRequest request)
    {
        return await organizationService.UpdateMemberRoleAsync(orgId, membershipId, request);
    }

    [HttpDelete("{membershipId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<IActionResult> RemoveMember([FromRoute] Guid orgId, [FromRoute] Guid membershipId)
    {
        await organizationService.RemoveMemberAsync(orgId, membershipId);
        return NoContent();
    }
}
