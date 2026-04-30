using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record SubmitMatchRequest
{
    [Required] public required List<SubmitMatchTeamRequest> Teams { get; init; }
}

public record SubmitMatchTeamRequest
{
    [Required] public required List<SubmitMatchPlayerRequest> Players { get; init; }
    [Required] public required int Score { get; init; }
}

public record SubmitMatchPlayerRequest
{
    public Guid? LeaguePlayerId { get; init; }
    public Guid? OrganizationMembershipId { get; init; }
    public CreateMatchPlayerRequest? NewPlayer { get; init; }

    public static implicit operator SubmitMatchPlayerRequest(Guid leaguePlayerId)
        => new() { LeaguePlayerId = leaguePlayerId };
}

public record CreateMatchPlayerRequest
{
    [Required] public required string DisplayName { get; init; }
    public string? Username { get; init; }
    public string? Email { get; init; }
}

public record MatchResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required Guid SeasonId { get; init; }
    [Required] public required MatchSource Source { get; init; }
    [Required] public required DateTimeOffset PlayedAt { get; init; }
    [Required] public required DateTimeOffset RecordedAt { get; init; }
    [Required] public required List<MatchTeamResponse> Teams { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record MatchTeamResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required int Index { get; init; }
    [Required] public required int Score { get; init; }
    [Required] public required bool IsWinner { get; init; }
    [Required] public required List<MatchTeamPlayerResponse> Players { get; init; }
}

public record MatchTeamPlayerResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid LeaguePlayerId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required int Index { get; init; }
    public long? RatingDelta { get; init; }
}

public record RecalculateMatchesResponse
{
    [Required] public required int MatchCount { get; init; }
    public Guid? FromMatchId { get; init; }
    [Required] public required DateTimeOffset StartedAt { get; init; }
    [Required] public required DateTimeOffset CompletedAt { get; init; }
}
