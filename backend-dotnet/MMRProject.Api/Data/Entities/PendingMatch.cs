namespace MMRProject.Api.Data.Entities;

public class PendingMatch : BaseEntity
{
    public virtual ICollection<QueuedPlayer> QueuedPlayers { get; set; } = new List<QueuedPlayer>();

    public PendingMatchStatus Status { get; set; } = PendingMatchStatus.Pending;
}

public enum PendingMatchStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}