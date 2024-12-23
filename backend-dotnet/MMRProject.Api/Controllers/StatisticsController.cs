using Microsoft.AspNetCore.Mvc;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services;

namespace MMRProject.Api.Controllers;

[ApiController]
[Route("api/v1/stats")]
public class StatisticsController(IStatisticsService statisticsService, ISeasonService seasonService) : ControllerBase
{
    [HttpGet("leaderboard")]
    public async Task<IEnumerable<LeaderboardEntry>> GetLeaderboard()
    {
        var currentSeason = await seasonService.CurrentSeasonIdAsync();

        if (currentSeason is null)
        {
            return [];
        }

        return await statisticsService.GetLeaderboardAsync(currentSeason.Value);
    }

    [HttpGet("player-history")]
    public async Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistory([FromQuery] long? userId)
    {
        var currentSeason = await seasonService.CurrentSeasonIdAsync();

        if (currentSeason is null)
        {
            return [];
        }

        return await statisticsService.GetPlayerHistoryAsync(currentSeason.Value, userId);
    }

    [HttpGet("time-distribution")]
    public async Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistribution()
    {
        return await statisticsService.GetTimeDistributionAsync();
    }
}