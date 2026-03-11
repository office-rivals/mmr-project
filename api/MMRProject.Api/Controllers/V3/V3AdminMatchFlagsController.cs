using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/admin/match-flags")]
[Authorize]
public class V3AdminMatchFlagsController(IV3MatchFlagService matchFlagService) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<List<MatchFlagResponse>>> ListAllFlags(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromQuery] MatchFlagStatus? status)
    {
        return await matchFlagService.GetFlagsAsync(orgId, leagueId, status);
    }

    [HttpGet("{flagId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<MatchFlagResponse>> GetFlag(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid flagId)
    {
        return await matchFlagService.GetFlagAsync(orgId, leagueId, flagId);
    }

    [HttpPatch("{flagId:guid}/resolve")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgModerator)]
    public async Task<ActionResult<MatchFlagResponse>> ResolveFlag(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid flagId,
        [FromBody] ResolveMatchFlagRequest request)
    {
        return await matchFlagService.ResolveFlagAsync(orgId, leagueId, flagId, request);
    }
}
