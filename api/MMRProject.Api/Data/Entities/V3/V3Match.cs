namespace MMRProject.Api.Data.Entities.V3;

public class V3Match : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid SeasonId { get; set; }

    public MatchSource Source { get; set; }

    public Guid CreatedByMembershipId { get; set; }

    public DateTimeOffset PlayedAt { get; set; }

    public DateTimeOffset RecordedAt { get; set; }

    public long? LegacyMatchId { get; set; }

    public virtual League League { get; set; } = null!;

    public virtual V3Season Season { get; set; } = null!;

    public virtual OrganizationMembership CreatedByMembership { get; set; } = null!;

    public virtual ICollection<MatchTeam> Teams { get; set; } = new List<MatchTeam>();
}
