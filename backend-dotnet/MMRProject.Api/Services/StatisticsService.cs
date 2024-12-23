using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Extensions;
using MMRProject.Api.Mappers;

namespace MMRProject.Api.Services;

public interface IStatisticsService
{
    Task<IEnumerable<LeaderboardEntry>> GetLeaderboardAsync(long seasonId);
    Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistoryAsync(long seasonId, long? userId);
    Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistributionAsync();
}

public class StatisticsService(ApiDbContext dbContext, IUserService userService) : IStatisticsService
{
    public async Task<IEnumerable<LeaderboardEntry>> GetLeaderboardAsync(long seasonId)
    {
        var users = await userService.AllUsersAsync();

        var leaderboardEntries = new List<LeaderboardEntry>();
        foreach (var user in users)
        {
            var teamCounts = new TeamCounts
            {
                Wins = 0,
                Losses = 0,
                WinningStreak = 0,
                LosingStreak = 0
            };

            // TODO: Do it without a join + union, but just join with or condition
            var counts = await dbContext.Teams
                .AsNoTracking()
                .Join(dbContext.Matches,
                    team => team.Id,
                    match => match.TeamOneId,
                    (team, match) => new
                    {
                        team,
                        match
                    })
                .Union(
                    dbContext.Teams.Join(dbContext.Matches,
                        team => team.Id,
                        match => match.TeamTwoId,
                        (team, match) => new
                        {
                            team,
                            match
                        })
                )
                .Where(x => x.team.UserOneId == user.Id || x.team.UserTwoId == user.Id)
                .Where(x => x.match.SeasonId == seasonId)
                .OrderByDescending(x => x.match.Id)
                .Select(tm => new WinOrLoss(1, tm.team.Winner!.Value))
                .ToListAsync();

            teamCounts.Wins = counts.Where(x => x.IsWin).Sum(x => x.Count);
            teamCounts.Losses = counts.Where(x => !x.IsWin).Sum(x => x.Count);

            var currentStreak = CalculateStreak(counts);

            teamCounts.WinningStreak = currentStreak.isWinning ? currentStreak.Streak : 0;
            teamCounts.LosingStreak = currentStreak.isWinning ? 0 : currentStreak.Streak;

            var totalGames = teamCounts.Wins + teamCounts.Losses;
            if (totalGames == 0)
            {
                // Skip users with no matches in season
                continue;
            }

            PlayerHistory? latestPlayerHistory;
            if (totalGames < 10)
            {
                latestPlayerHistory = null;
            }
            else
            {
                latestPlayerHistory = await userService.LatestPlayerHistoryAsync(user.Id, seasonId);
            }

            var leaderboardEntry = new LeaderboardEntry
            {
                UserId = user.Id,
                Name = user.Name ?? string.Empty, // TODO: Fix this
                Wins = teamCounts.Wins,
                Loses = teamCounts.Losses,
                WinningStreak = teamCounts.WinningStreak,
                LosingStreak = teamCounts.LosingStreak,
                MMR = latestPlayerHistory?.Mmr
            };

            leaderboardEntries.Add(leaderboardEntry);
        }

        return leaderboardEntries;
    }

    private sealed record WinOrLoss(int Count, bool IsWin);

    private sealed class TeamCounts
    {
        public int Wins { get; set; }
        public int Losses { get; set; }
        public int WinningStreak { get; set; }
        public int LosingStreak { get; set; }
    }

    private static (int Streak, bool isWinning) CalculateStreak(List<WinOrLoss> winOrLosses)
    {
        if (winOrLosses.Count == 0)
        {
            return (0, true);
        }

        var firstWinOrLoss = winOrLosses.First();
        var currentStreak = firstWinOrLoss.Count;
        var isWinning = firstWinOrLoss.IsWin;
        foreach (var winOrLoss in winOrLosses.Skip(1))
        {
            if (winOrLoss.IsWin == isWinning)
            {
                currentStreak += winOrLoss.Count;
            }
            else
            {
                break;
            }
        }

        return (currentStreak, isWinning);
    }

    public async Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistoryAsync(long seasonId, long? userId)
    {
        var query = dbContext.PlayerHistories
            .Include(x => x.User)
            .Include(x => x.Match)
            .Where(x => x.Match!.SeasonId == seasonId);

        if (userId.HasValue)
        {
            query = query.Where(x => x.UserId == userId);
        }

        var playerHistories = await query
            .OrderBy(x => x.MatchId)
            .ToListAsync();

        // Count occurrences of user id in player histories
        var userIdOccurrences = playerHistories
            .Select(x => x.UserId)
            .WhereNotNull()
            .GroupBy(x => x)
            .ToDictionary(x => x.Key, x => x.Count());

        var filteredPlayerHistories = playerHistories
            .Where(x => x.UserId.HasValue && userIdOccurrences[x.UserId.Value] >= 10);

        return filteredPlayerHistories.Select(PlayerHistoryMapper.MapPlayerHistoryToPlayerHistoryDetails);
    }

    public async Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistributionAsync()
    {
        var timeStatistics = await dbContext.Database
            .SqlQueryRaw<TimeStatisticsEntry>("""
                        SELECT
                            EXTRACT(DOW FROM created_at) AS DayOfWeek, 
                            EXTRACT(HOUR FROM created_at) AS HourOfDay, 
                            COUNT(*) AS Count
                        FROM matches
                        GROUP BY DayOfWeek, HourOfDay
                        ORDER BY DayOfWeek, HourOfDay
                        """)
            .ToListAsync();

        return timeStatistics;
    }
}