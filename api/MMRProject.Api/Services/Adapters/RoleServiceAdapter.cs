using MMRProject.Api.Data.Entities;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.Services.Adapters;

public class RoleServiceAdapter(
    ILegacyContextResolver contextResolver,
    IOrganizationService organizationService) : IRoleService
{
    public async Task<PlayerRole> GetPlayerRoleAsync(long playerId)
    {
        // In v3, roles are per-organization, not global
        // Return a reasonable default by checking current org context
        var orgId = await contextResolver.ResolveOrganizationIdAsync();
        var members = await organizationService.ListMembersAsync(orgId);

        // We can't easily map legacy player ID to membership, return User as default
        return PlayerRole.User;
    }

    public async Task<PlayerRole> GetCurrentUserRoleAsync()
    {
        var orgId = await contextResolver.ResolveOrganizationIdAsync();
        var membership = await organizationService.GetMembershipForCurrentUserAsync(orgId);

        if (membership == null)
            return PlayerRole.User;

        return membership.Role switch
        {
            OrganizationRole.Owner => PlayerRole.Owner,
            OrganizationRole.Moderator => PlayerRole.Moderator,
            _ => PlayerRole.User,
        };
    }

    public async Task AssignRoleAsync(long playerId, PlayerRole newRole)
    {
        // Role assignment through the legacy adapter is not supported
        // as v3 uses per-organization roles via membership
        throw new NotSupportedException("Role assignment is not supported through the legacy adapter. Use organization member role management instead.");
    }

    public bool HasPermission(PlayerRole userRole, PlayerRole requiredRole)
    {
        return userRole >= requiredRole;
    }
}
