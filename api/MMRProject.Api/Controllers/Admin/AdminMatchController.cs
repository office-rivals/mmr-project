using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.DTOs;
using MMRProject.Api.Mappers;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/matches")]
[Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
public class AdminMatchController(
    IMatchesService matchesService
) : ControllerBase
{
    [HttpPut("{matchId}")]
    public async Task<ActionResult<MatchDetailsV2>> UpdateMatch([FromRoute] long matchId, [FromBody] UpdateMatchRequest request)
    {
        var match = await matchesService.UpdateMatch(matchId, request);
        var matchDetails = MatchMapper.MapMatchToMatchDetails(match);
        if (matchDetails is null)
        {
            return Problem("Match could not be returned");
        }
        return matchDetails;
    }

    [HttpDelete("{matchId}")]
    public async Task<IActionResult> DeleteMatch([FromRoute] long matchId)
    {
        await matchesService.DeleteMatch(matchId);
        return NoContent();
    }
}
