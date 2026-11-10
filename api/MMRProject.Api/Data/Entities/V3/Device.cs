namespace MMRProject.Api.Data.Entities.V3;

public enum DeviceRole
{
    Goal = 0,
    Scoreboard = 1
}

/// <summary>
/// An end of a table. A goal counter at end A watches goal A, so its goals count for team B.
/// Team A is the team defending goal A.
/// </summary>
public enum TableEnd
{
    A = 0,
    B = 1
}

public class Device : TenantEntity
{
    /// <summary><c>fb-</c> plus the lowercase hex Wi-Fi MAC.</summary>
    public required string HardwareId { get; set; }

    /// <summary>SHA-256 of the secret the device created on first boot. Null after an admin reset.</summary>
    public byte[]? SecretHash { get; set; }

    public bool Claimed { get; set; }

    public DateTimeOffset? ClaimedAt { get; set; }

    public DeviceRole? Role { get; set; }

    public Guid? TableId { get; set; }

    public TableEnd? End { get; set; }

    public int ConfigVersion { get; set; }

    public DateTimeOffset? LastSeenAt { get; set; }

    /// <summary>The first request of the current wake; null after a status (the device went back to sleep).</summary>
    public DateTimeOffset? AwakeSince { get; set; }

    public int? BatteryMv { get; set; }

    public bool LowBatt { get; set; }

    public string? FirmwareVersion { get; set; }

    public DateTimeOffset? LastStatusAt { get; set; }

    /// <summary>The last status body as sent by the device (JSON).</summary>
    public string? LastStatus { get; set; }

    /// <summary>Goal counters: the admin's beam config (<c>BeamConfig</c> as JSON), served in the device config.</summary>
    public string? BeamConfig { get; set; }

    public virtual FoosballTable? Table { get; set; }
}
