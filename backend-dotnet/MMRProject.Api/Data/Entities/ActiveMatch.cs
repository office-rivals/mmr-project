namespace MMRProject.Api.Data.Entities;

public class ActiveMatch
{
    public long Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public long TeamOneUserOneId { get; set; }
    public virtual User TeamOneUserOne { get; set; } = null!;
    
    public long TeamOneUserTwoId { get; set; }
    public virtual User TeamOneUserTwo { get; set; } = null!;
    
    public long TeamTwoUserOneId { get; set; }
    public virtual User TeamTwoUserOne { get; set; } = null!;
    
    public long TeamTwoUserTwoId { get; set; }
    public virtual User TeamTwoUserTwo { get; set; } = null!;
}