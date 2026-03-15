using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/invite-links")]
[Authorize]
public class OrganizationInviteLinksController(IInviteLinkService inviteLinkService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<List<InviteLinkResponse>>> ListInviteLinks([FromRoute] Guid orgId)
    {
        return await inviteLinkService.ListInviteLinksAsync(orgId);
    }

    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<InviteLinkResponse>> CreateInviteLink(
        [FromRoute] Guid orgId, [FromBody] CreateInviteLinkRequest request)
    {
        var result = await inviteLinkService.CreateInviteLinkAsync(orgId, request);
        return Created($"api/v3/organizations/{orgId}/invite-links/{result.Id}", result);
    }

    [HttpDelete("{linkId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<IActionResult> DeleteInviteLink([FromRoute] Guid orgId, [FromRoute] Guid linkId)
    {
        await inviteLinkService.DeleteInviteLinkAsync(orgId, linkId);
        return NoContent();
    }
}
