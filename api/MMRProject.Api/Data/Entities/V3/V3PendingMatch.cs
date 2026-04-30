namespace MMRProject.Api.Data.Entities.V3;

public class V3PendingMatch : TenantEntity
{
    public Guid LeagueId { get; set; }

    public AcceptanceStatus Status { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }

    public virtual ICollection<PendingMatchTeam> Teams { get; set; } = new List<PendingMatchTeam>();

    public virtual ICollection<PendingMatchAcceptance> Acceptances { get; set; } = new List<PendingMatchAcceptance>();
}
