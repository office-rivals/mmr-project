using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record CreatePersonalAccessTokenRequest
{
    [Required] public required string Name { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
};

public class PersonalAccessTokenResponse
{
    [Required] public required long Id { get; set; }
    [Required] public required string Name { get; set; }
    public DateTimeOffset? LastUsedAt { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
};

public class CreatePersonalAccessTokenResponse
{
    [Required] public required long Id { get; set; }
    [Required] public required string Name { get; set; }
    [Required] public required string Token { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }
    public DateTimeOffset? CreatedAt { get; set; }
};