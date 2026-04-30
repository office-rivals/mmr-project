namespace MMRProject.Api.Data.Entities.V3;

public class V3Season : TenantEntity
{
    public Guid LeagueId { get; set; }

    public DateTimeOffset StartsAt { get; set; }

    public long? LegacySeasonId { get; set; }

    public virtual League League { get; set; } = null!;
}
