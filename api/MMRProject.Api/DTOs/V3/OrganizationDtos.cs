using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record CreateOrganizationRequest
{
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
}

public record UpdateOrganizationRequest
{
    public string? Name { get; init; }
    public string? Slug { get; init; }
}

public record OrganizationResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record OrganizationMemberResponse
{
    [Required] public required Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string? Email { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required OrganizationRole Role { get; init; }
    [Required] public required MembershipStatus Status { get; init; }
    public DateTimeOffset? ClaimedAt { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record InviteMemberRequest
{
    [Required] public required string Email { get; init; }
    [Required] public required OrganizationRole Role { get; init; }
}

public record UpdateMemberRoleRequest
{
    [Required] public required OrganizationRole Role { get; init; }
}
