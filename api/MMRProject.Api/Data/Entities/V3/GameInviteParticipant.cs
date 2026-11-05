namespace MMRProject.Api.Data.Entities.V3;

/// <summary>
/// One league player's spot in a game invite. Rows exist only while the invite is
/// open, so the unique (league, player) index is the commitment guard.
/// </summary>
public class GameInviteParticipant : TenantEntity
{
    public Guid GameInviteId { get; set; }

    public Guid LeagueId { get; set; }

    public Guid LeaguePlayerId { get; set; }

    /// <summary>The participant who currently manages this spot. Equals <see cref="LeaguePlayerId"/> when the player controls it.</summary>
    public Guid RepresentativeLeaguePlayerId { get; set; }

    public DateTimeOffset JoinedAt { get; set; }

    public AcceptanceStatus AcceptanceStatus { get; set; } = AcceptanceStatus.Pending;

    public DateTimeOffset? AcceptedAt { get; set; }

    public int? TeamIndex { get; set; }

    public int? SlotIndex { get; set; }

    public virtual GameInvite GameInvite { get; set; } = null!;

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;
}
