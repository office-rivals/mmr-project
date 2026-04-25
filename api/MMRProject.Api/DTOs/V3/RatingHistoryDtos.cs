using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record RatingHistoryResponse
{
    [Required] public required List<RatingHistoryEntryResponse> Entries { get; init; }
}

public record RatingHistoryEntryResponse
{
    [Required] public required Guid MatchId { get; init; }
    [Required] public required long Mmr { get; init; }
    [Required] public required decimal Mu { get; init; }
    [Required] public required decimal Sigma { get; init; }
    [Required] public required long Delta { get; init; }
    [Required] public required DateTimeOffset RecordedAt { get; init; }
}

public record LeagueRatingHistoryResponse
{
    [Required] public required List<LeagueRatingHistoryEntry> Entries { get; init; }
}

public record LeagueRatingHistoryEntry
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    [Required] public required Guid MatchId { get; init; }
    [Required] public required long Mmr { get; init; }
    [Required] public required DateTimeOffset RecordedAt { get; init; }
}
