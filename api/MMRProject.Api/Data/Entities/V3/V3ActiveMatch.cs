namespace MMRProject.Api.Data.Entities.V3;

public class V3ActiveMatch : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid PendingMatchId { get; set; }

    public DateTimeOffset StartedAt { get; set; }

    public virtual V3PendingMatch PendingMatch { get; set; } = null!;
}
