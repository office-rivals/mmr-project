namespace MMRProject.Api.Data.Entities.V3;

public class OrganizationMembership : TenantEntity
{
    public Guid? UserId { get; set; }

    public string? InviteEmail { get; set; }

    public string? DisplayName { get; set; }

    public string? Username { get; set; }

    public OrganizationRole Role { get; set; }

    public MembershipStatus Status { get; set; }

    public Guid? RoleAssignedByMembershipId { get; set; }

    public DateTimeOffset? RoleAssignedAt { get; set; }

    public DateTimeOffset? ClaimedAt { get; set; }

    public virtual Organization Organization { get; set; } = null!;

    public virtual User? User { get; set; }

    public virtual OrganizationMembership? RoleAssignedByMembership { get; set; }
}
