namespace MMRProject.Api.Data.Entities;

public class PendingMatch : BaseEntity
{
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public virtual ICollection<QueuedPlayer> QueuedPlayers { get; set; } = new List<QueuedPlayer>();

    public PendingMatchStatus Status { get; set; } = PendingMatchStatus.Pending;
    
    public Guid? ActiveMatchId { get; set; }
    public virtual ActiveMatch? ActiveMatch { get; set; }
    public DateTimeOffset ExpiresAt { get; set; } = DateTimeOffset.UtcNow.AddSeconds(30);
}

public enum PendingMatchStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}