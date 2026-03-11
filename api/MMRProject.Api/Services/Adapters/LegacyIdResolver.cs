using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.Adapters;

public interface ILegacyIdResolver
{
    Task<Guid> ResolvePlayerIdAsync(long legacyId);
    Task<Guid> ResolveSeasonIdAsync(long legacyId);
    Task<Guid> ResolveMatchIdAsync(long legacyId);
    Task<long> ResolveLegacyPlayerIdAsync(Guid v3Id);
    Task<long> ResolveLegacySeasonIdAsync(Guid v3Id);
    Task<long> ResolveLegacyMatchIdAsync(Guid v3Id);
}

public class LegacyIdResolver(ApiDbContext dbContext) : ILegacyIdResolver
{
    public async Task<Guid> ResolvePlayerIdAsync(long legacyId)
    {
        var player = await dbContext.LeaguePlayers
            .FirstOrDefaultAsync(lp => lp.LegacyPlayerId == legacyId);

        if (player == null)
            throw new NotFoundException($"No v3 player found for legacy ID {legacyId}");

        return player.Id;
    }

    public async Task<Guid> ResolveSeasonIdAsync(long legacyId)
    {
        var season = await dbContext.V3Seasons
            .FirstOrDefaultAsync(s => s.LegacySeasonId == legacyId);

        if (season == null)
            throw new NotFoundException($"No v3 season found for legacy ID {legacyId}");

        return season.Id;
    }

    public async Task<Guid> ResolveMatchIdAsync(long legacyId)
    {
        var match = await dbContext.V3Matches
            .FirstOrDefaultAsync(m => m.LegacyMatchId == legacyId);

        if (match == null)
            throw new NotFoundException($"No v3 match found for legacy ID {legacyId}");

        return match.Id;
    }

    public async Task<long> ResolveLegacyPlayerIdAsync(Guid v3Id)
    {
        var player = await dbContext.LeaguePlayers
            .FirstOrDefaultAsync(lp => lp.Id == v3Id);

        if (player?.LegacyPlayerId == null)
            throw new NotFoundException($"No legacy player ID found for v3 ID {v3Id}");

        return player.LegacyPlayerId.Value;
    }

    public async Task<long> ResolveLegacySeasonIdAsync(Guid v3Id)
    {
        var season = await dbContext.V3Seasons
            .FirstOrDefaultAsync(s => s.Id == v3Id);

        if (season?.LegacySeasonId == null)
            throw new NotFoundException($"No legacy season ID found for v3 ID {v3Id}");

        return season.LegacySeasonId.Value;
    }

    public async Task<long> ResolveLegacyMatchIdAsync(Guid v3Id)
    {
        var match = await dbContext.V3Matches
            .FirstOrDefaultAsync(m => m.Id == v3Id);

        if (match?.LegacyMatchId == null)
            throw new NotFoundException($"No legacy match ID found for v3 ID {v3Id}");

        return match.LegacyMatchId.Value;
    }
}
