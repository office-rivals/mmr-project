using System.Text.Json;
using System.Text.Json.Serialization;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

// Device API (firmware/openapi.yaml in office-rivals/mmr-hardware). snake_case on the wire, via DeviceJson.Options.

public static class DeviceJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) },
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };
}

public record DeviceConfigResponse
{
    public required string Role { get; init; }
    public required string TableId { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? Goal { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public string? End { get; init; }
    public required int ConfigVersion { get; init; }
    public required int SoundVolume { get; init; }
    /// <summary>Goal counters: how long after a goal its undo button may undo it (the server checks the same).</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public int? UndoWindowS { get; init; }
}

public record GoalEventRequest
{
    public required string EventId { get; init; }
    public required string DeviceId { get; init; }
    public required long Seq { get; init; }
    public required DateTimeOffset? OccurredAt { get; init; }
    public required long UptimeMs { get; init; }
    public required string? TableId { get; init; }
    public required string? Goal { get; init; }
    public required int? BatteryMv { get; init; }
    public required string FirmwareVersion { get; init; }
}

public record UndoEventRequest
{
    public required string EventId { get; init; }
    public required string DeviceId { get; init; }
    public required long Seq { get; init; }
    public DateTimeOffset? OccurredAt { get; init; }
    public long UptimeMs { get; init; }
    public string? TableId { get; init; }
    public string? Goal { get; init; }
    /// <summary>This counter's goal to undo.</summary>
    public required string UndoesEventId { get; init; }
    public int? BatteryMv { get; init; }
    public string? FirmwareVersion { get; init; }
}

/// <summary>A goal or undo event's 201: the score of the match it landed in, for the counter's screen.</summary>
public record EventScoreResponse
{
    public required int ScoreA { get; init; }
    public required int ScoreB { get; init; }
    /// <summary>The table's <c>end_label_a</c>/<c>end_label_b</c> (team names).</summary>
    public required string LabelA { get; init; }
    public required string LabelB { get; init; }
    /// <summary>live or finished.</summary>
    public required TableMatchStatus Status { get; init; }
    /// <summary>The end this counter's goals score for (the opposite of the goal it sits in).</summary>
    public required TableEnd? ScoresFor { get; init; }
}

/// <summary>Why an undo event was refused (422 <c>code</c>); the counter knocks "no" for each.</summary>
public enum UndoRefusal
{
    NotYours,
    TooLate,
    AlreadyUndone,
    Closed,
}

public enum DeviceStatusReason
{
    Sleep,
    Heartbeat,
    Cutoff,
    WrongBoard,
    /// <summary>The beam's health got worse (sent at once, while the device stays awake).</summary>
    Beam
}

public record DeviceStatusRequest
{
    public required string DeviceId { get; init; }
    public required string Role { get; init; }
    public required DeviceStatusReason Reason { get; init; }
    public required int? BatteryMv { get; init; }
    public required string FirmwareVersion { get; init; }
    public required bool LowBatt { get; init; }
    /// <summary>Milliseconds since this wake (the wake's length on a <c>sleep</c>).</summary>
    public long? UptimeMs { get; init; }
}

public enum ScoreboardActionType
{
    UndoLastGoal,
    NewGame,
    AssignScorer,
    SwapSides,
    Scan,
    RemovePlayer,
    GenerateTeams,
}

public record ScoreboardActionRequest
{
    public required ScoreboardActionType Type { get; init; }
    public required long ExpectedVersion { get; init; }
    public bool? Save { get; init; }
    public string? GoalId { get; init; }
    public string? PlayerId { get; init; }
    /// <summary><c>scan</c>: the card UID in hex. Personal data: never logged or stored.</summary>
    public string? Uid { get; init; }
    /// <summary><c>generate_teams</c>: how to split the roster; fair (by MMR) when absent.</summary>
    public TeamsMode? Mode { get; init; }
    /// <summary><c>generate_teams</c> manual: the roster's player ids as the board shows them, left team first.</summary>
    public List<List<string>>? Teams { get; init; }
}

public record ScoreboardStateResponse
{
    public required long Version { get; init; }
    public required string? TableName { get; init; }
    public required string? TableUrl { get; init; }
    public required bool NeedsClaim { get; init; }
    public required string? ClaimUrl { get; init; }
    public required ScoreboardMatch? Match { get; init; }
    /// <summary>The next game's line-up; null while a game is on, or when the table can't scan.</summary>
    public required ScoreboardRoster? Roster { get; init; }
    /// <summary>Only in the answer to a <c>scan</c>.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public ScanResult? Scan { get; init; }
}

public record ScoreboardRoster
{
    public required string LeagueName { get; init; }
    public required int TeamSize { get; init; }
    /// <summary>In join order.</summary>
    public required List<ScoreboardPlayer> Players { get; init; }
    public required bool CanGenerate { get; init; }
    public required RosterLink? Link { get; init; }
}

public record RosterLink
{
    public required string Url { get; init; }
    public required int ExpiresInS { get; init; }
}

public enum ScanResultType
{
    Joined,
    AlreadyIn,
    UnknownCard,
    RosterFull,
    Locked,
    Busy,
    NoLeague,
    Unavailable,
}

public record ScanResult
{
    public required ScanResultType Result { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public ScoreboardPlayer? Player { get; init; }
}

public record ScoreboardMatch
{
    public required string Id { get; init; }
    public required string Status { get; init; }
    public required DateTimeOffset StartedAt { get; init; }
    public required DateTimeOffset? EndedAt { get; init; }
    public required string? Winner { get; init; }
    public required bool CanUndo { get; init; }
    public required bool CanSwap { get; init; }
    /// <summary>How the scoreboard made the teams; null when linked in the app or unlinked.</summary>
    public required TeamsMode? TeamsMode { get; init; }
    public required ScoreboardTeam Left { get; init; }
    public required ScoreboardTeam Right { get; init; }
    public required ScoreboardGoal? LastGoal { get; init; }
    /// <summary>Seconds until a finished linked match is rated automatically; null when nothing is pending.</summary>
    public int? SubmitInS { get; init; }
    /// <summary>Finished matches only: the Finished screen's one line ("9:26 · MVP Alice").</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public ScoreboardSummary? Summary { get; init; }
}

public record ScoreboardSummary
{
    /// <summary>First to last counted goal (METRICS T1); null below 2 goals.</summary>
    public required int? DurationS { get; init; }
    /// <summary>Top contributor (METRICS §4.2); null in 1v1, below 70 % known scorers, or when shared.</summary>
    public required string? MvpName { get; init; }
}

public record ScoreboardTeam
{
    public required string EndLabel { get; init; }
    public required int Score { get; init; }
    public required List<ScoreboardPlayer> Players { get; init; }
}

public record ScoreboardPlayer
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    /// <summary>LED palette index 0–5 (<c>PlayerColors</c>). Absent: no colour.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] public int? Color { get; init; }
}

public record ScoreboardGoal
{
    public required string Id { get; init; }
    public required string Side { get; init; }
    public required ScoreboardPlayer? Scorer { get; init; }
    public required bool OwnGoal { get; init; }
    public required int AgeS { get; init; }
    public required DateTimeOffset OccurredAt { get; init; }
}
