using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record CreateLeagueRequest
{
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    public int QueueSize { get; init; } = 4;
}

public record UpdateLeagueRequest
{
    public string? Name { get; init; }
    public string? Slug { get; init; }
    public int? QueueSize { get; init; }
}

public record LeagueResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    [Required] public required int QueueSize { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}
