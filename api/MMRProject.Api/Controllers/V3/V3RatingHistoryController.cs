using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/rating-history")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3RatingHistoryController(IV3RatingHistoryService ratingHistoryService) : ControllerBase
{
    [HttpGet("{leaguePlayerId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<RatingHistoryResponse>> GetPlayerHistory(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId,
        [FromRoute] Guid leaguePlayerId, [FromQuery] Guid? seasonId)
    {
        return await ratingHistoryService.GetPlayerHistoryAsync(orgId, leagueId, leaguePlayerId, seasonId);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<LeagueRatingHistoryResponse>> GetLeagueHistory(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromQuery] Guid? seasonId)
    {
        return await ratingHistoryService.GetLeagueHistoryAsync(orgId, leagueId, seasonId);
    }
}
