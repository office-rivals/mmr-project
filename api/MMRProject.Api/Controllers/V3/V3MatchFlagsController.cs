using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/match-flags")]
[Authorize]
public class V3MatchFlagsController(IV3MatchFlagService matchFlagService) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MatchFlagResponse>> CreateFlag(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromBody] CreateMatchFlagRequest request)
    {
        var result = await matchFlagService.CreateFlagAsync(orgId, leagueId, request);
        return Created($"api/v3/organizations/{orgId}/leagues/{leagueId}/admin/match-flags/{result.Id}", result);
    }

    [HttpGet]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<MatchFlagResponse>>> ListFlags(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromQuery] MatchFlagStatus? status)
    {
        return await matchFlagService.GetFlagsAsync(orgId, leagueId, status);
    }

    [HttpGet("me")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<List<MatchFlagResponse>>> GetMyFlags(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId)
    {
        return await matchFlagService.GetMyFlagsAsync(orgId, leagueId);
    }

    [HttpPut("{flagId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<MatchFlagResponse>> UpdateFlagReason(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid flagId,
        [FromBody] UpdateMatchFlagReasonRequest request)
    {
        return await matchFlagService.UpdateFlagReasonAsync(orgId, leagueId, flagId, request);
    }

    [HttpDelete("{flagId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult> DeleteFlag(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid flagId)
    {
        await matchFlagService.DeleteFlagAsync(orgId, leagueId, flagId);
        return NoContent();
    }
}
