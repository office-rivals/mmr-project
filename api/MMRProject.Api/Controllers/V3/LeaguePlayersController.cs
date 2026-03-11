using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/players")]
[Authorize]
public class LeaguePlayersController(ILeaguePlayerService leaguePlayerService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<LeaguePlayerResponse>> JoinLeague(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        var result = await leaguePlayerService.JoinLeagueAsync(orgId, leagueId);
        return Created($"api/v3/organizations/{orgId}/leagues/{leagueId}/players/{result.Id}", result);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<LeaguePlayerResponse>>> ListPlayers(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await leaguePlayerService.GetLeaguePlayersAsync(orgId, leagueId);
    }

    [HttpGet("me")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<LeaguePlayerResponse>> GetMe(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        var result = await leaguePlayerService.GetMeAsync(orgId, leagueId);
        if (result == null)
            return NotFound();
        return result;
    }

    [HttpGet("{playerId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<LeaguePlayerResponse>> GetPlayer(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid playerId)
    {
        return await leaguePlayerService.GetLeaguePlayerAsync(orgId, leagueId, playerId);
    }
}
