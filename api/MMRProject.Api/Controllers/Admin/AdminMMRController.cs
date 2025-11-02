using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Authorization;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers.Admin;

[ApiController]
[Route("api/v1/admin/mmr")]
[Authorize(Policy = AuthorizationPolicies.RequireModeratorRole)]
public class AdminMMRController(
    ISeasonService seasonService,
    IMatchesService matchesService
) : ControllerBase
{
    [HttpPost("recalculate")]
    public async Task<IActionResult> RecalculateMMR([FromQuery] long? fromMatchId)
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