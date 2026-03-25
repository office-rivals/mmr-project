using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.V3;

public interface IV3RatingHistoryService
{
    Task<RatingHistoryResponse> GetPlayerHistoryAsync(Guid orgId, Guid leagueId, Guid leaguePlayerId, Guid? seasonId);
}

public class V3RatingHistoryService(ApiDbContext dbContext) : IV3RatingHistoryService
{
    public async Task<RatingHistoryResponse> GetPlayerHistoryAsync(Guid orgId, Guid leagueId, Guid leaguePlayerId, Guid? seasonId)
    {
        var playerExists = await dbContext.Set<LeaguePlayer>()
            .AnyAsync(lp => lp.OrganizationId == orgId && lp.LeagueId == leagueId && lp.Id == leaguePlayerId);

        if (!playerExists)
            throw new NotFoundException("League player not found");

        var query = dbContext.Set<RatingHistory>()
            .Include(rh => rh.Match)
            .Where(rh => rh.OrganizationId == orgId && rh.LeaguePlayerId == leaguePlayerId);

        if (seasonId.HasValue)
            query = query.Where(rh => rh.Match.SeasonId == seasonId.Value);

        var histories = await query
            .OrderBy(rh => rh.Match.RecordedAt)
            .Select(rh => new RatingHistoryEntryResponse
            {
                MatchId = rh.MatchId,
                Mmr = rh.Mmr,
                Mu = rh.Mu,
                Sigma = rh.Sigma,
                Delta = rh.Delta,
                RecordedAt = rh.Match.RecordedAt,
            })
            .ToListAsync();

        return new RatingHistoryResponse { Entries = histories };
    }
}
