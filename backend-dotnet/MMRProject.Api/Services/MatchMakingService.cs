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
}

public class MatchMakingService(
    IUserContextResolver userContextResolver,
    ApiDbContext dbContext,
    IUserService userService
) : IMatchMakingService
{
    public async Task AddPlayerToQueueAsync()
    {
        var currentUser = await userService.GetCurrentAuthenticatedUserAsync();

        if (currentUser == null)
        {
            throw new InvalidArgumentException("No user linked");
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
        var queuedPlayers = await dbContext.QueuedPlayers
            .Include(x => x.User)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();

        return new MatchMakingQueueStatus
        {
            PlayersInQueue = queuedPlayers.Count,
            UserInQueue = queuedPlayers.Any(x => x.User.IdentityUserId == identityUserId)
        };
    }

    private async Task CheckIfMatchCanBeMade()
    {
        // TODO: Lock this check
        var queuedPlayers = await dbContext.QueuedPlayers
            .Include(x => x.User)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();

        if (queuedPlayers.Count < 4)
        {
            return;
        }

        var pendingMatch = new PendingMatch
        {
            UserOne = queuedPlayers[0].User,
            UserTwo = queuedPlayers[1].User,
            UserThree = queuedPlayers[2].User,
            UserFour = queuedPlayers[3].User
        };

        await dbContext.PendingMatches.AddAsync(pendingMatch);
        dbContext.QueuedPlayers.RemoveRange(queuedPlayers.Take(4));
        await dbContext.SaveChangesAsync();

        // TODO: Add timeout to match
    }

    public async Task AcceptPendingMatch(long matchId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var pendingMatch = await dbContext.PendingMatches
            .Include(x => x.UserOne)
            .Include(x => x.UserTwo)
            .Include(x => x.UserThree)
            .Include(x => x.UserFour)
            .Where(x => x.UserOne.IdentityUserId == identityUserId ||
                        x.UserTwo.IdentityUserId == identityUserId ||
                        x.UserThree.IdentityUserId == identityUserId ||
                        x.UserFour.IdentityUserId == identityUserId)
            .FirstOrDefaultAsync(x => x.Id == matchId && x.Status == PendingMatchStatus.Pending);

        if (pendingMatch is null)
        {
            throw new InvalidArgumentException("Match not found");
        }

        // TODO: Improve this somehow. Maybe an extra table?
        if (pendingMatch.UserOne.IdentityUserId == identityUserId)
        {
            pendingMatch.UserOneDecision = PendingMatchUserDecision.Accepted;
        }
        else if (pendingMatch.UserTwo.IdentityUserId == identityUserId)
        {
            pendingMatch.UserTwoDecision = PendingMatchUserDecision.Accepted;
        }
        else if (pendingMatch.UserThree.IdentityUserId == identityUserId)
        {
            pendingMatch.UserThreeDecision = PendingMatchUserDecision.Accepted;
        }
        else if (pendingMatch.UserFour.IdentityUserId == identityUserId)
        {
            pendingMatch.UserFourDecision = PendingMatchUserDecision.Accepted;
        }

        // TODO: Lock this check somehow
        if (pendingMatch is
            {
                UserOneDecision: PendingMatchUserDecision.Accepted,
                UserTwoDecision: PendingMatchUserDecision.Accepted,
                UserThreeDecision: PendingMatchUserDecision.Accepted,
                UserFourDecision: PendingMatchUserDecision.Accepted
            }
           )
        {
            pendingMatch.Status = PendingMatchStatus.Accepted;
        }

        await dbContext.SaveChangesAsync();
    }

    public async Task DeclinePendingMatch(long matchId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var pendingMatch = await dbContext.PendingMatches
            .Include(x => x.UserOne)
            .Include(x => x.UserTwo)
            .Include(x => x.UserThree)
            .Include(x => x.UserFour)
            .Where(x => x.UserOne.IdentityUserId == identityUserId ||
                        x.UserTwo.IdentityUserId == identityUserId ||
                        x.UserThree.IdentityUserId == identityUserId ||
                        x.UserFour.IdentityUserId == identityUserId)
            .FirstOrDefaultAsync(x => x.Id == matchId && x.Status == PendingMatchStatus.Pending);

        if (pendingMatch is null)
        {
            throw new InvalidArgumentException("Match not found");
        }
        
        if (pendingMatch.UserOne.IdentityUserId == identityUserId)
        {
            pendingMatch.UserOneDecision = PendingMatchUserDecision.Declined;
        }
        else if (pendingMatch.UserTwo.IdentityUserId == identityUserId)
        {
            pendingMatch.UserTwoDecision = PendingMatchUserDecision.Declined;
        }
        else if (pendingMatch.UserThree.IdentityUserId == identityUserId)
        {
            pendingMatch.UserThreeDecision = PendingMatchUserDecision.Declined;
        }
        else if (pendingMatch.UserFour.IdentityUserId == identityUserId)
        {
            pendingMatch.UserFourDecision = PendingMatchUserDecision.Declined;
        }
        
        // TODO: Lock this check somehow
        pendingMatch.Status = PendingMatchStatus.Declined;
        
        await dbContext.SaveChangesAsync();
    }
}