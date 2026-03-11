using MMRProject.Api.DTOs;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Services.Adapters;

public class StatisticsServiceAdapter(
    ILegacyContextResolver contextResolver,
    ILegacyIdResolver idResolver,
    IV3LeaderboardService leaderboardService,
    IV3RatingHistoryService ratingHistoryService) : IStatisticsService
{
    public async Task<IEnumerable<LeaderboardEntry>> GetLeaderboardAsync(long seasonId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var v3SeasonId = await idResolver.ResolveSeasonIdAsync(seasonId);

        var leaderboard = await leaderboardService.GetLeaderboardAsync(orgId, leagueId, v3SeasonId);

        var result = new List<LeaderboardEntry>();
        foreach (var entry in leaderboard.Entries)
        {
            long legacyId;
            try
            {
                legacyId = await idResolver.ResolveLegacyPlayerIdAsync(entry.LeaguePlayerId);
            }
            catch
            {
                continue;
            }

            result.Add(new LeaderboardEntry
            {
                UserId = legacyId,
                Name = entry.DisplayName ?? entry.Username ?? $"Player {legacyId}",
                MMR = entry.Mmr,
                Wins = 0,
                Loses = 0,
                WinningStreak = 0,
                LosingStreak = 0,
            });
        }

        return result;
    }

    public async Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistoryAsync(long seasonId, long? userId)
    {
        if (!userId.HasValue)
            return [];

        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var v3SeasonId = await idResolver.ResolveSeasonIdAsync(seasonId);
        var v3PlayerId = await idResolver.ResolvePlayerIdAsync(userId.Value);

        var history = await ratingHistoryService.GetPlayerHistoryAsync(orgId, leagueId, v3PlayerId, v3SeasonId);

        var leaguePlayer = await idResolver.ResolveLegacyPlayerIdAsync(v3PlayerId);

        return history.Entries.Select(e => new PlayerHistoryDetails
        {
            UserId = leaguePlayer,
            Name = $"Player {leaguePlayer}",
            Date = e.RecordedAt,
            MMR = e.Mmr,
        });
    }

    public Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistributionAsync(long seasonId)
    {
        // Time distribution is not available through v3 adapter
        return Task.FromResult<IEnumerable<TimeStatisticsEntry>>([]);
    }
}
