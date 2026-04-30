using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record LeaderboardResponse
{
    [Required] public required List<LeaderboardEntryResponse> Entries { get; init; }
}

public record LeaderboardEntryResponse
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    public long? Mmr { get; init; }
    [Required] public required decimal Mu { get; init; }
    [Required] public required decimal Sigma { get; init; }
    [Required] public required int Rank { get; init; }
    [Required] public required int Wins { get; init; }
    [Required] public required int Losses { get; init; }
    [Required] public required int WinningStreak { get; init; }
    [Required] public required int LosingStreak { get; init; }
}
