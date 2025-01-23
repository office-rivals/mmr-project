using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services;

public interface IMatchMakingService
{
    Task AddPlayerToQueueAsync();
    Task RemovePlayerFromQueueAsync();
    Task<MatchMakingQueueStatus> MatchMakingQueueStatusAsync();
    Task<PendingMatchStatus> PendingMatchStatusAsync(Guid matchId);
    Task AcceptPendingMatchAsync(Guid matchId);
    Task DeclinePendingMatchAsync(Guid matchId);
    Task<IEnumerable<ActiveMatchDto>> ActiveMatchesAsync();
    Task CancelActiveMatchAsync(Guid matchId);
    Task SubmitActiveMatchResultAsync(Guid matchId, ActiveMatchSubmitRequest submitRequest);
}

public class MatchMakingService(
    ILogger<MatchMakingService> logger,
    IUserContextResolver userContextResolver,
    ApiDbContext dbContext,
    IMatchesService matchesService,
    ISeasonService seasonService
) : IMatchMakingService
{
    public async Task AddPlayerToQueueAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var currentUser = await dbContext.Users
            .FirstOrDefaultAsync(x => x.IdentityUserId == identityUserId);

        if (currentUser is null)
        {
            throw new InvalidArgumentException("User not linked");
        }

        var currentQueuedPlayer = await dbContext.QueuedPlayers
            .Where(x => x.PendingMatch == null || x.PendingMatch.Status == PendingMatchStatus.Declined)
            .FirstOrDefaultAsync(x => x.UserId == currentUser.Id);

        if (currentQueuedPlayer is not null)
        {
            logger.LogInformation("User {IdentityUserId} already in queue", identityUserId);
            return;
        }

        var newPlayer = new QueuedPlayer
        {
            CreatedAt = DateTime.UtcNow,
            User = currentUser
        };

        await dbContext.QueuedPlayers.AddAsync(newPlayer);
        await dbContext.SaveChangesAsync();

        await CheckIfMatchCanBeMade();
    }

    public async Task RemovePlayerFromQueueAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var queuedPlayer = await dbContext.QueuedPlayers
            .Where(x => x.PendingMatch == null || x.PendingMatch.Status == PendingMatchStatus.Declined)
            .FirstOrDefaultAsync(x => x.User.IdentityUserId == identityUserId);

        if (queuedPlayer is null)
        {
            return;
        }

        dbContext.QueuedPlayers.Remove(queuedPlayer);
        await dbContext.SaveChangesAsync();
    }

    public async Task<MatchMakingQueueStatus> MatchMakingQueueStatusAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var totalQueuedPlayers = await dbContext.QueuedPlayers
            .Where(x => x.PendingMatch == null || x.PendingMatch.Status == PendingMatchStatus.Declined)
            .CountAsync();

        var currentUser = await dbContext.QueuedPlayers
            .Where(x => x.User.IdentityUserId == identityUserId)
            .Include(x => x.PendingMatch)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        MatchMakingQueueStatusPendingMatch? assignedPendingMatch;

        if (currentUser?.PendingMatch is { } currentPendingMatch &&
            currentPendingMatch.Status != PendingMatchStatus.Declined)
        {
            assignedPendingMatch = new MatchMakingQueueStatusPendingMatch
            {
                Id = currentPendingMatch.Id,
                Status = currentPendingMatch.Status,
                ExpiresAt = currentPendingMatch.ExpiresAt
            };
        }
        else
        {
            assignedPendingMatch = null;
        }

        return new MatchMakingQueueStatus
        {
            PlayersInQueue = totalQueuedPlayers,
            IsUserInQueue = currentUser != null,
            AssignedPendingMatch = assignedPendingMatch
        };
    }

    private async Task CheckIfMatchCanBeMade()
    {
        // TODO: Lock this check
        var queuedPlayers = await dbContext.QueuedPlayers
            .Include(x => x.User)
            .Where(x => x.PendingMatch == null || x.PendingMatch.Status == PendingMatchStatus.Declined)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();

        if (queuedPlayers.Count < 4)
        {
            return;
        }

        var pendingMatch = new PendingMatch { QueuedPlayers = queuedPlayers.Take(4).ToList() };

        await dbContext.PendingMatches.AddAsync(pendingMatch);
        await dbContext.SaveChangesAsync();

        // TODO: Add timeout to match
    }

    public async Task<PendingMatchStatus> PendingMatchStatusAsync(Guid matchId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var pendingMatch = await dbContext.PendingMatches
            .Include(pm => pm.QueuedPlayers)
            .ThenInclude(qp => qp.User)
            .Where(pm => pm.QueuedPlayers.Any(x => x.User.IdentityUserId == identityUserId))
            .FirstOrDefaultAsync(pm => pm.Id == matchId);

        if (pendingMatch is null)
        {
            throw new InvalidArgumentException("Match not found");
        }

        return pendingMatch.Status;
    }

    public async Task AcceptPendingMatchAsync(Guid matchId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var pendingMatch = await dbContext.PendingMatches
            .Include(pm => pm.QueuedPlayers)
            .ThenInclude(qp => qp.User)
            .Where(pm => pm.QueuedPlayers.Any(x => x.User.IdentityUserId == identityUserId))
            .FirstOrDefaultAsync(pm => pm.Id == matchId);

        if (pendingMatch is null)
        {
            throw new InvalidArgumentException("Match not found");
        }

        if (pendingMatch.Status != PendingMatchStatus.Pending)
        {
            throw new InvalidArgumentException("Match not pending");
        }

        var queuedPlayer = pendingMatch.QueuedPlayers.First(x => x.User.IdentityUserId == identityUserId);
        queuedPlayer.LastAcceptedMatchId = matchId;

        // TODO: Lock this check somehow
        if (pendingMatch.QueuedPlayers.All(x => x.LastAcceptedMatchId.HasValue && x.LastAcceptedMatchId == matchId))
        {
            pendingMatch.Status = PendingMatchStatus.Accepted;
        }

        pendingMatch.UpdatedAt = DateTimeOffset.UtcNow;
        // TODO: Cleanup old pending matches

        await dbContext.SaveChangesAsync();

        if (pendingMatch.Status == PendingMatchStatus.Accepted)
        {
            await PromotePendingMatchToActiveMatch(pendingMatch);
        }
    }

    public async Task DeclinePendingMatchAsync(Guid matchId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var pendingMatch = await dbContext.PendingMatches
            .Include(pm => pm.QueuedPlayers)
            .ThenInclude(qp => qp.User)
            .Where(pm => pm.QueuedPlayers.Any(x => x.User.IdentityUserId == identityUserId))
            .FirstOrDefaultAsync(pm => pm.Id == matchId);

        if (pendingMatch is null)
        {
            throw new InvalidArgumentException("Match not found");
        }

        if (pendingMatch.Status != PendingMatchStatus.Pending)
        {
            throw new InvalidArgumentException("Match not pending");
        }

        var queuedPlayer = pendingMatch.QueuedPlayers.First(x => x.User.IdentityUserId == identityUserId);
        dbContext.QueuedPlayers.Remove(queuedPlayer);

        // TODO: Lock this check somehow
        pendingMatch.Status = PendingMatchStatus.Declined;
        pendingMatch.UpdatedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync();
    }

    public async Task<IEnumerable<ActiveMatchDto>> ActiveMatchesAsync()
    {
        var matches = await dbContext.ActiveMatches.ToListAsync();
        return matches.Select(match => new ActiveMatchDto
        {
            Id = match.Id,
            CreatedAt = match.CreatedAt,
            Team1 = new ActiveMatchTeamDto
            {
                PlayerIds = new List<long>
                {
                    match.TeamOneUserOneId,
                    match.TeamOneUserTwoId
                }
            },
            Team2 = new ActiveMatchTeamDto
            {
                PlayerIds = new List<long>
                {
                    match.TeamTwoUserOneId,
                    match.TeamTwoUserTwoId
                }
            }
        });
    }

    public async Task CancelActiveMatchAsync(Guid matchId)
    {
        var match = await ReadActiveMatch(matchId);

        RemoveActiveMatch(match);
        await dbContext.SaveChangesAsync();
    }

    private void RemoveActiveMatch(ActiveMatch match)
    {
        if (match.PendingMatch is not null)
        {
            dbContext.QueuedPlayers.RemoveRange(match.PendingMatch.QueuedPlayers);
            dbContext.PendingMatches.Remove(match.PendingMatch);
        }

        dbContext.ActiveMatches.Remove(match);
    }

    public async Task SubmitActiveMatchResultAsync(Guid matchId, ActiveMatchSubmitRequest submitRequest)
    {
        var match = await ReadActiveMatch(matchId);

        var seasonId = await seasonService.CurrentSeasonIdAsync();

        if (seasonId is null)
        {
            throw new InvalidArgumentException("No active season");
        }

        await matchesService.SubmitMatch(seasonId.Value,
            new SubmitMatchV2Request
            {
                Team1 = new MatchTeamV2
                {
                    Member1 = match.TeamOneUserOneId,
                    Member2 = match.TeamOneUserTwoId,
                    Score = submitRequest.Team1Score
                },
                Team2 = new MatchTeamV2
                {
                    Member1 = match.TeamTwoUserOneId,
                    Member2 = match.TeamTwoUserTwoId,
                    Score = submitRequest.Team2Score
                }
            });

        RemoveActiveMatch(match);
        await dbContext.SaveChangesAsync();
    }

    private async Task PromotePendingMatchToActiveMatch(PendingMatch pendingMatch)
    {
        // TODO: Allow players to vote for random or ranked teams

        if (pendingMatch.QueuedPlayers.Count != 4)
        {
            // TODO: Better exception
            throw new Exception("Pending match must have 4 players");
        }

        var random = new Random();
        var shuffledQueuedPlayers = pendingMatch.QueuedPlayers.OrderBy(_ => random.Next()).ToList();
        var activeMatch = new ActiveMatch
        {
            CreatedAt = DateTimeOffset.UtcNow,
            TeamOneUserOne = shuffledQueuedPlayers[0].User,
            TeamOneUserTwo = shuffledQueuedPlayers[1].User,
            TeamTwoUserOne = shuffledQueuedPlayers[2].User,
            TeamTwoUserTwo = shuffledQueuedPlayers[3].User
        };

        dbContext.ActiveMatches.Add(activeMatch);
        pendingMatch.ActiveMatch = activeMatch;
        await dbContext.SaveChangesAsync();
    }

    private async Task<ActiveMatch> ReadActiveMatch(Guid matchId)
    {
        // TODO: Improve handling of players
        var match = await dbContext.ActiveMatches
            .Include(x => x.TeamOneUserOne)
            .Include(x => x.TeamOneUserTwo)
            .Include(x => x.TeamTwoUserOne)
            .Include(x => x.TeamTwoUserTwo)
            .Include(x => x.PendingMatch)
            .ThenInclude(pm => pm!.QueuedPlayers)
            .FirstOrDefaultAsync(x => x.Id == matchId);

        var identityUserId = userContextResolver.GetIdentityUserId();

        if (match is null)
        {
            throw new InvalidArgumentException("Match not found");
        }

        var userIsInMatch = match.TeamOneUserOne.IdentityUserId == identityUserId
                            || match.TeamOneUserTwo.IdentityUserId == identityUserId
                            || match.TeamTwoUserOne.IdentityUserId == identityUserId
                            || match.TeamTwoUserTwo.IdentityUserId == identityUserId;

        // TODO: Allow admins to manage active matches
        if (!userIsInMatch)
        {
            throw new InvalidArgumentException("Match not found");
        }

        return match;
    }
}