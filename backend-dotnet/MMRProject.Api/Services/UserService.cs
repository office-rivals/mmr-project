using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services;

public interface IUserService
{
    Task<List<User>> AllUsersAsync(string? searchQuery = default);
    Task<User> CreateUserAsync(string name, string? displayName);
    Task<User?> GetUserAsync(long userId);
    Task<User?> GetCurrentAuthenticatedUserAsync();
    Task<User> ClaimUserForCurrentAuthenticatedUserAsync(long userId);
    Task<PlayerHistory?> LatestPlayerHistoryAsync(long userId, long seasonId);
    Task<List<PlayerHistory>> LatestPlayerHistoriesAsync(List<long> userIds, long seasonId);
}

public class UserService(ILogger<UserService> logger, ApiDbContext dbContext, IUserContextResolver userContextResolver)
    : IUserService
{
    public async Task<List<User>> AllUsersAsync(string? searchQuery = default)
    {
        var query = dbContext.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(searchQuery))
        {
            var pattern = $"%{searchQuery}%";
            query = query.Where(
                x => EF.Functions.ILike(x.Name!, pattern) || EF.Functions.ILike(x.DisplayName!, pattern));
        }

        return await query.ToListAsync();
    }

    public async Task<User> CreateUserAsync(string name, string? displayName)
    {
        var user = new User
        {
            Name = name,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.Users.Add(user);
        await dbContext.SaveChangesAsync();
        return user;
    }

    public async Task<User?> GetUserAsync(long userId)
    {
        return await dbContext.Users.FindAsync(userId);
    }

    public Task<User?> GetCurrentAuthenticatedUserAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        return dbContext.Users.FirstOrDefaultAsync(x => x.IdentityUserId == identityUserId);
    }

    public async Task<User> ClaimUserForCurrentAuthenticatedUserAsync(long userId)
    {
        var identityUserId = userContextResolver.GetIdentityUserId();
        var user = await dbContext.Users.FindAsync(userId);

        if (user is null)
        {
            throw new Exception("User not found");
        }

        if (user.IdentityUserId == identityUserId)
        {
            return user;
        }

        if (user.IdentityUserId is not null)
        {
            throw new Exception("User already claimed by another user");
        }

        logger.LogInformation("Claiming user {UserId} for identity user {IdentityUserId}", userId, identityUserId);
        user.IdentityUserId = identityUserId;

        await dbContext.SaveChangesAsync();

        return user;
    }

    public async Task<PlayerHistory?> LatestPlayerHistoryAsync(long userId, long seasonId)
    {
        return await dbContext.PlayerHistories.Where(x => x.UserId == userId && x.Match!.SeasonId == seasonId)
            .OrderByDescending(x => x.MatchId)
            .FirstOrDefaultAsync();
    }
    
    public async Task<List<PlayerHistory>> LatestPlayerHistoriesAsync(List<long> userIds, long seasonId)
    {
        return await dbContext.PlayerHistories.Where(x => userIds.Contains(x.User!.Id) && x.Match!.SeasonId == seasonId)
            .GroupBy(x => x.UserId)
            .Select(x => x.OrderByDescending(y => y.MatchId).First())
            .ToListAsync();
    }
}