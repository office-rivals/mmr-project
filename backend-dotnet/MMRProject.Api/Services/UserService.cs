using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services;

public interface IUserService
{
    Task<List<User>> AllUsersAsync(string? searchQuery = default);
    Task<User> CreateUserAsync(string name, string? displayName);
    Task<User?> GetUserAsync(long userId);
    Task<User?> GetCurrentAuthenticatedUserAsync();
    Task<User> ClaimUserForCurrentAuthenticatedUserAsync(long userId);
    Task<(PlayerHistory history, long seasonId)?> LatestPlayerHistoryAsync(long userId);
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
        var playerHistory = await dbContext.PlayerHistories.Where(x => x.UserId == userId)
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
}