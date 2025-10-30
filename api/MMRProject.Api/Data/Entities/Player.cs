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

    public string? Email { get; set; }

    public DateTime? MigratedAt { get; set; }

    public PlayerRole Role { get; set; } = PlayerRole.User;

    public long? RoleAssignedById { get; set; }

    public DateTime? RoleAssignedAt { get; set; }

    public virtual Player? RoleAssignedBy { get; set; }

    public virtual ICollection<PlayerHistory> PlayerHistories { get; set; } = new List<PlayerHistory>();

    public virtual ICollection<Team> TeamPlayerOnes { get; set; } = new List<Team>();

    public virtual ICollection<Team> TeamPlayerTwos { get; set; } = new List<Team>();
}
