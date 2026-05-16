using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record CreateLeagueRequest
{
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    public int TeamSize { get; init; } = 2;
    /// <summary>
    /// Fixed score that the winning team must reach (e.g. 10 for foosball).
    /// Omit or pass null to allow free-form scoring (highest score wins, no
    /// shape constraint — useful for table tennis, badminton, etc.).
    /// </summary>
    public int? WinningScore { get; init; } = 10;
}

public record UpdateLeagueRequest
{
    public string? Name { get; init; }
    public string? Slug { get; init; }
    public int? TeamSize { get; init; }
    /// <summary>
    /// Set together with <see cref="WinningScore"/> to apply that value
    /// (null = clear → free-form scoring; non-null = require that score).
    /// Leave false to leave the existing winning_score untouched. This
    /// avoids the "absent vs explicit-null" ambiguity in nullable JSON.
    /// </summary>
    public bool UpdateWinningScore { get; init; }
    public int? WinningScore { get; init; }
}

public record LeagueResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    [Required] public required int TeamSize { get; init; }
    public int? WinningScore { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}
