using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/admin/seasons")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3AdminSeasonsController(IV3SeasonService seasonService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<List<SeasonResponse>>> ListAllSeasons(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await seasonService.GetSeasonsAsync(orgId, leagueId, includeUpcoming: true);
    }
}
