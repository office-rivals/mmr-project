namespace MMRProject.Api.Data.Entities.V3;

/// <summary>Why a goal is not in any match. Orphans are kept and shown to admins, never discarded.</summary>
public enum OrphanReason
{
    /// <summary>The device is not assigned to a table as a goal counter.</summary>
    UnassignedDevice = 0,

    /// <summary>The event names another table (queued before the device moved).</summary>
    OtherTable = 1,

    /// <summary>A queued goal that fits no live or claimable match.</summary>
    NoMatch = 2
}

/// <summary>
/// One goal event from a goal counter, deduplicated on <see cref="EventId"/>. A goal that fits no
/// match is kept as an orphan (null <see cref="TableMatchId"/>, <see cref="OrphanReason"/> set).
/// </summary>
public class TableGoal : TenantEntity
{
    public required string EventId { get; set; }

    public Guid DeviceId { get; set; }

    public Guid? TableMatchId { get; set; }

    /// <summary>The device's table when the goal arrived (null for an unassigned device).</summary>
    public Guid? TableId { get; set; }

    public OrphanReason? OrphanReason { get; set; }

    /// <summary>The team credited with the goal. Null for an unassigned device.</summary>
    public TableEnd? ScoringEnd { get; set; }

    public long Seq { get; set; }

    public DateTimeOffset? OccurredAt { get; set; }

    public DateTimeOffset ReceivedAt { get; set; }

    public int? BatteryMv { get; set; }

    public DateTimeOffset? UndoneAt { get; set; }

    /// <summary>The goal counter's undo event that undid it (its dedupe key); null otherwise.</summary>
    public string? UndoEventId { get; set; }

    public Guid? ScorerLeaguePlayerId { get; set; }

    public virtual TableMatch? TableMatch { get; set; }
}
