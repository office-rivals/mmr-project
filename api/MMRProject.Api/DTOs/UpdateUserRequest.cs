using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record UpdateUserRequest
{
    public string? Name { get; set; }

    public string? DisplayName { get; set; }

    public PlayerRole? Role { get; set; }
}
