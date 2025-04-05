using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;

namespace MMRProject.Api.Services;

public interface ISeasonService
{
    Task<long?> CurrentSeasonIdAsync();
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
}