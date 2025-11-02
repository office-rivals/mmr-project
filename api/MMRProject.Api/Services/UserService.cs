using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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
    Task<Player> UpdateUserAsync(long userId, string? name, string? displayName, PlayerRole? role = null);
    Task<(PlayerHistory history, long seasonId)?> LatestPlayerHistoryAsync(long userId);
    Task<List<(PlayerHistory history, long seasonId)>> LatestPlayerHistoriesAsync(List<long> userIds);
}

public class UserService(
    ILogger<UserService> logger,
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    IMemoryCache cache)
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

    public async Task<Player> UpdateUserAsync(long userId, string? name, string? displayName, PlayerRole? role = null)
    {
        var user = await dbContext.Players.FindAsync(userId);
        if (user is null)
        {
            throw new NotFoundException($"User with ID {userId} not found");
        }

        if (name is not null)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new InvalidArgumentException($"{nameof(name)} cannot be empty or whitespace");
            }
            user.Name = name;
        }

        if (displayName is not null)
        {
            if (string.IsNullOrWhiteSpace(displayName))
            {
                throw new InvalidArgumentException($"{nameof(displayName)} cannot be empty or whitespace");
            }
            user.DisplayName = displayName;
        }

        if (role.HasValue)
        {
            var currentUserId = userContextResolver.GetIdentityUserId();
            var currentUser = await dbContext.Players
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.IdentityUserId == currentUserId);

            if (currentUser?.Role != PlayerRole.Owner)
            {
                throw new ForbiddenException("Only owners can assign roles");
            }

            var assignerPlayer = await dbContext.Players
                .FirstOrDefaultAsync(p => p.IdentityUserId == currentUserId);

            var oldRole = user.Role;

            logger.LogWarning(
                "Role assignment: Player {PlayerId} ({Email}) from {OldRole} to {NewRole} by Owner {OwnerId} ({OwnerEmail})",
                userId, user.Email, oldRole, role.Value, assignerPlayer?.Id, assignerPlayer?.Email);

            user.Role = role.Value;
            user.RoleAssignedById = assignerPlayer?.Id;
            user.RoleAssignedAt = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(user.IdentityUserId))
            {
                var cacheKey = $"player_role:{user.IdentityUserId}";
                cache.Remove(cacheKey);
                logger.LogDebug("Invalidated role cache for user {IdentityUserId}", user.IdentityUserId);
            }
        }

        user.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();
        return user;
    }

    public async Task<Player?> GetUserAsync(long userId)
    {
        return await dbContext.Players.FindAsync(userId);
    }

    public async Task<Player?> GetCurrentAuthenticatedUserAsync()
    {
        var identityUserId = userContextResolver.GetIdentityUserId();

        var player = await dbContext.Players.FirstOrDefaultAsync(x => x.IdentityUserId == identityUserId);

        if (player != null)
        {
            return player;
        }

        var email = userContextResolver.GetEmail();

        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        player = await dbContext.Players.FirstOrDefaultAsync(x =>
            x.Email == email &&
            x.MigratedAt == null);

        if (player == null)
        {
            return null;
        }

        logger.LogInformation(
            "Auto-linking Player {PlayerId} to identity user {IdentityUserId}",
            player.Id, identityUserId);

        player.IdentityUserId = identityUserId;
        player.MigratedAt = DateTime.UtcNow;
        player.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync();

        return player;
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