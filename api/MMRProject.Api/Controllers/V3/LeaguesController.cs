using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class LeaguesController(ILeagueService leagueService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<LeagueResponse>> CreateLeague(
        [FromRoute] Guid orgId, [FromBody] CreateLeagueRequest request)
    {
        var result = await leagueService.CreateLeagueAsync(orgId, request);
        return Created($"api/v3/organizations/{orgId}/leagues/{result.Id}", result);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<LeagueResponse>>> ListLeagues([FromRoute] Guid orgId)
    {
        return await leagueService.ListLeaguesAsync(orgId);
    }

    [HttpGet("{leagueId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<LeagueResponse>> GetLeague(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await leagueService.GetLeagueAsync(orgId, leagueId);
    }

    [HttpPatch("{leagueId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<LeagueResponse>> UpdateLeague(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromBody] UpdateLeagueRequest request)
    {
        return await leagueService.UpdateLeagueAsync(orgId, leagueId, request);
    }
}
