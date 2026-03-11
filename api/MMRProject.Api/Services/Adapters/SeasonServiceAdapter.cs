using MMRProject.Api.Data.Entities;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Services.Adapters;

public class SeasonServiceAdapter(
    ILegacyContextResolver contextResolver,
    ILegacyIdResolver idResolver,
    IV3SeasonService seasonService) : ISeasonService
{
    public async Task<long?> CurrentSeasonIdAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var season = await seasonService.GetCurrentSeasonAsync(orgId, leagueId);

        if (season == null)
            return null;

        return await idResolver.ResolveLegacySeasonIdAsync(season.Id);
    }

    public async Task<IEnumerable<Season>> GetAllSeasonsAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var seasons = await seasonService.GetSeasonsAsync(orgId, leagueId);

        var result = new List<Season>();
        foreach (var s in seasons)
        {
            long legacyId;
            try
            {
                legacyId = await idResolver.ResolveLegacySeasonIdAsync(s.Id);
            }
            catch
            {
                continue;
            }

            result.Add(new Season
            {
                Id = legacyId,
                StartsAt = s.StartsAt,
                CreatedAt = s.CreatedAt.UtcDateTime,
            });
        }

        return result;
    }
}
