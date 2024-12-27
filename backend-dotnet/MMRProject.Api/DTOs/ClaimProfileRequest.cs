namespace MMRProject.Api.DTOs;

public record ClaimProfileRequest
{
    public required long UserId { get; set; }
}