using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;

namespace MMRProject.Api.Services.V3;

/// <summary>
/// A player's first matches of each season place them. Until they have played
/// <see cref="MatchCount"/>, nobody sees their MMR or how it moves.
/// </summary>
public static class Placement
{
    public const int MatchCount = 10;

    /// <summary>Matches each player has played in the season; players without any are left out.</summary>
    public static async Task<Dictionary<Guid, int>> LoadSeasonMatchCountsAsync(
        ApiDbContext dbContext,
        Guid seasonId,
        IReadOnlyCollection<Guid> playerIds)
    {
        if (playerIds.Count == 0) return [];

        return await dbContext.MatchTeamPlayers
            .Where(p => playerIds.Contains(p.LeaguePlayerId) && p.MatchTeam.Match.SeasonId == seasonId)
            .GroupBy(p => p.LeaguePlayerId)
            .Select(g => new { LeaguePlayerId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.LeaguePlayerId, x => x.Count);
    }
}
