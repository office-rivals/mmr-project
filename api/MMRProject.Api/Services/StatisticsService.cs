using System.Diagnostics;
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

public class StatisticsService(ApiDbContext dbContext, ILogger<StatisticsService> logger) : IStatisticsService
{
    public async Task<IEnumerable<LeaderboardEntry>> GetLeaderboardAsync(long seasonId)
    {
        var stopwatch = Stopwatch.StartNew();

        const string sql = """
                               WITH SeasonMatches AS (
                                   SELECT id, team_one_id, team_two_id
                                   FROM matches
                                   WHERE season_id = {0}
                                     AND deleted_at IS NULL
                               ),
                               TeamOnePlayerMatches AS (
                                   SELECT
                                       t.player_one_id AS player_id,
                                       sm.id AS match_id,
                                       t.winner AS is_win
                                   FROM SeasonMatches sm
                                   INNER JOIN teams t ON sm.team_one_id = t.id
                                   WHERE t.player_one_id IS NOT NULL
                                     AND t.deleted_at IS NULL

                                   UNION ALL

                                   SELECT
                                       t.player_two_id AS player_id,
                                       sm.id AS match_id,
                                       t.winner AS is_win
                                   FROM SeasonMatches sm
                                   INNER JOIN teams t ON sm.team_one_id = t.id
                                   WHERE t.player_two_id IS NOT NULL
                                     AND t.deleted_at IS NULL
                               ),
                               TeamTwoPlayerMatches AS (
                                   SELECT
                                       t.player_one_id AS player_id,
                                       sm.id AS match_id,
                                       t.winner AS is_win
                                   FROM SeasonMatches sm
                                   INNER JOIN teams t ON sm.team_two_id = t.id
                                   WHERE t.player_one_id IS NOT NULL
                                     AND t.deleted_at IS NULL

                                   UNION ALL

                                   SELECT
                                       t.player_two_id AS player_id,
                                       sm.id AS match_id,
                                       t.winner AS is_win
                                   FROM SeasonMatches sm
                                   INNER JOIN teams t ON sm.team_two_id = t.id
                                   WHERE t.player_two_id IS NOT NULL
                                     AND t.deleted_at IS NULL
                               ),
                               AllPlayerMatches AS (
                                   SELECT * FROM TeamOnePlayerMatches
                                   UNION ALL
                                   SELECT * FROM TeamTwoPlayerMatches
                               ),
                               LatestPlayerMMR AS (
                                   SELECT DISTINCT ON (ph.player_id)
                                       ph.player_id,
                                       ph.mmr
                                   FROM player_histories ph
                                   WHERE ph.match_id IN (SELECT id FROM SeasonMatches)
                                     AND ph.deleted_at IS NULL
                                   ORDER BY ph.player_id, ph.match_id DESC
                               ),
                               OrderedPlayerMatches AS (
                                   SELECT
                                       player_id,
                                       match_id,
                                       CASE WHEN is_win THEN 1 ELSE 0 END AS is_win_int,
                                       ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY match_id DESC) AS match_seq
                                   FROM AllPlayerMatches
                               ),
                               StreakGroups AS (
                                   SELECT
                                       player_id,
                                       is_win_int,
                                       match_seq,
                                       match_seq - ROW_NUMBER() OVER (PARTITION BY player_id, is_win_int ORDER BY match_seq) AS streak_group_id
                                   FROM OrderedPlayerMatches
                               ),
                               CurrentStreaks AS (
                                   SELECT
                                       player_id,
                                       is_win_int,
                                       COUNT(*) AS streak_length
                                   FROM StreakGroups
                                   WHERE streak_group_id = (
                                       SELECT streak_group_id
                                       FROM StreakGroups sg2
                                       WHERE sg2.player_id = StreakGroups.player_id
                                         AND sg2.match_seq = 1
                                       LIMIT 1
                                   )
                                   GROUP BY player_id, is_win_int
                               )
                               SELECT
                                   p.id AS UserId,
                                   p.name AS Name,
                                   COUNT(CASE WHEN apm.is_win THEN 1 END)::int AS Wins,
                                   COUNT(CASE WHEN NOT apm.is_win THEN 1 END)::int AS Loses,
                                   COALESCE(cs.streak_length, 0)::int AS StreakLength,
                                   COALESCE(cs.is_win_int, 0)::int AS StreakTypeIsWin,
                                   lpm.mmr AS MMR
                               FROM "Players" p
                               INNER JOIN AllPlayerMatches apm ON p.id = apm.player_id
                               LEFT JOIN LatestPlayerMMR lpm ON p.id = lpm.player_id
                               LEFT JOIN CurrentStreaks cs ON p.id = cs.player_id
                               WHERE p.deleted_at IS NULL
                               GROUP BY p.id, p.name, cs.streak_length, cs.is_win_int, lpm.mmr
                               ORDER BY lpm.mmr DESC NULLS LAST
                           """;

        var leaderboardEntries = await dbContext.Database
            .SqlQueryRaw<LeaderboardQuery>(sql, seasonId)
            .ToListAsync();

        stopwatch.Stop();
        logger.LogInformation("Leaderboard query for season {SeasonId} took {ElapsedMs}ms", seasonId,
            stopwatch.ElapsedMilliseconds);

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

    public async Task<IEnumerable<PlayerHistoryDetails>> GetPlayerHistoryAsync(long seasonId, long? userId)
    {
        var query = dbContext.PlayerHistories
            .Include(x => x.Player)
            .Include(x => x.Match)
            .Where(x => x.Match!.SeasonId == seasonId);

        if (userId.HasValue)
        {
            query = query.Where(x => x.PlayerId == userId);
        }

        var playerHistories = await query
            .OrderBy(x => x.MatchId)
            .ToListAsync();

        // Count occurrences of user id in player histories
        var userIdOccurrences = playerHistories
            .Select(x => x.PlayerId)
            .WhereNotNull()
            .GroupBy(x => x)
            .ToDictionary(x => x.Key, x => x.Count());

        var filteredPlayerHistories = playerHistories
            .Where(x => x.PlayerId.HasValue && userIdOccurrences[x.PlayerId.Value] >= 10);

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