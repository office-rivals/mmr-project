using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record CreateInviteLinkRequest
{
    public int? MaxUses { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
}

public record InviteLinkResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string Code { get; init; }
    [Required] public required Guid OrganizationId { get; init; }
    public int? MaxUses { get; init; }
    [Required] public required int UseCount { get; init; }
    public DateTimeOffset? ExpiresAt { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record InviteInfoResponse
{
    [Required] public required string Code { get; init; }
    [Required] public required string OrganizationName { get; init; }
    [Required] public required string OrganizationSlug { get; init; }
    [Required] public required bool IsValid { get; init; }
}

public record JoinOrganizationResponse
{
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required string OrganizationName { get; init; }
    [Required] public required string OrganizationSlug { get; init; }
    [Required] public required Guid MembershipId { get; init; }
}
