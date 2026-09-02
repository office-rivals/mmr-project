namespace MMRProject.Api.Data.Entities.V3;

public class Hardware : TenantEntity
{
    public Guid LeagueId { get; set; }

    public required string HardwareId { get; set; }

    public required string LocalIpAddress { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }

    public virtual Organization Organization { get; set; } = null!;

    public virtual League League { get; set; } = null!;
}
