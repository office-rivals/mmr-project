using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.DTOs;
using MMRProject.Api.Extensions;
using MMRProject.Api.Mappers;

namespace MMRProject.Api.Services;

public interface IStatisticsService
{
    Task<IEnumerable<LeaderboardEntry>> GetLeaderboardAsync(long seasonId);
    Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistoryAsync(long seasonId, long? userId);
    Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistributionAsync(long seasonId);
}

public class StatisticsService(ApiDbContext dbContext, IUserService userService) : IStatisticsService
{
    public async Task<IEnumerable<LeaderboardEntry>> GetLeaderboardAsync(long seasonId)
    {
        var sql = """
                      WITH MatchResults AS (
                          SELECT
                              u.Id AS UserId,
                              u.Name,
                              m.Id AS MatchId,
                              CASE
                                  WHEN t.Winner = true THEN 1
                                  ELSE 0
                              END AS IsWin,
                              ROW_NUMBER() OVER (PARTITION BY u.Id ORDER BY m.Id DESC) AS RowNum
                          FROM users u
                          LEFT JOIN teams t ON u.Id = t.user_one_id OR u.Id = t.user_two_id
                          LEFT JOIN matches m ON t.Id = m.team_one_id OR t.Id = m.team_two_id
                          WHERE m.season_id = {0}
                      ),
                      Streaks AS (
                          SELECT
                              UserId,
                              Name,
                              IsWin,
                              RowNum,
                              ROW_NUMBER() OVER (PARTITION BY UserId ORDER BY RowNum) -
                              ROW_NUMBER() OVER (PARTITION BY UserId, IsWin ORDER BY RowNum) AS StreakGroup
                          FROM MatchResults
                      ),
                      CurrentStreak AS (
                          SELECT
                              UserId,
                              Name,
                              COUNT(*) AS StreakLength,
                              IsWin
                          FROM Streaks
                          WHERE StreakGroup = (
                              SELECT StreakGroup
                              FROM Streaks
                              WHERE RowNum = 1 AND UserId = Streaks.UserId
                              LIMIT 1
                          )
                          GROUP BY UserId, Name, IsWin
                      )
                      SELECT
                          u.Id AS UserId,
                          u.Name,
                          SUM(CASE WHEN t.Winner = true AND m.season_id = {0} THEN 1 ELSE 0 END) AS Wins,
                          SUM(CASE WHEN t.Winner = false AND m.season_id = {0} THEN 1 ELSE 0 END) AS Loses,
                          COALESCE(cs.StreakLength, 0) AS StreakLength,
                          cs.IsWin AS StreakTypeIsWin,
                          (
                              SELECT ph.Mmr
                              FROM player_histories ph
                              LEFT JOIN matches m ON ph.match_id = m.id
                              WHERE ph.user_id = u.id AND m.season_id = {0}
                              ORDER BY ph.match_id DESC
                              LIMIT 1
                          ) AS MMR
                      FROM users u
                      LEFT JOIN teams t ON u.Id = t.user_one_id OR u.Id = t.user_two_id
                      LEFT JOIN matches m ON t.Id = m.team_one_id OR t.Id = m.team_two_id
                      LEFT JOIN CurrentStreak cs ON u.Id = cs.UserId
                      GROUP BY u.Id, u.Name, cs.StreakLength, cs.IsWin
                      HAVING SUM(CASE WHEN t.Winner = true AND m.season_id = {0} THEN 1 ELSE 0 END) +
                             SUM(CASE WHEN t.Winner = false AND m.season_id = {0} THEN 1 ELSE 0 END) > 0
                  """;

        var leaderboardEntries = await dbContext.Database
            .SqlQueryRaw<LeaderboardQuery>(sql, seasonId)
            .ToListAsync();

        return leaderboardEntries
            .Select(x => new LeaderboardEntry
            {
                UserId = x.UserId,
                Name = x.Name,
                Wins = x.Wins,
                Loses = x.Loses,
                WinningStreak = x.StreakTypeIsWin == 1 ? x.StreakLength : 0,
                LosingStreak = x.StreakTypeIsWin == 0 ? x.StreakLength : 0,
                MMR = x.Wins + x.Loses >= 10 ? x.MMR : null
            });
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

    public async Task<IEnumerable<TimeStatisticsEntry>> GetTimeDistributionAsync(long seasonId)
    {
        var timeStatistics = await dbContext.Database
            .SqlQueryRaw<TimeStatisticsEntry>("""
                                              SELECT
                                                  EXTRACT(DOW FROM created_at) AS DayOfWeek, 
                                                  EXTRACT(HOUR FROM created_at) AS HourOfDay, 
                                                  COUNT(*) AS Count
                                              FROM matches
                                              WHERE season_id = {0}
                                              GROUP BY DayOfWeek, HourOfDay
                                              ORDER BY DayOfWeek, HourOfDay
                                              """, seasonId)
            .ToListAsync();

        return timeStatistics;
    }

    private record LeaderboardQuery
    {
        public required long UserId { get; set; }
        public required string Name { get; set; }
        public long? MMR { get; set; }
        public int Wins { get; set; }
        public int Loses { get; set; }
        public int StreakLength { get; set; }
        public int StreakTypeIsWin { get; set; }
    }
}
