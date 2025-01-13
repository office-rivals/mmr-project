namespace MMRProject.Api.Data.Entities;

public class PendingMatch
{
    public long Id { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public virtual User UserOne { get; set; } = null!;
    public PendingMatchUserDecision UserOneDecision { get; set; } = PendingMatchUserDecision.None;
    public virtual User UserTwo { get; set; } = null!;
    public PendingMatchUserDecision UserTwoDecision { get; set; } = PendingMatchUserDecision.None;
    public virtual User UserThree { get; set; } = null!;
    public PendingMatchUserDecision UserThreeDecision { get; set; } = PendingMatchUserDecision.None;
    public virtual User UserFour { get; set; } = null!;
    public PendingMatchUserDecision UserFourDecision { get; set; } = PendingMatchUserDecision.None;

    public PendingMatchStatus Status { get; set; } = PendingMatchStatus.Pending;
}

public enum PendingMatchStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}

public enum PendingMatchUserDecision
{
    None = 0,
    Accepted = 1,
    Declined = 2
}