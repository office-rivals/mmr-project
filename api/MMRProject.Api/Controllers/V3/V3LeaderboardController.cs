using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/leaderboard")]
[Authorize]
public class V3LeaderboardController(IV3LeaderboardService leaderboardService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<LeaderboardResponse>> GetLeaderboard(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromQuery] Guid? seasonId)
    {
        return await leaderboardService.GetLeaderboardAsync(orgId, leagueId, seasonId);
    }
}
