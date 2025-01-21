using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Exceptions;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.MMRCalculationApi.Models;

namespace MMRProject.Api.Services;

public interface IMatchesService
{
    Task<IEnumerable<Match>> GetMatchesForSeason(long seasonId, int limit, int offset, bool orderByCreatedAtDescending,
        bool includeMmrCalculations, long? userId);

    Task SubmitMatch(long seasonId, SubmitMatchV2Request request);

    Task RecalculateMMRForMatchesInSeason(long seasonId, long? fromMatchId = null);
}

public class MatchesService(
    ApiDbContext dbContext,
    IUserService userService,
    IMMRCalculationApiClient mmrCalculationApiClient,
    ILogger<MatchesService> logger) : IMatchesService
{
    public async Task<IEnumerable<Match>> GetMatchesForSeason(long seasonId, int limit, int offset,
        bool orderByCreatedAtDescending,
        bool includeMmrCalculations, long? userId)
    {
        var query = dbContext.Matches
            .Include(x => x.TeamOne)
            .Include(x => x.TeamTwo)
            .Where(x => x.SeasonId == seasonId);

        if (includeMmrCalculations)
        {
            query = query.Include(x => x.MmrCalculations);
        }

        if (orderByCreatedAtDescending)
        {
            query = query.OrderByDescending(x => x.CreatedAt);
        }
        else
        {
            query = query.OrderBy(x => x.CreatedAt);
        }

        if (userId.HasValue)
        {
            query = query.Where(x => x.TeamOne!.UserOneId == userId || x.TeamOne.UserTwoId == userId ||
                                     x.TeamTwo!.UserOneId == userId || x.TeamTwo.UserTwoId == userId);
        }

        return await query.Skip(offset).Take(limit).ToListAsync();
    }

    public async Task SubmitMatch(long seasonId, SubmitMatchV2Request request)
    {
        var uniquePlayers = new HashSet<long>
        {
            request.Team1.Member1,
            request.Team1.Member2,
            request.Team2.Member1,
            request.Team2.Member2
        };

        if (uniquePlayers.Count != 4)
        {
            throw new InvalidArgumentException("Players must be unique");
        }

        var exists = await CheckExistingMatch(request.Team1.Member1, request.Team1.Member2, request.Team2.Member1,
            request.Team2.Member2, request.Team1.Score, request.Team2.Score);
        if (exists)
        {
            throw new InvalidArgumentException("Match already exists");
        }

        var players = await dbContext.Users.Where(x => uniquePlayers.Contains(x.Id)).ToListAsync();

        if (players.Count != uniquePlayers.Count)
        {
            throw new InvalidArgumentException("Not all players were found");
        }

        var match = await CreateMatch(seasonId, request.Team1.Member1, request.Team1.Member2, request.Team2.Member1,
            request.Team2.Member2, request.Team1.Score, request.Team2.Score);

        // TODO: Handle that this fails
        await CalculateMMR(seasonId, match);
    }

    private async Task CalculateMMR(long seasonId, Match match)
    {
        var teamOnePlayerOne = await PlayerRatingForUserAsync(match.TeamOne!.UserOneId!.Value, seasonId);
        var teamOnePlayerTwo = await PlayerRatingForUserAsync(match.TeamOne!.UserTwoId!.Value, seasonId);
        var teamTwoPlayerOne = await PlayerRatingForUserAsync(match.TeamTwo!.UserOneId!.Value, seasonId);
        var teamTwoPlayerTwo = await PlayerRatingForUserAsync(match.TeamTwo!.UserTwoId!.Value, seasonId);

        var mmrCalculationRequest = new MMRCalculationRequest
        {
            Team1 = new MMRCalculationTeam
            {
                Score = (int)match.TeamOne!.Score!, // TODO: Fix this
                Players =
                [
                    teamOnePlayerOne.Rating,
                    teamOnePlayerTwo.Rating
                ]
            },
            Team2 = new MMRCalculationTeam
            {
                Score = (int)match.TeamTwo!.Score!,
                Players =
                [
                    teamTwoPlayerOne.Rating,
                    teamTwoPlayerTwo.Rating
                ]
            }
        };

        MMRCalculationResponse mmrCalculationResponse;
        try
        {
            mmrCalculationResponse = await mmrCalculationApiClient.CalculateMMRAsync(mmrCalculationRequest);
        }
        catch (Exception e)
        {
            logger.LogCritical(e, "Failed to calculate MMR for match {MatchId}", match.Id);
            // TODO: Handle this better
            throw;
        }

        // TODO: Maybe through services?
        var playerResults = mmrCalculationResponse.Team1.Players
            .Concat(mmrCalculationResponse.Team2.Players)
            .ToDictionary(x => x.Id);

        var playerHistories = playerResults.Values.Select(playerResult => new PlayerHistory
        {
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            UserId = playerResult.Id,
            MatchId = match.Id,
            Mmr = playerResult.MMR,
            Mu = playerResult.Mu,
            Sigma = playerResult.Sigma
        });

        await dbContext.PlayerHistories.AddRangeAsync(playerHistories);

        await dbContext.MmrCalculations.AddAsync(new MmrCalculation
        {
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            MatchId = match.Id,
            TeamOnePlayerOneMmrDelta = MMRDeltaForPlayer(teamOnePlayerOne.Rating.Id,
                teamOnePlayerOne.History, teamOnePlayerOne.isCurrentSeason, playerResults),
            TeamOnePlayerTwoMmrDelta = MMRDeltaForPlayer(teamOnePlayerTwo.Rating.Id,
                teamOnePlayerTwo.History, teamOnePlayerTwo.isCurrentSeason, playerResults),
            TeamTwoPlayerOneMmrDelta = MMRDeltaForPlayer(teamTwoPlayerOne.Rating.Id,
                teamTwoPlayerOne.History, teamTwoPlayerOne.isCurrentSeason, playerResults),
            TeamTwoPlayerTwoMmrDelta = MMRDeltaForPlayer(teamTwoPlayerTwo.Rating.Id,
                teamTwoPlayerTwo.History, teamTwoPlayerTwo.isCurrentSeason, playerResults)
        });

        await dbContext.SaveChangesAsync();
    }

    private int? MMRDeltaForPlayer(long playerId,
        PlayerHistory? currentHistory,
        bool isHistoryFromCurrentSeason,
        Dictionary<long, MMRCalculationPlayerResult> playerResults)
    {
        if (!playerResults.TryGetValue(playerId, out var playerResult))
        {
            logger.LogCritical("Failed to find MMR for player {PlayerId}", playerId);
            return null;
        }
        
        if (!isHistoryFromCurrentSeason)
        {
            // If the player's history is not from the current season, then use 0 as the delta
            return 0;
        }

        // If there is no current MMR, then use 0 as the delta
        return currentHistory?.Mmr is not null ? playerResult.MMR - (int)currentHistory.Mmr.Value : 0;
    }

    private async Task<(PlayerHistory? History, bool isCurrentSeason, MMRCalculationPlayerRating Rating)> PlayerRatingForUserAsync(
        long userId,
        long seasonId)
    {
        var playerHistoryResult = await userService.LatestPlayerHistoryAsync(userId);
        
        var isCurrentSeason = playerHistoryResult?.seasonId == seasonId;

        return (playerHistoryResult?.history, isCurrentSeason, new MMRCalculationPlayerRating
        {
            Id = userId,
            Mu = playerHistoryResult?.history.Mu,
            Sigma = playerHistoryResult?.history.Sigma,
            // TODO: This breaks if we are calculating for a different season than the most current one
            IsPreviousSeasonRating = playerHistoryResult == null ? null : !isCurrentSeason,
        });
    }

    private async Task<bool> CheckExistingMatch(long playerOneId, long playerTwoId, long playerThreeId,
        long playerFourId, int teamOneScore, int teamTwoScore)
    {
        // TODO: Validate this is the correct logic
        var exists = await dbContext.Matches
            .AsNoTracking()
            .Where(m => m.CreatedAt > DateTime.UtcNow.AddMinutes(-10))
            .Where(m =>
                (
                    (m.TeamOne!.UserOneId == playerOneId || m.TeamOne.UserTwoId == playerOneId) &&
                    (m.TeamOne.UserOneId == playerTwoId || m.TeamOne.UserTwoId == playerTwoId) &&
                    m.TeamOne.Score == teamOneScore &&
                    (m.TeamTwo!.UserOneId == playerThreeId || m.TeamTwo.UserTwoId == playerThreeId) &&
                    (m.TeamTwo.UserOneId == playerFourId || m.TeamTwo.UserTwoId == playerFourId) &&
                    m.TeamTwo.Score == teamTwoScore
                ) ||
                (
                    (m.TeamOne.UserOneId == playerThreeId || m.TeamOne.UserTwoId == playerThreeId) &&
                    (m.TeamOne.UserOneId == playerFourId || m.TeamOne.UserTwoId == playerFourId) &&
                    m.TeamOne.Score == teamTwoScore &&
                    (m.TeamTwo!.UserOneId == playerOneId || m.TeamTwo.UserTwoId == playerOneId) &&
                    (m.TeamTwo.UserOneId == playerTwoId || m.TeamTwo.UserTwoId == playerTwoId) &&
                    m.TeamTwo.Score == teamOneScore
                )
            )
            .Select(m => m.Id)
            .AnyAsync();

        return exists;
    }

    private async Task<Match> CreateMatch(long seasonId, long teamOnePlayerOneId, long teamOnePlayerTwoId,
        long teamTwoPlayerOneId,
        long teamTwoPlayerTwoId, int teamOneScore, int teamTwoScore)
    {
        var match = new Match
        {
            SeasonId = seasonId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            TeamOne = await CreateTeam(teamOnePlayerOneId, teamOnePlayerTwoId, teamOneScore,
                teamOneScore > teamTwoScore),
            TeamTwo = await CreateTeam(teamTwoPlayerOneId, teamTwoPlayerTwoId, teamTwoScore,
                teamTwoScore > teamOneScore)
        };

        await dbContext.Matches.AddAsync(match);
        await dbContext.SaveChangesAsync();

        return match;

        async Task<Team> CreateTeam(long userOneId, long userTwoId, int score, bool isWinner)
        {
            var team = new Team
            {
                UserOneId = userOneId,
                UserTwoId = userTwoId,
                Score = score,
                Winner = isWinner,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await dbContext.Teams.AddAsync(team);

            return team;
        }
    }

    public async Task RecalculateMMRForMatchesInSeason(long seasonId, long? fromMatchId)
    {
        var latestSeason = await dbContext.Seasons.OrderByDescending(x => x.Id).FirstOrDefaultAsync();
        if (latestSeason?.Id != seasonId)
        {
            // TODO: Maybe improve this?
            throw new Exception("Only latest season can be recalculated");
        }
        
        await ClearMMRCalculations(seasonId, fromMatchId);

        var matchesQuery = dbContext.Matches
            .Include(x => x.TeamOne)
            .Include(x => x.TeamTwo)
            .Where(x => x.SeasonId == seasonId);

        if (fromMatchId.HasValue)
        {
            matchesQuery = matchesQuery.Where(x => x.Id >= fromMatchId.Value);
        }

        var matches = await matchesQuery.ToListAsync();

        foreach (var match in matches)
        {
            await CalculateMMR(seasonId, match);
        }
    }

    private async Task ClearMMRCalculations(long seasonId, long? fromMatchId)
    {
        var playerHistoryQuery = dbContext.PlayerHistories.Where(x => x.Match!.SeasonId == seasonId);
        if (fromMatchId.HasValue)
        {
            playerHistoryQuery = playerHistoryQuery.Where(x => x.MatchId >= fromMatchId.Value);
        }

        var playerHistories = await playerHistoryQuery.ToListAsync();
        foreach (var playerHistory in playerHistories)
        {
            playerHistory.DeletedAt = DateTime.UtcNow;
        }

        var mmrCalculationsQuery = dbContext.MmrCalculations.Where(x => x.Match!.SeasonId == seasonId);
        if (fromMatchId.HasValue)
        {
            mmrCalculationsQuery = mmrCalculationsQuery.Where(x => x.MatchId >= fromMatchId.Value);
        }

        var calculations = await mmrCalculationsQuery.ToListAsync();
        foreach (var mmrCalculation in calculations)
        {
            mmrCalculation.DeletedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync();
    }
}