using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.V3;

public interface IV3SeasonService
{
    Task<SeasonResponse> CreateSeasonAsync(Guid orgId, Guid leagueId, CreateSeasonRequest request);
    Task<List<SeasonResponse>> GetSeasonsAsync(Guid orgId, Guid leagueId);
    Task<SeasonResponse?> GetCurrentSeasonAsync(Guid orgId, Guid leagueId);
    Task<SeasonResponse> GetSeasonAsync(Guid orgId, Guid leagueId, Guid seasonId);
}

public class V3SeasonService(ApiDbContext dbContext) : IV3SeasonService
{
    public async Task<SeasonResponse> CreateSeasonAsync(Guid orgId, Guid leagueId, CreateSeasonRequest request)
    {
        await EnsureLeagueExists(orgId, leagueId);

        var season = new V3Season
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            StartsAt = request.StartsAt,
        };

        dbContext.Set<V3Season>().Add(season);
        await dbContext.SaveChangesAsync();

        return MapToResponse(season);
    }

    public async Task<List<SeasonResponse>> GetSeasonsAsync(Guid orgId, Guid leagueId)
    {
        await EnsureLeagueExists(orgId, leagueId);

        var seasons = await dbContext.Set<V3Season>()
            .Where(s => s.OrganizationId == orgId && s.LeagueId == leagueId)
            .OrderByDescending(s => s.StartsAt)
            .ToListAsync();

        return seasons.Select(MapToResponse).ToList();
    }

    public async Task<SeasonResponse?> GetCurrentSeasonAsync(Guid orgId, Guid leagueId)
    {
        await EnsureLeagueExists(orgId, leagueId);

        var now = DateTimeOffset.UtcNow;
        var season = await dbContext.Set<V3Season>()
            .Where(s => s.OrganizationId == orgId && s.LeagueId == leagueId && s.StartsAt <= now)
            .OrderByDescending(s => s.StartsAt)
            .FirstOrDefaultAsync();

        return season != null ? MapToResponse(season) : null;
    }

    public async Task<SeasonResponse> GetSeasonAsync(Guid orgId, Guid leagueId, Guid seasonId)
    {
        var season = await dbContext.Set<V3Season>()
            .FirstOrDefaultAsync(s => s.OrganizationId == orgId && s.LeagueId == leagueId && s.Id == seasonId);

        if (season == null)
            throw new NotFoundException("Season not found");

        return MapToResponse(season);
    }

    private async Task EnsureLeagueExists(Guid orgId, Guid leagueId)
    {
        var exists = await dbContext.Set<League>()
            .AnyAsync(l => l.OrganizationId == orgId && l.Id == leagueId);

        if (!exists)
            throw new NotFoundException("League not found");
    }

    private static SeasonResponse MapToResponse(V3Season season)
    {
        return new SeasonResponse
        {
            Id = season.Id,
            LeagueId = season.LeagueId,
            StartsAt = season.StartsAt,
            CreatedAt = season.CreatedAt,
        };
    }
}
