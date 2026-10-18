namespace MMRProject.Api.Data.Entities.V3;

/// <summary>
/// One wake of a device, from its <c>sleep</c> status (hardware/analytics/METRICS.md §8.3 v2): the table
/// was in use from <see cref="WokeAt"/> to <see cref="IdleFrom"/>. A lost status loses the row.
/// </summary>
// ponytail: no pruning; a busy table writes ~20 small rows a day. Delete rows older than the stats window
// (a year is plenty) if the table ever matters.
public class DeviceWake : TenantEntity
{
    public Guid DeviceId { get; set; }

    public Guid TableId { get; set; }

    /// <summary>The status time minus its <c>uptime_ms</c>.</summary>
    public DateTimeOffset WokeAt { get; set; }

    /// <summary>The status time minus the idle timeout: the last goal, motion or key press.</summary>
    public DateTimeOffset IdleFrom { get; set; }
}
