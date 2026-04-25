using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record CreateTokenRequest
{
    [Required] public required string Name { get; init; }
    public Guid? OrganizationId { get; init; }
    public Guid? LeagueId { get; init; }
    [Required] public required string Scope { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
}

public record TokenResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required string Scope { get; init; }
    public Guid? OrganizationId { get; init; }
    public Guid? LeagueId { get; init; }
    public DateTimeOffset? LastUsedAt { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record CreateTokenResponse
{
    [Required] public required string Token { get; init; }
    [Required] public required TokenResponse TokenDetails { get; init; }
}
