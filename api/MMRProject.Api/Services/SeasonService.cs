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
    public async Task<long?> CurrentSeasonIdAsync()
    {
        var now = DateTime.UtcNow;
        var currentSeason = await dbContext.Seasons
            .Where(x => x.StartsAt <= now && (x.EndsAt == null || x.EndsAt > now))
            .OrderByDescending(x => x.StartsAt)
            .FirstOrDefaultAsync();

        currentSeason ??= await dbContext.Seasons
            .OrderByDescending(x => x.StartsAt ?? x.CreatedAt)
            .FirstOrDefaultAsync();

        return currentSeason?.Id;
    }

    public async Task<IEnumerable<Season>> GetAllSeasonsAsync()
    {
        return await dbContext.Seasons
            .OrderByDescending(x => x.StartsAt ?? x.CreatedAt)
            .ToListAsync();
    }
}
