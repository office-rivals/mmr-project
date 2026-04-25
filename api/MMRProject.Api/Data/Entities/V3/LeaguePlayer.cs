namespace MMRProject.Api.Data.Entities.V3;

public class LeaguePlayer : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid OrganizationMembershipId { get; set; }

    public long Mmr { get; set; }

    public decimal Mu { get; set; }

    public decimal Sigma { get; set; }

    public long? LegacyPlayerId { get; set; }

    public virtual League League { get; set; } = null!;

    public virtual OrganizationMembership OrganizationMembership { get; set; } = null!;
}
