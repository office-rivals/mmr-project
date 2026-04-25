namespace MMRProject.Api.Data.Entities.V3;

public class PendingMatchTeam : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid PendingMatchId { get; set; }

    public int Index { get; set; }

    public virtual V3PendingMatch PendingMatch { get; set; } = null!;

    public virtual ICollection<PendingMatchTeamPlayer> Players { get; set; } = new List<PendingMatchTeamPlayer>();
}
