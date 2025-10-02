namespace MMRProject.Api.Data.Entities;

public class QueuedPlayer : BaseEntity
{
    public long PlayerId { get; set; }

    public virtual Player Player { get; set; } = null!;

    public virtual PendingMatch? PendingMatch { get; set; }

    public Guid? LastAcceptedMatchId { get; set; }
}