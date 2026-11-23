using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/match-predictions")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3MatchPredictionsController(IV3MatchMakingService matchMakingService) : ControllerBase
{
    /// <summary>
    /// The win chance and each player's MMR at stake for the chosen found or
    /// live matches, by pending match id (repeat <c>pendingMatchId</c>).
    /// </summary>
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<IReadOnlyList<MatchPredictionResponse>>> GetMatchPredictions(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId,
        [FromQuery(Name = "pendingMatchId")] List<Guid> pendingMatchIds)
    {
        return Ok(await matchMakingService.GetMatchPredictionsAsync(orgId, leagueId, pendingMatchIds));
    }
}
