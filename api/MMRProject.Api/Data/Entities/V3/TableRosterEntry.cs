namespace MMRProject.Api.Data.Entities.V3;

/// <summary>
/// A player scanned in at a table for its next game (the scoreboard's lobby). While the table plays a
/// linked match these are that match's players; they keep their LED colour through the game.
/// </summary>
public class TableRosterEntry : TenantEntity
{
    public Guid TableId { get; set; }

    /// <summary>In the table's league at the time of the scan.</summary>
    public Guid LeaguePlayerId { get; set; }

    /// <summary>Palette index 0–5 (see <c>PlayerColors</c>), unique within the table's roster.</summary>
    public int Color { get; set; }

    public virtual LeaguePlayer LeaguePlayer { get; set; } = null!;
}
