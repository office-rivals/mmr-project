namespace MMRProject.Api.Data.Entities.V3;

public class RatingHistory : TenantEntity
{
    public Guid LeaguePlayerId { get; set; }

    public Guid MatchId { get; set; }

    public long Mmr { get; set; }

    public decimal Mu { get; set; }

    public decimal Sigma { get; set; }

    public long Delta { get; set; }

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;

    public virtual V3Match Match { get; set; } = null!;
}
