using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/queue")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3QueueController(IV3MatchMakingService matchMakingService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<IActionResult> JoinQueue([FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        await matchMakingService.AddPlayerToQueueAsync(orgId, leagueId);
        return Ok();
    }

    [HttpDelete]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<IActionResult> LeaveQueue([FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        await matchMakingService.RemovePlayerFromQueueAsync(orgId, leagueId);
        return NoContent();
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<QueueStatusResponse>> GetQueueStatus(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await matchMakingService.GetQueueStatusAsync(orgId, leagueId);
    }
}
