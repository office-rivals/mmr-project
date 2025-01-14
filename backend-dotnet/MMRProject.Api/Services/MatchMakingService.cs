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
    Task<PendingMatchStatus> PendingMatchStatusAsync(long matchId);
    Task AcceptPendingMatchAsync(long matchId);
    Task DeclinePendingMatchAsync(long matchId);
    Task<bool> VerifyStateOfPendingMatchesAsync(CancellationToken cancellationToken = default);
}

public class MatchMakingService(
    ILogger<MatchMakingService> logger,
    IUserContextResolver userContextResolver,
    ApiDbContext dbContext
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
        var queuedPlayers = await dbContext.QueuedPlayers
            .Where(x => x.PendingMatch == null || x.PendingMatch.Status == PendingMatchStatus.Declined)
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

    public async Task<PendingMatchStatus> PendingMatchStatusAsync(long matchId)
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

    public async Task AcceptPendingMatchAsync(long matchId)
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

        // TODO: Cleanup old pending matches

        await dbContext.SaveChangesAsync();
    }

    public async Task DeclinePendingMatchAsync(long matchId)
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

        await dbContext.SaveChangesAsync();
    }

    public async Task<bool> VerifyStateOfPendingMatchesAsync(CancellationToken cancellationToken = default)
    {
        var pendingMatches = await dbContext.PendingMatches
            .Include(pm => pm.QueuedPlayers)
            .Where(pm => pm.Status == PendingMatchStatus.Pending)
            .ToListAsync(cancellationToken);

        if (pendingMatches.Count == 0)
        {
            return false;
        }

        foreach (var pendingMatch in pendingMatches)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                return false;
            }

            if (pendingMatch.CreatedAt.AddSeconds(30) > DateTime.UtcNow)
            {
                // We are still waiting for responses
                continue;
            }

            // We are still in pending state after response timeout. Decline the match and allow players to queue again

            var missingAcceptedPlayers =
                pendingMatch.QueuedPlayers.Where(x => x.LastAcceptedMatchId != pendingMatch.Id);
            pendingMatch.Status = PendingMatchStatus.Declined;
            dbContext.QueuedPlayers.RemoveRange(missingAcceptedPlayers);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}