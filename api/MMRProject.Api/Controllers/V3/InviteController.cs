using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/invites")]
[Authorize]
public class InviteController(IInviteLinkService inviteLinkService) : ControllerBase
{
    [HttpGet("{code}")]
    [Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
    public async Task<ActionResult<InviteInfoResponse>> GetInviteInfo([FromRoute] string code)
    {
        return await inviteLinkService.GetInviteInfoAsync(code);
    }

    [HttpPost("{code}/join")]
    [Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
    public async Task<ActionResult<JoinOrganizationResponse>> JoinOrganization([FromRoute] string code)
    {
        return await inviteLinkService.JoinOrganizationAsync(code);
    }
}
