namespace MMRProject.Api.DTOs;

public record UserDetails
{
    public required long UserId { get; set; }
    public required string Name { get; set; }
    public string? DisplayName { get; set; }
}