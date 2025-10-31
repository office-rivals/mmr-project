using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
public class AdminController(
    ISeasonService seasonService,
    IMatchesService matchesService
) : ControllerBase
{
    [HttpPost("recalculate")]
    public async Task<IActionResult> RecalculateMatches([FromQuery] long? fromMatchId)
    {
        var currentSeasonId = await seasonService.CurrentSeasonIdAsync();
        if (!currentSeasonId.HasValue)
        {
            return BadRequest("No current season");
        }

        await matchesService.RecalculateMMRForMatchesInSeason(currentSeasonId.Value, fromMatchId);
        return Ok();
    }
}