using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/active-matches")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3ActiveMatchesController(IV3MatchMakingService matchMakingService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<IEnumerable<ActiveMatchResponse>>> ListActiveMatches(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return Ok(await matchMakingService.GetActiveMatchesAsync(orgId, leagueId));
    }

    [HttpDelete("{activeMatchId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<IActionResult> CancelActiveMatch(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid activeMatchId)
    {
        await matchMakingService.CancelActiveMatchAsync(orgId, leagueId, activeMatchId);
        return NoContent();
    }

    [HttpPost("{activeMatchId:guid}/submit")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<MatchResponse>> SubmitResult(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid activeMatchId,
        [FromBody] SubmitActiveMatchResultRequest request)
    {
        return await matchMakingService.SubmitActiveMatchResultAsync(orgId, leagueId, activeMatchId, request);
    }
}
