namespace MMRProject.Api.Data.Entities;

public class MmrCalculation
{
    public long Id { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public long? MatchId { get; set; }

    public long? TeamOnePlayerOneMmrDelta { get; set; }

    public long? TeamOnePlayerTwoMmrDelta { get; set; }

    public long? TeamTwoPlayerOneMmrDelta { get; set; }

    public long? TeamTwoPlayerTwoMmrDelta { get; set; }

    public virtual Match? Match { get; set; }
}
