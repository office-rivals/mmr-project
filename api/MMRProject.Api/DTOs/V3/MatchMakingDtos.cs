using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record QueueStatusResponse
{
    [Required] public required List<QueuedPlayerResponse> QueuedPlayers { get; init; }
    public PendingMatchResponse? PendingMatch { get; init; }
    public ActiveMatchResponse? ActiveMatch { get; init; }
}

public record QueuedPlayerResponse
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required DateTimeOffset JoinedAt { get; init; }
}

public record PendingMatchResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required AcceptanceStatus Status { get; init; }
    [Required] public required DateTimeOffset ExpiresAt { get; init; }
    [Required] public required List<PendingMatchTeamResponse> Teams { get; init; }
    [Required] public required List<PendingMatchAcceptanceResponse> Acceptances { get; init; }
}

public record PendingMatchTeamResponse
{
    [Required] public required int Index { get; init; }
    [Required] public required List<PendingMatchTeamPlayerResponse> Players { get; init; }
}

public record PendingMatchTeamPlayerResponse
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required int Index { get; init; }
}

public record PendingMatchAcceptanceResponse
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    [Required] public required AcceptanceStatus Status { get; init; }
    public DateTimeOffset? AcceptedAt { get; init; }
}

public record ActiveMatchResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid PendingMatchId { get; init; }
    [Required] public required DateTimeOffset StartedAt { get; init; }
    [Required] public required List<PendingMatchTeamResponse> Teams { get; init; }
}

public record SubmitActiveMatchResultRequest
{
    [Required] public required List<ActiveMatchTeamScoreRequest> Teams { get; init; }
}

public record ActiveMatchTeamScoreRequest
{
    [Required] public required int TeamIndex { get; init; }
    [Required] public required int Score { get; init; }
}
