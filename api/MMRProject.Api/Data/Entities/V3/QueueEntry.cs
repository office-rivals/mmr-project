namespace MMRProject.Api.Data.Entities.V3;

public class QueueEntry : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid LeaguePlayerId { get; set; }

    public DateTimeOffset JoinedAt { get; set; }

    public virtual League League { get; set; } = null!;

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;
}
