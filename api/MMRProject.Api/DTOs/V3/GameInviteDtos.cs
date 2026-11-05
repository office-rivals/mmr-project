using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record CurrentGameInviteResponse
{
    public GameInviteResponse? Invite { get; init; }
}

public record GameInviteResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string ShareCode { get; init; }
    [Required] public required GameInviteStatus Status { get; init; }
    public GameInviteEndReason? EndReason { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
    [Required] public required DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? AcceptanceExpiresAt { get; init; }
    /// <summary>Changes every time teams are drawn; responses must echo the current value.</summary>
    public Guid? RoundId { get; init; }
    [Required] public required int Capacity { get; init; }
    [Required] public required Guid CreatedByLeaguePlayerId { get; init; }
    public Guid? PendingMatchId { get; init; }
    [Required] public required List<GameInviteParticipantResponse> Participants { get; init; }
    /// <summary>Empty until the roster is full and teams are drawn.</summary>
    [Required] public required List<PendingMatchTeamResponse> Teams { get; init; }
}

public record GameInviteParticipantResponse
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required Guid RepresentativeLeaguePlayerId { get; init; }
    [Required] public required bool IsCreator { get; init; }
    [Required] public required AcceptanceStatus AcceptanceStatus { get; init; }
    public DateTimeOffset? AcceptedAt { get; init; }
    [Required] public required DateTimeOffset JoinedAt { get; init; }
}

public enum GameInviteEligibility
{
    Eligible = 0,
    NotOrganizationMember = 1,
    NotLeagueMember = 2
}

/// <summary>What a shared link resolves to. The roster is included only for eligible viewers.</summary>
public record GameInviteLinkResponse
{
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required string OrganizationSlug { get; init; }
    [Required] public required string OrganizationName { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required string LeagueSlug { get; init; }
    [Required] public required string LeagueName { get; init; }
    [Required] public required GameInviteEligibility Eligibility { get; init; }
    public GameInviteResponse? Invite { get; init; }
}

public record AddGameInvitePlayersRequest
{
    [Required] public required List<Guid> LeaguePlayerIds { get; init; }
}
