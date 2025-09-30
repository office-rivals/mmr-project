using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services;

public interface IUserService
{
    Task<List<Player>> AllUsersAsync(string? searchQuery = default);
    Task<Player> CreateUserAsync(string name, string? displayName);
    Task<Player?> GetUserAsync(long userId);
    Task<Player?> GetCurrentAuthenticatedUserAsync();
    Task<Player> ClaimUserForCurrentAuthenticatedUserAsync(long userId);
    Task<(PlayerHistory history, long seasonId)?> LatestPlayerHistoryAsync(long userId);
    Task<List<(PlayerHistory history, long seasonId)>> LatestPlayerHistoriesAsync(List<long> userIds);
}

public class UserService(ILogger<UserService> logger, ApiDbContext dbContext, IUserContextResolver userContextResolver)
    : IUserService
{
    public async Task<List<Player>> AllUsersAsync(string? searchQuery = default)
    {
        var query = dbContext.Players.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            var pattern = $"%{searchQuery}%";
            query = query.Where(
                x => EF.Functions.ILike(x.Name!, pattern) || EF.Functions.ILike(x.DisplayName!, pattern));
        }

        return await query.ToListAsync();
    }

    public async Task<Player> CreateUserAsync(string name, string? displayName)
    {
        var user = new Player
        {
            Name = name,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.Players.Add(user);
        await dbContext.SaveChangesAsync();
        return user;
    }

    public async Task<Player?> GetUserAsync(long userId)
    {
        return await dbContext.Players.FindAsync(userId);
    }

    public Task<Player?> GetCurrentAuthenticatedUserAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        return dbContext.Players.FirstOrDefaultAsync(x => x.IdentityUserId == identityUserId);
    }

    public async Task<Player> ClaimUserForCurrentAuthenticatedUserAsync(long userId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.Players.FindAsync(userId);

        if (user is null)
        {
            throw new InvalidArgumentException("User not found");
        }

        if (user.IdentityUserId == identityUserId)
        {
            return user;
        }

        if (user.IdentityUserId is not null)
        {
            throw new InvalidArgumentException("User already claimed by another user");
        }

        logger.LogInformation("Claiming user {UserId} for identity user {IdentityUserId}", userId, identityUserId);
        user.IdentityUserId = identityUserId;

        await dbContext.SaveChangesAsync();

        return user;
    }

    public async Task<(PlayerHistory history, long seasonId)?> LatestPlayerHistoryAsync(long userId)
    {
        var playerHistory = await dbContext.PlayerHistories.Where(x => x.PlayerId == userId)
            .Include(x => x.Match)
            .OrderByDescending(x => x.MatchId)
            .AsNoTracking()
            .FirstOrDefaultAsync();

        if (playerHistory?.Match?.SeasonId is null)
        {
            return null;
        }

        return (playerHistory, playerHistory.Match.SeasonId.Value);
    }

    public async Task<List<(PlayerHistory history, long seasonId)>> LatestPlayerHistoriesAsync(List<long> userIds)
    {
        var playerHistories = await dbContext.PlayerHistories.Where(x => userIds.Contains(x.Player!.Id))
            .Include(x => x.Match)
            .GroupBy(x => x.PlayerId)
            .AsNoTracking()
            .Select(x => x.OrderByDescending(y => y.MatchId).First())
            .ToListAsync();

        return playerHistories.Where(x => x.Match?.SeasonId is not null)
            .Select(x => (x, x.Match!.SeasonId!.Value))
            .ToList();
    }
}