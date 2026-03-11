using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/seasons")]
[Authorize]
public class V3SeasonsController(IV3SeasonService seasonService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgOwner)]
    public async Task<ActionResult<SeasonResponse>> CreateSeason(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromBody] CreateSeasonRequest request)
    {
        var result = await seasonService.CreateSeasonAsync(orgId, leagueId, request);
        return Created($"api/v3/organizations/{orgId}/leagues/{leagueId}/seasons/{result.Id}", result);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<SeasonResponse>>> ListSeasons(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await seasonService.GetSeasonsAsync(orgId, leagueId);
    }

    [HttpGet("current")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<SeasonResponse>> GetCurrentSeason(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        var result = await seasonService.GetCurrentSeasonAsync(orgId, leagueId);
        if (result == null)
            return NotFound();
        return result;
    }
}
