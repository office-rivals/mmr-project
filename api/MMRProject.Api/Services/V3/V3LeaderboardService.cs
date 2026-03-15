using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;

namespace MMRProject.Api.Services.V3;

public interface IV3LeaderboardService
{
    Task<LeaderboardResponse> GetLeaderboardAsync(Guid orgId, Guid leagueId, Guid? seasonId);
}

public class V3LeaderboardService(ApiDbContext dbContext) : IV3LeaderboardService
{
    public async Task<LeaderboardResponse> GetLeaderboardAsync(Guid orgId, Guid leagueId, Guid? seasonId)
    {
        List<LeaderboardEntryResponse> entries;

        if (seasonId.HasValue)
        {
            entries = await GetSeasonLeaderboardAsync(orgId, leagueId, seasonId.Value);
        }
        else
        {
            entries = await GetAllTimeLeaderboardAsync(orgId, leagueId);
        }

        return new LeaderboardResponse { Entries = entries };
    }

    private async Task<List<LeaderboardEntryResponse>> GetAllTimeLeaderboardAsync(Guid orgId, Guid leagueId)
    {
        var players = await dbContext.Set<LeaguePlayer>()
            .AsNoTracking()
            .Include(lp => lp.OrganizationMembership)
            .Where(lp => lp.OrganizationId == orgId && lp.LeagueId == leagueId)
            .OrderByDescending(lp => lp.Mmr)
            .ToListAsync();

        return AssignRanks(players.Select(lp => new LeaderboardEntryResponse
        {
            LeaguePlayerId = lp.Id,
            DisplayName = lp.OrganizationMembership.DisplayName,
            Username = lp.OrganizationMembership.Username,
            Mmr = lp.Mmr,
            Mu = lp.Mu,
            Sigma = lp.Sigma,
            Rank = 0,
        }).ToList());
    }

    private async Task<List<LeaderboardEntryResponse>> GetSeasonLeaderboardAsync(Guid orgId, Guid leagueId, Guid seasonId)
    {
        // Get the latest rating history per player for matches in this season
        var playerRatings = await dbContext.Set<RatingHistory>()
            .AsNoTracking()
            .Include(rh => rh.LeaguePlayer)
                .ThenInclude(lp => lp.OrganizationMembership)
            .Include(rh => rh.Match)
            .Where(rh => rh.OrganizationId == orgId
                && rh.LeaguePlayer.LeagueId == leagueId
                && rh.Match.SeasonId == seasonId)
            .GroupBy(rh => rh.LeaguePlayerId)
            .Select(g => g.OrderByDescending(rh => rh.Match.PlayedAt).First())
            .ToListAsync();

        var entries = playerRatings
            .OrderByDescending(rh => rh.Mmr)
            .Select(rh => new LeaderboardEntryResponse
            {
                LeaguePlayerId = rh.LeaguePlayerId,
                DisplayName = rh.LeaguePlayer.OrganizationMembership.DisplayName,
                Username = rh.LeaguePlayer.OrganizationMembership.Username,
                Mmr = rh.Mmr,
                Mu = rh.Mu,
                Sigma = rh.Sigma,
                Rank = 0,
            })
            .ToList();

        return AssignRanks(entries);
    }

    private static List<LeaderboardEntryResponse> AssignRanks(List<LeaderboardEntryResponse> entries)
    {
        var rank = 1;
        for (var i = 0; i < entries.Count; i++)
        {
            if (i > 0 && entries[i].Mmr < entries[i - 1].Mmr)
                rank = i + 1;

            entries[i] = entries[i] with { Rank = rank };
        }

        return entries;
    }
}
