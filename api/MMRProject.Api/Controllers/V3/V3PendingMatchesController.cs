using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/pending-matches")]
[Authorize]
public class V3PendingMatchesController(IV3MatchMakingService matchMakingService) : ControllerBase
{
    [HttpGet("{pendingMatchId:guid}")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<ActionResult<PendingMatchResponse>> GetPendingMatchStatus(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid pendingMatchId)
    {
        return await matchMakingService.GetPendingMatchStatusAsync(orgId, leagueId, pendingMatchId);
    }

    [HttpPost("{pendingMatchId:guid}/accept")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<IActionResult> AcceptPendingMatch(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid pendingMatchId)
    {
        await matchMakingService.AcceptPendingMatchAsync(orgId, leagueId, pendingMatchId);
        return Ok();
    }

    [HttpPost("{pendingMatchId:guid}/decline")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireOrgMember)]
    public async Task<IActionResult> DeclinePendingMatch(
        [FromRoute] Guid orgId, [FromRoute] Guid leagueId, [FromRoute] Guid pendingMatchId)
    {
        await matchMakingService.DeclinePendingMatchAsync(orgId, leagueId, pendingMatchId);
        return Ok();
    }
}
