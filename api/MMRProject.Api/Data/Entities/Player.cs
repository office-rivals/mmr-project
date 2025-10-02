namespace MMRProject.Api.Data.Entities;

public class Player
{
    public long Id { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public string? Name { get; set; }

    public long? Mmr { get; set; }

    public decimal? Mu { get; set; }

    public decimal? Sigma { get; set; }

    public string? DisplayName { get; set; }

    public string? IdentityUserId { get; set; }

    public virtual ICollection<PlayerHistory> PlayerHistories { get; set; } = new List<PlayerHistory>();

    public virtual ICollection<Team> TeamPlayerOnes { get; set; } = new List<Team>();

    public virtual ICollection<Team> TeamPlayerTwos { get; set; } = new List<Team>();
}
