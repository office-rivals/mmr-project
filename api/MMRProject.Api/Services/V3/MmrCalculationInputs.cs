using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.MMRCalculationApi.Models;

namespace MMRProject.Api.Services.V3;

/// <summary>
/// How a player's rating goes into the MMR calculation. Submitting a result and
/// predicting one both build their requests here, so a prediction rates every
/// player exactly as the result will.
/// </summary>
internal static class MmrCalculationInputs
{
    public static MMRCalculationPlayerRating PlayerRating(
        long id,
        LeaguePlayer leaguePlayer,
        IReadOnlySet<Guid> playersWithSeasonHistory) => new()
    {
        Id = id,
        Mu = leaguePlayer.Mu,
        Sigma = leaguePlayer.Sigma,
        IsPreviousSeasonRating = !playersWithSeasonHistory.Contains(leaguePlayer.Id),
    };

    public static async Task<HashSet<Guid>> LoadPlayersWithSeasonHistoryAsync(
        ApiDbContext dbContext,
        Guid seasonId,
        IReadOnlyCollection<Guid> playerIds)
    {
        if (playerIds.Count == 0) return [];

        var seasonedIds = await dbContext.RatingHistories
            .Where(rh => playerIds.Contains(rh.LeaguePlayerId))
            .Join(
                dbContext.Set<V3Match>(),
                rh => rh.MatchId,
                m => m.Id,
                (rh, m) => new { rh.LeaguePlayerId, m.SeasonId })
            .Where(x => x.SeasonId == seasonId)
            .Select(x => x.LeaguePlayerId)
            .Distinct()
            .ToListAsync();

        return [.. seasonedIds];
    }
}
