using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Services;

public interface IRoleService
{
    Task<PlayerRole> GetPlayerRoleAsync(long playerId);
    Task<PlayerRole> GetCurrentUserRoleAsync();
    Task AssignRoleAsync(long playerId, PlayerRole newRole);
    bool HasPermission(PlayerRole userRole, PlayerRole requiredRole);
}
