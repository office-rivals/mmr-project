namespace MMRProject.Api.Data.Entities;

public class QueuedPlayer : BaseEntity
{
    public long UserId { get; set; }

    public virtual User User { get; set; } = null!;

    public virtual PendingMatch? PendingMatch { get; set; }

    public Guid? LastAcceptedMatchId { get; set; }
}