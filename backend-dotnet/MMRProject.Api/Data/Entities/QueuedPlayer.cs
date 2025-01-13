namespace MMRProject.Api.Data.Entities;

public class QueuedPlayer
{
    public long Id { get; set; }
    
    public virtual User User { get; set; } = null!;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}