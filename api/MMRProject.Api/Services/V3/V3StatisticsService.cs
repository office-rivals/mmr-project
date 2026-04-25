using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.DTOs.V3;

namespace MMRProject.Api.Services.V3;

public interface IV3StatisticsService
{
    Task<TimeDistributionResponse> GetTimeDistributionAsync(Guid orgId, Guid leagueId, Guid? seasonId);
}

public class V3StatisticsService(ApiDbContext dbContext) : IV3StatisticsService
{
    public async Task<TimeDistributionResponse> GetTimeDistributionAsync(Guid orgId, Guid leagueId, Guid? seasonId)
    {
        const string sql = """
            SELECT EXTRACT(DOW FROM played_at)::int AS DayOfWeek,
                   EXTRACT(HOUR FROM played_at)::int AS HourOfDay,
                   COUNT(*)::int AS Count
            FROM matches
            WHERE organization_id = {0}
              AND league_id = {1}
              AND ({2}::uuid IS NULL OR season_id = {2}::uuid)
            GROUP BY DayOfWeek, HourOfDay
            ORDER BY DayOfWeek, HourOfDay
        """;

        var seasonParam = seasonId.HasValue ? (object)seasonId.Value : DBNull.Value;
        var entries = await dbContext.Database
            .SqlQueryRaw<TimeDistributionEntry>(sql, orgId, leagueId, seasonParam)
            .ToListAsync();

        return new TimeDistributionResponse { Entries = entries };
    }
}
