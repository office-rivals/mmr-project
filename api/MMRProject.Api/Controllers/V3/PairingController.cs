using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/pairing")]
[Authorize]
public class PairingController(IPairingService pairingService) : ControllerBase
{
    [HttpPost("code")]
    [Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
    public async Task<ActionResult<PairingCodeResponse>> IssuePairingCode()
    {
        return await pairingService.IssuePairingCodeAsync();
    }

    [HttpGet("tags")]
    [Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
    public async Task<ActionResult<List<RfidTagResponse>>> ListTags()
    {
        return await pairingService.ListTagsAsync();
    }

    [HttpDelete("tags/{tagId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.DenyPatAuthentication)]
    public async Task<IActionResult> UnlinkTag(Guid tagId)
    {
        await pairingService.UnlinkTagAsync(tagId);
        return NoContent();
    }

    [HttpPost("submit")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    public async Task<ActionResult<PairingSubmitResponse>> SubmitPairing(PairingSubmitRequest request)
    {
        return await pairingService.SubmitPairingAsync(request);
    }
}
