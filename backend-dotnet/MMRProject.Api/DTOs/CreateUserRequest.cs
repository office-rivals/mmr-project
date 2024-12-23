namespace MMRProject.Api.DTOs;

public record CreateUserRequest
{
    public required string Name { get; set; }
    public string? DisplayName { get; set; }
}