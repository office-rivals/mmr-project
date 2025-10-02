namespace MMRProject.Api.Data.Entities;

public class PlayerHistory
{
    public long Id { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public long? PlayerId { get; set; }

    public long? Mmr { get; set; }

    public decimal? Mu { get; set; }

    public decimal? Sigma { get; set; }

    public long? MatchId { get; set; }

    public virtual Match? Match { get; set; }

    public virtual Player? Player { get; set; }
}
