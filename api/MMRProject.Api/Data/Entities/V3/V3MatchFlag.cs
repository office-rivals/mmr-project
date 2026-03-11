namespace MMRProject.Api.Data.Entities.V3;

public class V3MatchFlag : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid MatchId { get; set; }

    public Guid FlaggedByMembershipId { get; set; }

    public required string Reason { get; set; }

    public MatchFlagStatus Status { get; set; }

    public string? ResolutionNote { get; set; }

    public Guid? ResolvedByMembershipId { get; set; }

    public DateTimeOffset? ResolvedAt { get; set; }

    public virtual V3Match Match { get; set; } = null!;

    public virtual OrganizationMembership FlaggedByMembership { get; set; } = null!;

    public virtual OrganizationMembership? ResolvedByMembership { get; set; }
}
