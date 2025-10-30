using Microsoft.AspNetCore.Authorization;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Authorization;

public class PlayerRoleRequirement : IAuthorizationRequirement
{
    public PlayerRole MinimumRole { get; }

    public PlayerRoleRequirement(PlayerRole minimumRole)
    {
        MinimumRole = minimumRole;
    }
}
