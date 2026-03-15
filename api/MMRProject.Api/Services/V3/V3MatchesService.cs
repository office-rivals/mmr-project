using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.MMRCalculationApi.Models;


namespace MMRProject.Api.Services.V3;

public interface IV3MatchesService
{
    Task<MatchResponse> SubmitMatchAsync(Guid orgId, Guid leagueId, SubmitMatchRequest request,
        MatchSource source = MatchSource.Manual);
    Task<List<MatchResponse>> GetMatchesAsync(Guid orgId, Guid leagueId, Guid? seasonId, int limit = 50, int offset = 0);
    Task<MatchResponse> GetMatchAsync(Guid orgId, Guid leagueId, Guid matchId);
    Task DeleteMatchAsync(Guid orgId, Guid leagueId, Guid matchId);
}

public class V3MatchesService(
    ApiDbContext dbContext,
    IMMRCalculationApiClient mmrCalculationApiClient,
    IOrganizationService organizationService,
    IV3SeasonService seasonService,
    ILogger<V3MatchesService> logger) : IV3MatchesService
{
    public async Task<MatchResponse> SubmitMatchAsync(Guid orgId, Guid leagueId, SubmitMatchRequest request,
        MatchSource source = MatchSource.Manual)
    {
        var currentSeason = await seasonService.GetCurrentSeasonAsync(orgId, leagueId)
            ?? throw new InvalidArgumentException("No active season found for this league");

        var membershipId = await organizationService.GetCurrentMembershipIdAsync(orgId);

        var allPlayerIds = request.Teams.SelectMany(t => t.Players).ToList();
        var uniquePlayerIds = allPlayerIds.Distinct().ToList();
        if (uniquePlayerIds.Count != allPlayerIds.Count)
            throw new InvalidArgumentException("Players must be unique across all teams");

        var leaguePlayers = await dbContext.Set<LeaguePlayer>()
            .Where(lp => lp.OrganizationId == orgId && lp.LeagueId == leagueId && uniquePlayerIds.Contains(lp.Id))
            .ToListAsync();

        if (leaguePlayers.Count != uniquePlayerIds.Count)
            throw new InvalidArgumentException("Not all players were found in this league");

        var now = DateTimeOffset.UtcNow;
        var match = new V3Match
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            SeasonId = currentSeason.Id,
            Source = source,
            CreatedByMembershipId = membershipId,
            PlayedAt = now,
            RecordedAt = now,
        };

        var maxScore = request.Teams.Max(t => t.Score);
        var winnerCount = request.Teams.Count(t => t.Score == maxScore);

        for (var teamIndex = 0; teamIndex < request.Teams.Count; teamIndex++)
        {
            var teamRequest = request.Teams[teamIndex];
            var isWinner = winnerCount == 1 && teamRequest.Score == maxScore;

            var matchTeam = new MatchTeam
            {
                OrganizationId = orgId,
                LeagueId = leagueId,
                Index = teamIndex,
                Score = teamRequest.Score,
                IsWinner = isWinner,
            };

            for (var playerIndex = 0; playerIndex < teamRequest.Players.Count; playerIndex++)
            {
                matchTeam.Players.Add(new MatchTeamPlayer
                {
                    OrganizationId = orgId,
                    LeagueId = leagueId,
                    LeaguePlayerId = teamRequest.Players[playerIndex],
                    Index = playerIndex,
                });
            }

            match.Teams.Add(matchTeam);
        }

        dbContext.Set<V3Match>().Add(match);
        await dbContext.SaveChangesAsync();

        await CalculateAndApplyMmr(orgId, match, leaguePlayers);

        return await LoadAndMapMatch(orgId, leagueId, match.Id);
    }

    public async Task<List<MatchResponse>> GetMatchesAsync(Guid orgId, Guid leagueId, Guid? seasonId, int limit = 50, int offset = 0)
    {
        var query = dbContext.Set<V3Match>()
            .AsNoTracking()
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
                    .ThenInclude(p => p.LeaguePlayer)
                        .ThenInclude(lp => lp.OrganizationMembership)
            .Where(m => m.OrganizationId == orgId && m.LeagueId == leagueId);

        if (seasonId.HasValue)
            query = query.Where(m => m.SeasonId == seasonId.Value);

        var matches = await query
            .OrderByDescending(m => m.PlayedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync();

        var matchIds = matches.Select(m => m.Id).ToList();
        var ratingHistories = await dbContext.Set<RatingHistory>()
            .Where(rh => matchIds.Contains(rh.MatchId))
            .ToListAsync();

        var ratingHistoryByMatch = ratingHistories
            .GroupBy(rh => rh.MatchId)
            .ToDictionary(g => g.Key, g => g.ToDictionary(rh => rh.LeaguePlayerId));

        return matches.Select(m => MapToResponse(m, ratingHistoryByMatch.GetValueOrDefault(m.Id))).ToList();
    }

    public async Task<MatchResponse> GetMatchAsync(Guid orgId, Guid leagueId, Guid matchId)
    {
        return await LoadAndMapMatch(orgId, leagueId, matchId);
    }

    public async Task DeleteMatchAsync(Guid orgId, Guid leagueId, Guid matchId)
    {
        var match = await dbContext.Set<V3Match>()
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId && m.LeagueId == leagueId && m.Id == matchId);

        if (match == null)
            throw new NotFoundException("Match not found");

        var ratingHistories = await dbContext.RatingHistories
            .Where(rh => rh.MatchId == matchId)
            .ToListAsync();
        dbContext.RatingHistories.RemoveRange(ratingHistories);

        foreach (var team in match.Teams)
        {
            dbContext.Set<MatchTeamPlayer>().RemoveRange(team.Players);
        }
        dbContext.Set<MatchTeam>().RemoveRange(match.Teams);
        dbContext.Set<V3Match>().Remove(match);
        await dbContext.SaveChangesAsync();
    }

    private async Task<MatchResponse> LoadAndMapMatch(Guid orgId, Guid leagueId, Guid matchId)
    {
        var match = await dbContext.Set<V3Match>()
            .Include(m => m.Teams)
                .ThenInclude(t => t.Players)
                    .ThenInclude(p => p.LeaguePlayer)
                        .ThenInclude(lp => lp.OrganizationMembership)
            .FirstOrDefaultAsync(m => m.OrganizationId == orgId && m.LeagueId == leagueId && m.Id == matchId);

        if (match == null)
            throw new NotFoundException("Match not found");

        var ratingHistories = await dbContext.Set<RatingHistory>()
            .Where(rh => rh.MatchId == matchId)
            .ToDictionaryAsync(rh => rh.LeaguePlayerId);

        return MapToResponse(match, ratingHistories);
    }

    private async Task CalculateAndApplyMmr(Guid orgId, V3Match match, List<LeaguePlayer> leaguePlayers)
    {
        var playerMap = leaguePlayers.ToDictionary(lp => lp.Id);

        // The MMR calculation API uses long IDs, so we create a mapping
        var guidToIndex = new Dictionary<Guid, long>();
        var indexToGuid = new Dictionary<long, Guid>();
        long index = 1;
        foreach (var player in leaguePlayers)
        {
            guidToIndex[player.Id] = index;
            indexToGuid[index] = player.Id;
            index++;
        }

        var teams = match.Teams.OrderBy(t => t.Index).ToList();
        if (teams.Count != 2)
        {
            logger.LogWarning("Match {MatchId} has {TeamCount} teams, skipping MMR calculation (requires exactly 2)", match.Id, teams.Count);
            return;
        }

        var mmrRequest = new MMRCalculationRequest
        {
            Team1 = new MMRCalculationTeam
            {
                Score = teams[0].Score,
                Players = teams[0].Players.Select(p =>
                {
                    var lp = playerMap[p.LeaguePlayerId];
                    return new MMRCalculationPlayerRating
                    {
                        Id = guidToIndex[p.LeaguePlayerId],
                        Mu = lp.Mu,
                        Sigma = lp.Sigma,
                    };
                }),
            },
            Team2 = new MMRCalculationTeam
            {
                Score = teams[1].Score,
                Players = teams[1].Players.Select(p =>
                {
                    var lp = playerMap[p.LeaguePlayerId];
                    return new MMRCalculationPlayerRating
                    {
                        Id = guidToIndex[p.LeaguePlayerId],
                        Mu = lp.Mu,
                        Sigma = lp.Sigma,
                    };
                }),
            },
        };

        MMRCalculationResponse mmrResponse;
        try
        {
            mmrResponse = await mmrCalculationApiClient.CalculateMMRAsync(mmrRequest);
        }
        catch (Exception e)
        {
            logger.LogCritical(e, "Failed to calculate MMR for match {MatchId}", match.Id);
            throw;
        }

        var playerResults = mmrResponse.Team1.Players
            .Concat(mmrResponse.Team2.Players)
            .ToDictionary(r => indexToGuid[r.Id]);

        foreach (var (leaguePlayerId, result) in playerResults)
        {
            var leaguePlayer = playerMap[leaguePlayerId];
            var previousMmr = leaguePlayer.Mmr;
            var delta = result.MMR - previousMmr;

            var ratingHistory = new RatingHistory
            {
                OrganizationId = orgId,
                LeaguePlayerId = leaguePlayerId,
                MatchId = match.Id,
                Mmr = result.MMR,
                Mu = result.Mu,
                Sigma = result.Sigma,
                Delta = delta,
            };
            dbContext.Set<RatingHistory>().Add(ratingHistory);

            leaguePlayer.Mmr = result.MMR;
            leaguePlayer.Mu = result.Mu;
            leaguePlayer.Sigma = result.Sigma;
        }

        await dbContext.SaveChangesAsync();
    }

    private static MatchResponse MapToResponse(V3Match match, Dictionary<Guid, RatingHistory>? ratingHistories)
    {
        return new MatchResponse
        {
            Id = match.Id,
            LeagueId = match.LeagueId,
            SeasonId = match.SeasonId,
            Source = match.Source,
            PlayedAt = match.PlayedAt,
            RecordedAt = match.RecordedAt,
            CreatedAt = match.CreatedAt,
            Teams = match.Teams.OrderBy(t => t.Index).Select(t => new MatchTeamResponse
            {
                Id = t.Id,
                Index = t.Index,
                Score = t.Score,
                IsWinner = t.IsWinner,
                Players = t.Players.OrderBy(p => p.Index).Select(p => new MatchTeamPlayerResponse
                {
                    Id = p.Id,
                    LeaguePlayerId = p.LeaguePlayerId,
                    DisplayName = p.LeaguePlayer?.OrganizationMembership?.DisplayName,
                    Username = p.LeaguePlayer?.OrganizationMembership?.Username,
                    Index = p.Index,
                    RatingDelta = ratingHistories?.GetValueOrDefault(p.LeaguePlayerId)?.Delta,
                }).ToList(),
            }).ToList(),
        };
    }
}
