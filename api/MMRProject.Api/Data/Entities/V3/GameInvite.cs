namespace MMRProject.Api.Data.Entities.V3;

/// <summary>
/// A private, league-scoped game gathered through a shared link. Owns its roster
/// (see <see cref="GameInviteParticipant"/>) independently of the matchmaking queue.
/// </summary>
public class GameInvite : TenantEntity
{
    public Guid LeagueId { get; set; }

    public Guid CreatedByLeaguePlayerId { get; set; }

    public string ShareCode { get; set; } = string.Empty;

    public GameInviteStatus Status { get; set; }

    public GameInviteEndReason? EndReason { get; set; }

    /// <summary>Creation plus 30 minutes. Only applies while waiting; see the design doc.</summary>
    public DateTimeOffset ExpiresAt { get; set; }

    /// <summary>Identifies the current shuffle and acceptance step; stale responses carry an older id.</summary>
    public Guid? CurrentRoundId { get; set; }

    public DateTimeOffset? AcceptanceExpiresAt { get; set; }

    /// <summary>Set once the invite starts; points at the accepted pending match that became the active match.</summary>
    public Guid? PendingMatchId { get; set; }

    public DateTimeOffset? EndedAt { get; set; }

    public virtual League League { get; set; } = null!;

    public virtual LeaguePlayer CreatedByLeaguePlayer { get; set; } = null!;

    public virtual V3PendingMatch? PendingMatch { get; set; }

    public virtual ICollection<GameInviteParticipant> Participants { get; set; } = new List<GameInviteParticipant>();
}
