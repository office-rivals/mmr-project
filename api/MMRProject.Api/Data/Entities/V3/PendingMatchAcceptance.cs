namespace MMRProject.Api.Data.Entities.V3;

public class PendingMatchAcceptance : BaseEntity
{
    public Guid PendingMatchId { get; set; }

    public Guid LeaguePlayerId { get; set; }

    public AcceptanceStatus Status { get; set; }

    public DateTimeOffset? AcceptedAt { get; set; }

    public virtual V3PendingMatch PendingMatch { get; set; } = null!;

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;
}
