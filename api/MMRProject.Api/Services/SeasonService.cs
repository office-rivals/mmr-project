using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Services;

public interface ISeasonService
{
    Task<long?> CurrentSeasonIdAsync();
    Task<IEnumerable<Season>> GetAllSeasonsAsync();
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

        currentSeason ??= await dbContext.Seasons
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync();

        _cachedCurrentSeasonId = currentSeason?.Id;
        return currentSeason?.Id;
    }

    public async Task<IEnumerable<Season>> GetAllSeasonsAsync()
    {
        return await dbContext.Seasons
            .OrderByDescending(x => x.StartsAt ?? x.CreatedAt)
            .ToListAsync();
    }
}
