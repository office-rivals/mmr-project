using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.MMRCalculationApi.Models;

namespace MMRProject.Api.Services.V3;

public interface IV3MatchPredictionService
{
    /// <summary>
    /// Predicts matches that have not been played yet, keyed by pending match
    /// id. A match is missing from the result when it cannot be predicted.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, MatchPredictionResponse>> PredictAsync(
        Guid orgId,
        Guid leagueId,
        IReadOnlyCollection<V3PendingMatch> matches);
}

public class V3MatchPredictionService(
    ApiDbContext dbContext,
    IV3SeasonService seasonService,
    IMMRCalculationApiClient mmrCalculationApiClient,
    IMemoryCache cache,
    ILogger<V3MatchPredictionService> logger) : IV3MatchPredictionService
{
    // Queue and active-match polls ask every few seconds, so the MMR API's
    // answer is cached on the exact request: it stays valid while nobody's
    // rating changes, and any change is a different request.
    private static readonly TimeSpan CacheLifetime = TimeSpan.FromMinutes(15);

    // A failing MMR API must not hold up the match it decorates, nor be asked
    // again by every poll while it is down.
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(3);
    private static readonly TimeSpan FailureBackoff = TimeSpan.FromSeconds(30);

    public async Task<IReadOnlyDictionary<Guid, MatchPredictionResponse>> PredictAsync(
        Guid orgId,
        Guid leagueId,
        IReadOnlyCollection<V3PendingMatch> matches)
    {
        var predictions = new Dictionary<Guid, MatchPredictionResponse>();
        if (matches.Count == 0) return predictions;

        // Submitting a result rates it in the current season; with none there
        // is no result to predict.
        var season = await seasonService.GetCurrentSeasonAsync(orgId, leagueId);
        if (season is null) return predictions;

        var playerIds = matches
            .SelectMany(m => m.Teams)
            .SelectMany(t => t.Players)
            .Select(p => p.LeaguePlayerId)
            .Distinct()
            .ToList();
        var playersWithSeasonHistory =
            await MmrCalculationInputs.LoadPlayersWithSeasonHistoryAsync(dbContext, season.Id, playerIds);

        foreach (var match in matches)
        {
            var prediction = await PredictMatchAsync(match, playersWithSeasonHistory);
            if (prediction is not null)
            {
                predictions[match.Id] = prediction;
            }
        }

        return predictions;
    }

    private async Task<MatchPredictionResponse?> PredictMatchAsync(
        V3PendingMatch match,
        HashSet<Guid> playersWithSeasonHistory)
    {
        // Mirrors how a submitted result is numbered and split into two teams.
        var teams = match.Teams.OrderBy(t => t.Index).ToList();
        if (teams.Count != 2) return null;

        var playersById = new Dictionary<long, LeaguePlayer>();
        MMRPredictionTeam BuildTeam(PendingMatchTeam team) => new()
        {
            Players = team.Players.OrderBy(p => p.Index).Select(p =>
            {
                var id = playersById.Count + 1L;
                playersById[id] = p.LeaguePlayer;
                return MmrCalculationInputs.PlayerRating(id, p.LeaguePlayer, playersWithSeasonHistory);
            }).ToList(),
        };
        var request = new MMRPredictionRequest { Team1 = BuildTeam(teams[0]), Team2 = BuildTeam(teams[1]) };

        var response = await GetPredictionAsync(match.Id, request);
        if (response is null) return null;

        var players = response.Team1.Players.Concat(response.Team2.Players).ToList();
        if (players.Count != playersById.Count || players.Any(p => !playersById.ContainsKey(p.Id)))
        {
            logger.LogWarning("MMR prediction for pending match {PendingMatchId} did not match its players",
                match.Id);
            return null;
        }

        TeamPredictionResponse MapTeam(PendingMatchTeam team, MMRTeamPrediction result) => new()
        {
            Index = team.Index,
            WinChance = result.WinChance,
            Players = result.Players.Select(p =>
            {
                var leaguePlayer = playersById[p.Id];
                return new PlayerPredictionResponse
                {
                    LeaguePlayerId = leaguePlayer.Id,
                    // A submission diffs the result against the stored MMR, except
                    // on a first match of the season, which starts from the reset.
                    Mmr = playersWithSeasonHistory.Contains(leaguePlayer.Id) ? leaguePlayer.Mmr : p.Mmr,
                    MmrIfWin = p.MmrIfWin,
                    MmrIfLose = p.MmrIfLose,
                };
            }).ToList(),
        };

        return new MatchPredictionResponse
        {
            Teams = [MapTeam(teams[0], response.Team1), MapTeam(teams[1], response.Team2)],
        };
    }

    private async Task<MMRPredictionResponse?> GetPredictionAsync(Guid pendingMatchId, MMRPredictionRequest request)
    {
        var cacheKey = $"mmr-prediction:{JsonSerializer.Serialize(request)}";
        if (cache.TryGetValue(cacheKey, out MMRPredictionResponse? cached))
        {
            return cached;
        }

        try
        {
            using var timeout = new CancellationTokenSource(RequestTimeout);
            var response = await mmrCalculationApiClient.PredictMatchAsync(request, timeout.Token);
            cache.Set(cacheKey, response, new MemoryCacheEntryOptions { SlidingExpiration = CacheLifetime });
            return response;
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Could not predict pending match {PendingMatchId}; serving it without a prediction",
                pendingMatchId);
            cache.Set<MMRPredictionResponse?>(cacheKey, null, FailureBackoff);
            return null;
        }
    }
}
