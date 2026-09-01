using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3")]
[Authorize]
public class HardwareController(IHardwareService hardwareService) : ControllerBase
{
    [HttpPost("hardware/heartbeat")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatAuthentication)]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    public async Task<IActionResult> RecordHeartbeat([FromBody] HardwareHeartbeatRequest request)
    {
        await hardwareService.RecordHeartbeatAsync(request);
        return NoContent();
    }

    [HttpGet("organizations/{orgId:guid}/leagues/{leagueId:guid}/hardware")]
    [Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<List<HardwareResponse>>> List(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId)
    {
        return await hardwareService.ListAsync(orgId, leagueId);
    }
}
