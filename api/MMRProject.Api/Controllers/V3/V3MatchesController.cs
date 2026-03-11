using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/matches")]
[Authorize]
public class V3MatchesController(IV3MatchesService matchesService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MatchResponse>> SubmitMatch(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromBody] SubmitMatchRequest request)
    {
        var result = await matchesService.SubmitMatchAsync(orgId, leagueId, request);
        return Created($"api/v3/organizations/{orgId}/leagues/{leagueId}/matches/{result.Id}", result);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<MatchResponse>>> GetMatches(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId,
        [FromQuery] Guid? seasonId, [FromQuery] int limit = 50, [FromQuery] int offset = 0)
    {
        return await matchesService.GetMatchesAsync(orgId, leagueId, seasonId, limit, offset);
    }

    [HttpGet("{matchId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MatchResponse>> GetMatch(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid matchId)
    {
        return await matchesService.GetMatchAsync(orgId, leagueId, matchId);
    }

    [HttpDelete("{matchId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<IActionResult> DeleteMatch(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid matchId)
    {
        await matchesService.DeleteMatchAsync(orgId, leagueId, matchId);
        return NoContent();
    }
}
