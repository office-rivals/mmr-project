using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Services.Adapters;

public class MatchesServiceAdapter(
    ILegacyContextResolver contextResolver,
    ILegacyIdResolver idResolver,
    IV3MatchesService matchesService) : IMatchesService
{
    public async Task<IEnumerable<Match>> GetMatchesForSeason(long seasonId, int limit, int offset,
        bool orderByCreatedAtDescending, bool includeMmrCalculations, long? userId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var v3SeasonId = await idResolver.ResolveSeasonIdAsync(seasonId);

        var matches = await matchesService.GetMatchesAsync(orgId, leagueId, v3SeasonId, limit, offset);

        var result = new List<Match>();
        foreach (var m in matches)
        {
            var match = await MapToLegacyMatch(m, includeMmrCalculations);
            if (match == null) continue;

            if (userId.HasValue)
            {
                var playerIds = m.Teams
                    .SelectMany(t => t.Players)
                    .Select(p => p.LeaguePlayerId)
                    .ToList();

                var hasPlayer = false;
                foreach (var pid in playerIds)
                {
                    try
                    {
                        var legacyPid = await idResolver.ResolveLegacyPlayerIdAsync(pid);
                        if (legacyPid == userId.Value)
                        {
                            hasPlayer = true;
                            break;
                        }
                    }
                    catch
                    {
                        // Skip players without legacy IDs
                    }
                }

                if (!hasPlayer) continue;
            }

            result.Add(match);
        }

        return result;
    }

    public async Task SubmitMatch(long seasonId, SubmitMatchV2Request request)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();

        var player1 = await idResolver.ResolvePlayerIdAsync(request.Team1.Member1);
        var player2 = await idResolver.ResolvePlayerIdAsync(request.Team1.Member2);
        var player3 = await idResolver.ResolvePlayerIdAsync(request.Team2.Member1);
        var player4 = await idResolver.ResolvePlayerIdAsync(request.Team2.Member2);

        var submitRequest = new DTOs.V3.SubmitMatchRequest
        {
            Teams =
            [
                new DTOs.V3.SubmitMatchTeamRequest
                {
                    Players = [player1, player2],
                    Score = request.Team1.Score,
                },
                new DTOs.V3.SubmitMatchTeamRequest
                {
                    Players = [player3, player4],
                    Score = request.Team2.Score,
                },
            ],
        };

        await matchesService.SubmitMatchAsync(orgId, leagueId, submitRequest);
    }

    public async Task RecalculateMMRForMatchesInSeason(long seasonId, long? fromMatchId)
    {
        // Not supported in v3 adapter - recalculation is handled differently
        throw new NotSupportedException("MMR recalculation is not supported through the legacy adapter");
    }

    public async Task<Match> UpdateMatch(long matchId, UpdateMatchRequest request)
    {
        // V3 does not support match updates through the legacy interface
        throw new NotSupportedException("Match updates are not supported through the legacy adapter");
    }

    public async Task<int> GetMatchCountForCurrentSeasonAsync()
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var matches = await matchesService.GetMatchesAsync(orgId, leagueId, null, int.MaxValue, 0);
        return matches.Count;
    }

    public async Task DeleteMatch(long matchId)
    {
        var (orgId, leagueId) = await contextResolver.ResolveContextAsync();
        var v3MatchId = await idResolver.ResolveMatchIdAsync(matchId);
        await matchesService.DeleteMatchAsync(orgId, leagueId, v3MatchId);
    }

    private async Task<Match?> MapToLegacyMatch(DTOs.V3.MatchResponse m, bool includeMmrCalculations)
    {
        long legacyMatchId;
        try
        {
            legacyMatchId = await idResolver.ResolveLegacyMatchIdAsync(m.Id);
        }
        catch
        {
            return null;
        }

        long legacySeasonId;
        try
        {
            legacySeasonId = await idResolver.ResolveLegacySeasonIdAsync(m.SeasonId);
        }
        catch
        {
            return null;
        }

        var teams = m.Teams.OrderBy(t => t.Index).ToList();
        if (teams.Count < 2) return null;

        var team1Players = teams[0].Players.OrderBy(p => p.Index).ToList();
        var team2Players = teams[1].Players.OrderBy(p => p.Index).ToList();
        if (team1Players.Count < 2 || team2Players.Count < 2) return null;

        long t1p1, t1p2, t2p1, t2p2;
        try
        {
            t1p1 = await idResolver.ResolveLegacyPlayerIdAsync(team1Players[0].LeaguePlayerId);
            t1p2 = await idResolver.ResolveLegacyPlayerIdAsync(team1Players[1].LeaguePlayerId);
            t2p1 = await idResolver.ResolveLegacyPlayerIdAsync(team2Players[0].LeaguePlayerId);
            t2p2 = await idResolver.ResolveLegacyPlayerIdAsync(team2Players[1].LeaguePlayerId);
        }
        catch
        {
            return null;
        }

        var match = new Match
        {
            Id = legacyMatchId,
            SeasonId = legacySeasonId,
            CreatedAt = m.CreatedAt.UtcDateTime,
            TeamOne = new Team
            {
                PlayerOneId = t1p1,
                PlayerTwoId = t1p2,
                Score = teams[0].Score,
                Winner = teams[0].IsWinner,
            },
            TeamTwo = new Team
            {
                PlayerOneId = t2p1,
                PlayerTwoId = t2p2,
                Score = teams[1].Score,
                Winner = teams[1].IsWinner,
            },
        };

        if (includeMmrCalculations)
        {
            match.MmrCalculations.Add(new MmrCalculation
            {
                MatchId = legacyMatchId,
                TeamOnePlayerOneMmrDelta = team1Players[0].RatingDelta,
                TeamOnePlayerTwoMmrDelta = team1Players[1].RatingDelta,
                TeamTwoPlayerOneMmrDelta = team2Players[0].RatingDelta,
                TeamTwoPlayerTwoMmrDelta = team2Players[1].RatingDelta,
            });
        }

        return match;
    }
}
