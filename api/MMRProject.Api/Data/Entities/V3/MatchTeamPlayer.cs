namespace MMRProject.Api.Data.Entities.V3;

public class MatchTeamPlayer : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid MatchTeamId { get; set; }

    public Guid LeaguePlayerId { get; set; }

    public int Index { get; set; }

    public virtual MatchTeam MatchTeam { get; set; } = null!;

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;
}
