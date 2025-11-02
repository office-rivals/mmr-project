using Microsoft.AspNetCore.Authorization;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Authorization;

public class PlayerRoleRequirement(PlayerRole minimumRole) : IAuthorizationRequirement
{
    public PlayerRole MinimumRole { get; } = minimumRole;
}