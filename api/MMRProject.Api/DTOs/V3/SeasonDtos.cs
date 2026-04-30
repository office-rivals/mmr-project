using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record CreateSeasonRequest
{
    [Required] public required DateTimeOffset StartsAt { get; init; }
}

public record SeasonResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required DateTimeOffset StartsAt { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}
