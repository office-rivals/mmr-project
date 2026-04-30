using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Services;

public interface ISeasonService
{
    Task<long?> CurrentSeasonIdAsync();
    Task<IEnumerable<Season>> GetAllSeasonsAsync();
    Task<Season?> GetSeasonByIdAsync(long id);
    Task<Season> CreateSeasonAsync(DateTimeOffset? startsAt);
}

public class SeasonService(ApiDbContext dbContext) : ISeasonService
{
    private long? _cachedCurrentSeasonId;

    public async Task<long?> CurrentSeasonIdAsync()
    {
        if (_cachedCurrentSeasonId.HasValue)
        {
            return _cachedCurrentSeasonId;
        }

        var now = DateTimeOffset.UtcNow;
        var currentSeason = await dbContext.Seasons
            .Where(x => x.StartsAt <= now)
            .OrderByDescending(x => x.StartsAt)
            .FirstOrDefaultAsync();

        _cachedCurrentSeasonId = currentSeason?.Id;
        return currentSeason?.Id;
    }

    public async Task<IEnumerable<Season>> GetAllSeasonsAsync()
    {
        var now = DateTimeOffset.UtcNow;
        return await dbContext.Seasons
            .Where(x => x.StartsAt <= now)
            .OrderByDescending(x => x.StartsAt)
            .ToListAsync();
    }

    public async Task<Season?> GetSeasonByIdAsync(long id)
    {
        return await dbContext.Seasons.FirstOrDefaultAsync(s => s.Id == id);
    }

    public async Task<Season> CreateSeasonAsync(DateTimeOffset? startsAt)
    {
        var season = new Season
        {
            StartsAt = startsAt ?? DateTimeOffset.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        dbContext.Seasons.Add(season);
        await dbContext.SaveChangesAsync();

        return season;
    }
}