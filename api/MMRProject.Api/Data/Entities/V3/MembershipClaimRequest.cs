namespace MMRProject.Api.Data.Entities.V3;

public class MembershipClaimRequest : TenantEntity
{
    public Guid OrganizationMembershipId { get; set; }

    public Guid UserId { get; set; }

    public MembershipClaimStatus Status { get; set; }

    public string? Note { get; set; }

    public string? ReviewNote { get; set; }

    public Guid? ReviewedByMembershipId { get; set; }

    public DateTimeOffset? ReviewedAt { get; set; }

    public Guid? RetiredMembershipId { get; set; }

    public string? RequesterVerifiedEmail { get; set; }

    public virtual Organization Organization { get; set; } = null!;

    public virtual OrganizationMembership OrganizationMembership { get; set; } = null!;

    public virtual User User { get; set; } = null!;

    public virtual OrganizationMembership? ReviewedByMembership { get; set; }

    public virtual OrganizationMembership? RetiredMembership { get; set; }
}
