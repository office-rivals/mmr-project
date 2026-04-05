using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.Data.Entities.V3;

public class OrganizationInviteLink : BaseEntity
{
    public Guid OrganizationId { get; set; }

    public required string Code { get; set; }

    public Guid CreatedByMembershipId { get; set; }

    public int? MaxUses { get; set; }

    public int UseCount { get; set; }

    public DateTimeOffset? ExpiresAt { get; set; }

    public virtual Organization Organization { get; set; } = null!;

    public virtual OrganizationMembership CreatedByMembership { get; set; } = null!;
}
