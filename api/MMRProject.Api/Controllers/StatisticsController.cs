using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/stats")]
public class StatisticsController(IStatisticsService statisticsService, ISeasonService seasonService) : ControllerBase
{
    [HttpGet("leaderboard")]
    public async Task<IEnumerable<LeaderboardEntry>> GetLeaderboard([FromQuery, Description("Season ID (defaults to current season)")] long? seasonId = null)
    {
        var targetSeason = seasonId ?? await seasonService.CurrentSeasonIdAsync();

        if (targetSeason is null)
        {
            return [];
        }

        return await statisticsService.GetLeaderboardAsync(targetSeason.Value);
    }

    [HttpGet("player-history")]
    public async Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistory(
        [FromQuery] long? userId,
        [FromQuery, Description("Season ID (defaults to current season)")] long? seasonId = null)
    {
        var targetSeason = seasonId ?? await seasonService.CurrentSeasonIdAsync();

        if (targetSeason is null)
        {
            return [];
        }

        return await statisticsService.GetPlayerHistoryAsync(targetSeason.Value, userId);
    }

    [HttpGet("time-distribution")]
    public async Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistribution([FromQuery, Description("Season ID (defaults to current season)")] long? seasonId = null)
    {
        var targetSeason = seasonId ?? await seasonService.CurrentSeasonIdAsync();

        if (targetSeason is null)
        {
            return [];
        }

        return await statisticsService.GetTimeDistributionAsync(targetSeason.Value);
    }
}
