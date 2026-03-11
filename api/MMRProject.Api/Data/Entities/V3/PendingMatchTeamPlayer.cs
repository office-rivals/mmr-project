namespace MMRProject.Api.Data.Entities.V3;

public class PendingMatchTeamPlayer : BaseEntity
{
    public Guid PendingMatchTeamId { get; set; }

    public Guid LeaguePlayerId { get; set; }

    public int Index { get; set; }

    public virtual PendingMatchTeam PendingMatchTeam { get; set; } = null!;

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;
}
