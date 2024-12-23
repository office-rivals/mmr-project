using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[AllowAnonymous]
public class AdminController(
    ISeasonService seasonService,
    IMatchesService matchesService,
    IConfiguration configuration
) : ControllerBase
{
    [HttpPost("recalculate")]
    public async Task<IActionResult> RecalculateMatches(
        [FromQuery] long? fromMatchId,
        [FromHeader(Name = "X-API-KEY")] string apiKey
    )
    {
        // TODO: Improve performance of this - it is very slow because we call MMR calculation API for each match
        var adminKey = configuration["Admin:Secret"];
        if (string.IsNullOrWhiteSpace(adminKey))
        {
            throw new Exception("An error occurred");
        }

        if (apiKey != adminKey)
        {
            return BadRequest("Wrong API key");
        }

        var currentSeasonId = await seasonService.CurrentSeasonIdAsync();
        if (!currentSeasonId.HasValue)
        {
            return BadRequest("No current season");
        }

        await matchesService.RecalculateMMRForMatchesInSeason(currentSeasonId.Value, fromMatchId);
        return Ok();
    }
}