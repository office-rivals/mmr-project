using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Extensions;
using MMRProject.Api.Mappers;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v2/mmr/matches")]
public class MMRV2Controller(
    ILogger<MMRV2Controller> logger,
    ISeasonService seasonService,
    IMatchesService matchesService
) : ControllerBase
{
    [HttpGet]
    public async Task<IEnumerable<MatchDetailsV2>> GetMatches([FromQuery] long? userId, [FromQuery] long? seasonId = null, [FromQuery] int limit = 100,
        [FromQuery] int offset = 0)
    {
        var targetSeasonId = seasonId ?? await seasonService.CurrentSeasonIdAsync();
        if (!targetSeasonId.HasValue)
        {
            logger.LogInformation("No target season ID provided and no current season found");
            return [];
        }

        var matches =
            await matchesService.GetMatchesForSeason(targetSeasonId.Value, limit, offset, true, true, userId);

        return matches.Select(MatchMapper.MapMatchToMatchDetails).WhereNotNull();
    }

    [HttpPost]
    public async Task<IActionResult> SubmitMatch([FromBody, Required] SubmitMatchV2Request request)
    {
        var currentSeasonId = await seasonService.CurrentSeasonIdAsync();
        if (!currentSeasonId.HasValue)
        {
            logger.LogInformation("No season has been created");
            return BadRequest("No current season");
        }

        await matchesService.SubmitMatch(currentSeasonId.Value, request);
        return Created();
    }
}
