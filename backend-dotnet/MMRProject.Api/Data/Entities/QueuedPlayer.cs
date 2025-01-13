namespace MMRProject.Api.Data.Entities;

public class QueuedPlayer
{
    public long Id { get; set; }
    public long UserId { get; set; }
    
    public virtual User User { get; set; } = null!;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public virtual PendingMatch? PendingMatch { get; set; }
    
    public long? LastAcceptedMatchId { get; set; }
}