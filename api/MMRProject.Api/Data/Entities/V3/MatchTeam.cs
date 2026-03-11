namespace MMRProject.Api.Data.Entities.V3;

public class MatchTeam : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid MatchId { get; set; }

    public int Index { get; set; }

    public int Score { get; set; }

    public bool IsWinner { get; set; }

    public virtual V3Match Match { get; set; } = null!;

    public virtual ICollection<MatchTeamPlayer> Players { get; set; } = new List<MatchTeamPlayer>();
}
