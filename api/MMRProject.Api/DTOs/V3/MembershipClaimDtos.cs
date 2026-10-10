using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record ClaimableMembershipsResponse
{
    [Required] public required bool RequesterEligible { get; init; }
    [Required] public required List<ClaimableMembershipResponse> Memberships { get; init; }
}

public record ClaimableMembershipResponse
{
    [Required] public required Guid OrganizationMembershipId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required int MatchCount { get; init; }
    public DateTimeOffset? LastPlayedAt { get; init; }
    [Required] public required List<ClaimableMembershipLeagueStatsResponse> Leagues { get; init; }
}

public record ClaimableMembershipLeagueStatsResponse
{
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required string LeagueName { get; init; }
    [Required] public required int MatchCount { get; init; }
    public DateTimeOffset? LastPlayedAt { get; init; }
}

public record CreateMembershipClaimRequest
{
    [Required] public required Guid OrganizationMembershipId { get; init; }
    public string? Note { get; init; }
}

public record ReviewMembershipClaimRequest
{
    public string? ReviewNote { get; init; }
}

public record MembershipClaimRequestResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required Guid OrganizationMembershipId { get; init; }
    [Required] public required Guid UserId { get; init; }
    public string? RequesterDisplayName { get; init; }
    [Required] public required string RequesterEmail { get; init; }
    [Required] public required ClaimableMembershipResponse Target { get; init; }
    [Required] public required MembershipClaimStatus Status { get; init; }
    public string? Note { get; init; }
    public string? ReviewNote { get; init; }
    public Guid? ReviewedByMembershipId { get; init; }
    public DateTimeOffset? ReviewedAt { get; init; }
    public Guid? RetiredMembershipId { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}
