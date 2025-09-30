namespace MMRProject.Api.Data.Entities;

public class ActiveMatch: BaseEntity
{
    public virtual PendingMatch? PendingMatch { get; set; }
    public long TeamOnePlayerOneId { get; set; }
    public virtual Player TeamOnePlayerOne { get; set; } = null!;
    
    public long TeamOnePlayerTwoId { get; set; }
    public virtual Player TeamOnePlayerTwo { get; set; } = null!;
    
    public long TeamTwoPlayerOneId { get; set; }
    public virtual Player TeamTwoPlayerOne { get; set; } = null!;
    
    public long TeamTwoPlayerTwoId { get; set; }
    public virtual Player TeamTwoPlayerTwo { get; set; } = null!;
}