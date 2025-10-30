using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Authorization;

public class PlayerRoleAuthorizationHandler : AuthorizationHandler<PlayerRoleRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PlayerRoleRequirement requirement)
    {
        var roleClaim = context.User.FindFirst("player_role");
        if (roleClaim == null) return Task.CompletedTask;

        if (!Enum.TryParse<PlayerRole>(roleClaim.Value, out var userRole))
            return Task.CompletedTask;

        if (userRole >= requirement.MinimumRole)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
