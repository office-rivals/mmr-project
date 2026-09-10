using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Controllers.V3;

[ApiController]
[ApiExplorerSettings(GroupName = "v3")]
[Route("api/v3/organizations/{orgId:guid}/leagues/{leagueId:guid}/matchmaking")]
[Authorize]
[Authorize(Policy = V3AuthorizationPolicies.RequirePatWrite)]
public class V3MatchMakingController(IV3MatchMakingService matchMakingService) : ControllerBase
{
    [HttpPost("rfid")]
    [Authorize(Policy = V3AuthorizationPolicies.RequireLeagueAccess)]
    public async Task<ActionResult<List<int>>> GenerateRfidTeamAssignment(
        [FromRoute] Guid orgId,
        [FromRoute] Guid leagueId,
        [FromBody] RfidTeamAssignmentRequest request
    )
    {
        return await matchMakingService.GenerateRfidTeamAssignmentAsync(orgId, leagueId, request);
    }
}
