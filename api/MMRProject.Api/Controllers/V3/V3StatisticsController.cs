using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/statistics")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3StatisticsController(IV3StatisticsService statisticsService) : ControllerBase
{
    [HttpGet("time-distribution")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<TimeDistributionResponse>> GetTimeDistribution(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromQuery] Guid? seasonId)
    {
        return await statisticsService.GetTimeDistributionAsync(orgId, leagueId, seasonId);
    }
}
