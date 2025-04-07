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
        var currentSeason = await dbContext.Seasons
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        return currentSeason?.Id;
    }

    public async Task<IEnumerable<Season>> GetAllSeasonsAsync()
    {
        return await dbContext.Seasons
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();
    }
}
