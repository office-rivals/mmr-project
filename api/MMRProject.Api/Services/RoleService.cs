using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;
using MMRProject.Api.Exceptions;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services;

public class RoleService : IRoleService
{
    private readonly ApiDbContext _context;
    private readonly IUserContextResolver _userContextResolver;
    private readonly IMemoryCache _cache;
    private readonly ILogger<RoleService> _logger;

    public RoleService(
        ApiDbContext context,
        IUserContextResolver userContextResolver,
        IMemoryCache cache,
        ILogger<RoleService> logger)
    {
        _context = context;
        _userContextResolver = userContextResolver;
        _cache = cache;
        _logger = logger;
    }

    public async Task<PlayerRole> GetPlayerRoleAsync(long playerId)
    {
        var player = await _context.Players
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == playerId);

        if (player == null)
            throw new NotFoundException($"Player with ID {playerId} not found");

        return player.Role;
    }

    public async Task<PlayerRole> GetCurrentUserRoleAsync()
    {
        var userId = _userContextResolver.GetIdentityUserId();
        var player = await _context.Players
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.IdentityUserId == userId);

        return player?.Role ?? PlayerRole.User;
    }

    public async Task AssignRoleAsync(long playerId, PlayerRole newRole)
    {
        var currentUserRole = await GetCurrentUserRoleAsync();

        if (currentUserRole != PlayerRole.Owner)
            throw new ForbiddenException("Only owners can assign roles");

        var player = await _context.Players.FirstOrDefaultAsync(p => p.Id == playerId);
        if (player == null)
            throw new NotFoundException($"Player with ID {playerId} not found");

        var currentUserId = _userContextResolver.GetIdentityUserId();
        var assignerPlayer = await _context.Players
            .FirstOrDefaultAsync(p => p.IdentityUserId == currentUserId);

        var oldRole = player.Role;

        _logger.LogWarning(
            "Role assignment: Player {PlayerId} ({Email}) from {OldRole} to {NewRole} by Owner {OwnerId} ({OwnerEmail})",
            playerId, player.Email, oldRole, newRole, assignerPlayer?.Id, assignerPlayer?.Email);

        player.Role = newRole;
        player.RoleAssignedById = assignerPlayer?.Id;
        player.RoleAssignedAt = DateTime.UtcNow;
        player.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        if (!string.IsNullOrEmpty(player.IdentityUserId))
        {
            var cacheKey = $"player_role:{player.IdentityUserId}";
            _cache.Remove(cacheKey);
            _logger.LogDebug("Invalidated role cache for user {IdentityUserId}", player.IdentityUserId);
        }
    }

    public bool HasPermission(PlayerRole userRole, PlayerRole requiredRole)
    {
        return userRole >= requiredRole;
    }
}
