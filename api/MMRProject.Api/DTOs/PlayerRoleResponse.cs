using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record PlayerRoleResponse
{
    public PlayerRole Role { get; init; }
}
