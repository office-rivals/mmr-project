namespace MMRProject.Api.DTOs;

public record UpdateUserRequest
{
    public string? Name { get; set; }

    public string? DisplayName { get; set; }
}
