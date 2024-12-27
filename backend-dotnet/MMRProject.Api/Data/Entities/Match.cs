namespace MMRProject.Api.Data.Entities;

public class Match
{
    public long Id { get; set; }

    public DateTime? CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public DateTime? DeletedAt { get; set; }

    public long? TeamOneId { get; set; }

    public long? TeamTwoId { get; set; }

    public long? SeasonId { get; set; }

    public virtual ICollection<MmrCalculation> MmrCalculations { get; set; } = new List<MmrCalculation>();

    public virtual ICollection<PlayerHistory> PlayerHistories { get; set; } = new List<PlayerHistory>();

    public virtual Season? Season { get; set; }

    public virtual Team? TeamOne { get; set; }

    public virtual Team? TeamTwo { get; set; }
}
