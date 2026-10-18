using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record TableResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required string EndLabelA { get; init; }
    [Required] public required string EndLabelB { get; init; }
    /// <summary>Scoreboard sound volume: 0 off, 1 low, 2 medium, 3 high.</summary>
    [Required, Range(0, 3)] public required int SoundVolume { get; init; }
    /// <summary>
    /// The end shown on the scoreboard's left half (order the app's columns the same way). Null when the
    /// table has no scoreboard.
    /// </summary>
    public TableEnd? ScoreboardLeftEnd { get; init; }
    /// <summary>A claimed scoreboard is assigned to the table (the app hides "on the scoreboard" copy otherwise).</summary>
    [Required] public required bool HasScoreboard { get; init; }
    /// <summary>Short-link code: <c>/t/{shortCode}</c> opens the table's submit page.</summary>
    [Required] public required string ShortCode { get; init; }
    /// <summary><c>{public frontend base}/t/{shortCode}</c> (for the NFC sticker). Null when no base URL is configured.</summary>
    public string? TableUrl { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
    /// <summary>Whether the table is in use right now.</summary>
    [Required] public required TableOccupancyResponse Occupancy { get; init; }
}

/// <summary>In this order: the first that matches wins (hardware/analytics/METRICS.md §8.2).</summary>
public enum OccupancyStatus
{
    /// <summary>No goal counter, or every device is out (dead battery, offline > 36 h). Never shown as free.</summary>
    Unknown,
    InUse,
    /// <summary>A game ended within 3 min of its last goal, with a device still awake.</summary>
    JustFinished,
    /// <summary>A long pause in a live game, or the scoreboard kept awake by motion or keys.</summary>
    ProbablyInUse,
    Free,
}

public enum OccupancyReason
{
    /// <summary>A live game with a goal in the last 5 min.</summary>
    Game,
    /// <summary>Players scanned in ("Gathering: 2 of 4").</summary>
    Gathering,
    /// <summary>Teams made (a linked 0:0 match).</summary>
    TeamsMade,
    /// <summary>A live game paused 5–15 min.</summary>
    LongPause,
    /// <summary>The scoreboard has been awake longer than a bump.</summary>
    DevicesAwake,
    /// <summary>Free, but a device woke recently ("someone's nearby").</summary>
    Touched,
    /// <summary>Unknown: the table has no goal counter.</summary>
    NoDevices,
    /// <summary>Unknown: the devices are out and at least one had a low or cut-off battery.</summary>
    LowBattery,
    /// <summary>Unknown: the devices are out (silent for 36 h, or a wrong-board image).</summary>
    Offline,
}

public record TableOccupancyResponse
{
    [Required] public required OccupancyStatus Status { get; init; }
    /// <summary>
    /// InUse / ProbablyInUse: when the activity started. JustFinished: when the game ended. Free: the last
    /// counted goal ever, null if the table never had one. Unknown: null.
    /// </summary>
    public DateTimeOffset? Since { get; init; }
    public OccupancyReason? Reason { get; init; }
    /// <summary>The score of a live game with a goal, or of the just-finished one.</summary>
    public int? ScoreA { get; init; }
    public int? ScoreB { get; init; }
    /// <summary>While players gather (no goal yet): how many are scanned in, of <see cref="RosterSize"/>.</summary>
    public int? RosterCount { get; init; }
    public int? RosterSize { get; init; }
}

public record UpsertTableRequest : IValidatableObject
{
    [Required, MaxLength(100)] public required string Name { get; init; }
    /// <summary>A league of the same organization. Changing it: 409 while the table has a live or unclaimed game.</summary>
    [Required] public required Guid LeagueId { get; init; }
    /// <summary>Team A's name (it defends end A); blank = "Red".</summary>
    [MaxLength(12)] public string? EndLabelA { get; init; }
    /// <summary>Team B's name; blank = "White". Must differ from team A's (ignoring case).</summary>
    [MaxLength(12)] public string? EndLabelB { get; init; }
    /// <summary>0 off, 1 low, 2 medium, 3 high. Omitted: unchanged (2 on create).</summary>
    [Range(0, 3)] public int? SoundVolume { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        static string Name(string? label, string fallback) => string.IsNullOrWhiteSpace(label) ? fallback : label.Trim();
        if (string.Equals(Name(EndLabelA, FoosballTable.DefaultLabelA), Name(EndLabelB, FoosballTable.DefaultLabelB),
                StringComparison.OrdinalIgnoreCase))
            yield return new ValidationResult("The two team names must differ", [nameof(EndLabelA), nameof(EndLabelB)]);
    }
}

public record DeviceResponse
{
    [Required] public required Guid Id { get; init; }
    /// <summary><c>fb-</c> plus the 12 hex digit Wi-Fi MAC.</summary>
    [Required] public required string DeviceId { get; init; }
    [Required] public required bool Claimed { get; init; }
    public DateTimeOffset? ClaimedAt { get; init; }
    public DeviceRole? Role { get; init; }
    public Guid? TableId { get; init; }
    public TableEnd? End { get; init; }
    public DateTimeOffset? LastSeenAt { get; init; }
    public int? BatteryMv { get; init; }
    [Required] public required bool LowBatt { get; init; }
    public string? FirmwareVersion { get; init; }
    public DateTimeOffset? LastStatusAt { get; init; }
    /// <summary>The last status body exactly as the device sent it (snake_case, see firmware/openapi.yaml).</summary>
    public JsonElement? LastStatus { get; init; }
    /// <summary>Goal counters: the beam config sent to the device; null fields use the firmware default.</summary>
    public BeamConfig? BeamConfig { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

/// <summary>Electronics' beam drive modes A / A+ / B, or firmware's automatic switching between them.</summary>
public enum BeamMode
{
    A,
    ABoost,
    B,
    Auto,
}

/// <summary>
/// A goal counter's beam health config: each field is <c>DeviceConfig.beam_&lt;snake_case name&gt;</c> in
/// hardware/firmware/openapi.yaml.
/// Every field is optional: null = the firmware's default. Health thresholds are in µA.
/// </summary>
public record BeamConfig : IValidatableObject
{
    public BeamMode? Mode { get; init; }
    /// <summary>0 = off, else 10–3600.</summary>
    [Range(0, 3600)] public int? CheckS { get; init; }
    [Range(1, 20)] public int? SettleMs { get; init; }
    [Range(1.0, 100.0)] public double? AmbientMaxPct { get; init; }
    [Range(1.0, 20.0)] public double? MarginMin { get; init; }
    [Range(0.0, 100.0)] public double? DriftPct { get; init; }
    [Range(0.0, 1000.0)] public double? DeadDeltaUa { get; init; }
    [Range(1, 100)] public int? DeadChecks { get; init; }
    [Range(0, 1440)] public int? BaselineMin { get; init; }
    [Range(60, 86400)] public int? ReportS { get; init; }
    [Range(0.0, 100.0)] public double? AmbientSwitchUa { get; init; }
    [Range(0.0, 100.0)] public double? AmbientReturnUa { get; init; }
    [Range(0, 86400)] public int? ModeMinDwellS { get; init; }
    [Range(1000.0, 10_000_000.0)] public double? RPuAOhm { get; init; }
    [Range(1000.0, 10_000_000.0)] public double? RPuBOhm { get; init; }
    /// <summary>[LED current from D9, the boost from D10] in mA, 0.1–20 each.</summary>
    public double[]? LedMa { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (CheckS is > 0 and < 10)
            yield return new ValidationResult("checkS is 0 (off) or 10–3600", [nameof(CheckS)]);
        if (LedMa is not null && (LedMa.Length != 2 || LedMa.Any(ma => ma is < 0.1 or > 20)))
            yield return new ValidationResult("ledMa is [led, boost], 0.1–20 mA each", [nameof(LedMa)]);
    }
}

public record AssignDeviceRequest
{
    [Required] public required DeviceRole Role { get; init; }
    public Guid? TableId { get; init; }
    /// <summary>Required with a table: the goal a goal counter watches, or the end a scoreboard sits at.</summary>
    public TableEnd? End { get; init; }
}

public record EnrolmentTokenStatusResponse
{
    [Required] public required bool Exists { get; init; }
    public DateTimeOffset? CreatedAt { get; init; }
}

public record EnrolmentTokenResponse
{
    /// <summary>Shown once. Flash it into the devices' secrets file.</summary>
    [Required] public required string Token { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record TablePlayerResponse
{
    [Required] public required Guid LeaguePlayerId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    /// <summary>Scoreboard LED colour (palette index 0–5) of a scanned-in player.</summary>
    public int? Color { get; init; }
    /// <summary><see cref="Color"/> as <c>#rrggbb</c>, for the app.</summary>
    public string? ColorHex { get; init; }
}

public record TableRosterResponse
{
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required int TeamSize { get; init; }
    /// <summary>In join order.</summary>
    [Required] public required List<TablePlayerResponse> Players { get; init; }
    [Required] public required bool CanGenerate { get; init; }
}

public record TableGoalResponse
{
    [Required] public required Guid Id { get; init; }
    /// <summary>The team credited with the goal.</summary>
    [Required] public required TableEnd End { get; init; }
    public Guid? ScorerLeaguePlayerId { get; init; }
    [Required] public required DateTimeOffset OccurredAt { get; init; }
}

public record TableMatchResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid TableId { get; init; }
    [Required] public required TableMatchStatus Status { get; init; }
    [Required] public required DateTimeOffset StartedAt { get; init; }
    public DateTimeOffset? EndedAt { get; init; }
    [Required] public required int ScoreA { get; init; }
    [Required] public required int ScoreB { get; init; }
    /// <summary>Set when the match is linked to an active matchmaking match (players known).</summary>
    public Guid? ActiveMatchId { get; init; }
    /// <summary>League of the linked active match; otherwise the table's league.</summary>
    public Guid? LeagueId { get; init; }
    [Required] public required List<TablePlayerResponse> PlayersA { get; init; }
    [Required] public required List<TablePlayerResponse> PlayersB { get; init; }
    public TableGoalResponse? LastGoal { get; init; }
    public Guid? MatchId { get; init; }
    /// <summary>Set for finished, unsubmitted matches: claim before this.</summary>
    public DateTimeOffset? ClaimableUntil { get; init; }
    /// <summary>A finished linked match is rated automatically at this time (undo on the board cancels it).</summary>
    public DateTimeOffset? AutoSubmitAt { get; init; }
}

public record LiveTableResponse
{
    [Required] public required TableResponse Table { get; init; }
    [Required] public required long Version { get; init; }
    /// <summary>Current or most recent match; null when there is none or it was discarded.</summary>
    public TableMatchResponse? Match { get; init; }
    /// <summary>The table's last submitted match, for "same players as last game".</summary>
    public PreviousTableMatchResponse? PreviousMatch { get; init; }
    /// <summary>The scoreboard's scanned-in line-up; null while a game is on, or when the table can't scan.</summary>
    public TableRosterResponse? Roster { get; init; }
    /// <summary>The table's claimed devices, for the players' "counter: battery low" line.</summary>
    [Required] public required List<TableDeviceResponse> Devices { get; init; }
}

public record TableDeviceResponse
{
    [Required] public required DeviceRole Role { get; init; }
    public TableEnd? End { get; init; }
    [Required] public required bool LowBatt { get; init; }
    /// <summary>
    /// Goal counters: the last status's <c>beam.health</c> as sent (<c>ok</c> | <c>low_margin</c> | <c>ambient_high</c> |
    /// <c>blocked</c> | <c>sensor_dead</c>); <c>blocked</c> from <c>beam_blocked</c> on firmware without it. Null: no status yet.
    /// </summary>
    public string? BeamHealth { get; init; }
    /// <summary>Offline after 36 h of silence.</summary>
    public DateTimeOffset? LastSeenAt { get; init; }
}

public record TableNewGameRequest
{
    /// <summary>True: finish the game (claimable); false: throw it away.</summary>
    [Required] public required bool Save { get; init; }
    /// <summary>The <c>version</c> the phone showed: a newer one → 409, so a stale view never ends a changed game.</summary>
    [Required] public required long ExpectedVersion { get; init; }
}

public record PreviousTableMatchResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid MatchId { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required List<TablePlayerResponse> PlayersA { get; init; }
    [Required] public required List<TablePlayerResponse> PlayersB { get; init; }
}

public record ClaimTableMatchRequest
{
    /// <summary>Required for unclaimed matches (one per end); ignored for linked matches.</summary>
    public List<ClaimTableMatchTeamRequest>? Teams { get; init; }
}

public record ClaimTableMatchTeamRequest
{
    [Required] public required TableEnd End { get; init; }
    [Required] public required List<SubmitMatchPlayerRequest> Players { get; init; }
}

public record LinkTableRequest
{
    [Required] public required Guid TableId { get; init; }
    /// <summary>Which team of the active match plays at end A (0 or 1).</summary>
    [Range(0, 1)] public int TeamIndexAtEndA { get; init; }
}

public enum ShortLinkKind
{
    /// <summary>A table or table-match link: opens the submit page.</summary>
    Table,
    /// <summary>An unknown card scanned on a scoreboard: opens the page that links it to the viewer.</summary>
    Card,
}

public record ShortLinkResponse
{
    [Required] public required ShortLinkKind Kind { get; init; }
    /// <summary>
    /// Table, by the game's state: a rated match → <c>/{org}/{league}/match/{matchId}</c>; live, or linked and
    /// awaiting confirmation → <c>/{org}/{league}/tables/{tableId}</c>; claimable →
    /// <c>/{org}/{league}/submit?table={tableId}&amp;match={tableMatchId}</c>; else
    /// <c>/{org}/{league}/submit?table={tableId}</c>. Card: <c>/{orgSlug}/cards?code={code}</c>.
    /// </summary>
    [Required] public required string Path { get; init; }
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required string OrgSlug { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required string LeagueSlug { get; init; }
    [Required] public required Guid TableId { get; init; }
    /// <summary>Set while the match can still be claimed (the submit page then prefills it).</summary>
    public Guid? TableMatchId { get; init; }
    /// <summary>Set when the link opens a rated match (its match page).</summary>
    public Guid? MatchId { get; init; }
    [Required] public required string TableName { get; init; }
    /// <summary>Card links only: after this, linking answers 410 (scan the card again).</summary>
    public DateTimeOffset? CardLinkExpiresAt { get; init; }
}

public record MatchGoalsResponse
{
    [Required] public required Guid TableMatchId { get; init; }
    /// <summary>The rated match, once submitted.</summary>
    public Guid? MatchId { get; init; }
    [Required] public required string TableName { get; init; }
    /// <summary>The caller may fix scorers: a player of the match, or a moderator/owner.</summary>
    [Required] public required bool CanEdit { get; init; }
    /// <summary>Counted goals (not undone), in time order.</summary>
    [Required] public required List<MatchGoalResponse> Goals { get; init; }
}

public record MatchGoalResponse
{
    [Required] public required Guid Id { get; init; }
    /// <summary>The credited team (MatchTeam.Index; 0 = end A).</summary>
    [Required] public required int TeamIndex { get; init; }
    /// <summary>The goal's event time (METRICS §1.4).</summary>
    [Required] public required DateTimeOffset At { get; init; }
    /// <summary>Running score after this goal (A = team index 0).</summary>
    [Required] public required int ScoreA { get; init; }
    [Required] public required int ScoreB { get; init; }
    public Guid? ScorerLeaguePlayerId { get; init; }
    /// <summary>The scorer plays for the conceding team. The score is unchanged.</summary>
    [Required] public required bool OwnGoal { get; init; }
}

public record SetGoalScorerRequest
{
    /// <summary>A player of either team (the conceding team's = an own goal), or null to clear it.</summary>
    public Guid? LeaguePlayerId { get; init; }
}

public record SetTableShortCodeRequest
{
    /// <summary>A readable code (3–32 of [a-z0-9-], case-insensitive), or null for a new random one.</summary>
    [MaxLength(ShortCode.CustomMaxLength)] public string? Code { get; init; }
}

public record LinkCardRequest
{
    /// <summary>The code from the scoreboard's <c>/t/{code}</c> link.</summary>
    [Required, MaxLength(32)] public required string Code { get; init; }
    /// <summary>The member the card is for (an active member of the org); omitted = the caller.</summary>
    public Guid? MembershipId { get; init; }
}

public record CardLinkedByResponse
{
    [Required] public required Guid MembershipId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
}

public record PlayerCardResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
    /// <summary>The member who linked it for its owner; null when the owner linked it.</summary>
    public CardLinkedByResponse? LinkedBy { get; init; }
    /// <summary>Linking only: what joining the scanned table's roster did, for the card's owner.</summary>
    public ScanResultType? RosterResult { get; init; }
}

public record AdminPlayerCardResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid MembershipId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    public CardLinkedByResponse? LinkedBy { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record DeletedCountResponse
{
    [Required] public required int Deleted { get; init; }
}

public record OrphanGoalResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string EventId { get; init; }
    /// <summary><c>fb-</c> plus 12 hex digits.</summary>
    [Required] public required string DeviceId { get; init; }
    public Guid? TableId { get; init; }
    /// <summary>The team the goal would have counted for.</summary>
    public TableEnd? End { get; init; }
    public DateTimeOffset? OccurredAt { get; init; }
    [Required] public required DateTimeOffset ReceivedAt { get; init; }
    [Required] public required OrphanReason Reason { get; init; }
}

/// <summary>
/// A stat with its sample (hardware/analytics/METRICS.md §8.4). <see cref="Value"/> is sent even when
/// <see cref="Enough"/> is false ("not enough games yet"); null only when nothing was measured.
/// </summary>
public record StatValue
{
    public double? Value { get; init; }
    /// <summary>The sample the minimum applies to (games, weeks or goals; see the stat).</summary>
    [Required] public required int N { get; init; }
    [Required] public required int MinN { get; init; }
    [Required] public required bool Enough { get; init; }
    /// <summary>A range around the value where the stat has one (25th/75th percentile, Wilson interval).</summary>
    public double? Low { get; init; }
    public double? High { get; init; }
}

public record OfficeHoursResponse
{
    /// <summary>Lowercase three-letter weekdays.</summary>
    [Required] public required List<string> Days { get; init; }
    /// <summary>Local <c>HH:mm</c> in the stats' time zone.</summary>
    [Required] public required string Start { get; init; }
    [Required] public required string End { get; init; }
}

public record TableDayGames
{
    /// <summary>Local <c>yyyy-MM-dd</c>.</summary>
    [Required] public required string Date { get; init; }
    [Required] public required int Games { get; init; }
    [Required] public required int Submitted { get; init; }
    [Required] public required int Unclaimed { get; init; }
}

public record TableWeekStats
{
    /// <summary>The local Monday, <c>yyyy-MM-dd</c>.</summary>
    [Required] public required string WeekStart { get; init; }
    /// <summary>The whole week lies in the window (partial weeks at the edges are false).</summary>
    [Required] public required bool FullWeek { get; init; }
    [Required] public required int Games { get; init; }
    [Required] public required int Submitted { get; init; }
    [Required] public required int Unclaimed { get; init; }
    /// <summary>0..1 of the week's office hours in the window; null without office hours in it.</summary>
    public double? Utilisation { get; init; }
}

public record TableHeatmap
{
    /// <summary>7 × 24: Monday first, local hours 0–23.</summary>
    [Required] public required List<List<double>> Values { get; init; }
    /// <summary><c>busy_minutes</c> (0–60, average per weekday-hour) or <c>busy_tables</c> (average tables busy).</summary>
    [Required] public required string Unit { get; init; }
    /// <summary>Games in the window.</summary>
    [Required] public required int N { get; init; }
    [Required] public required int MinN { get; init; }
    [Required] public required double WeeksOfData { get; init; }
    /// <summary>≥ <see cref="MinN"/> games and ≥ 4 weeks of data.</summary>
    [Required] public required bool Enough { get; init; }
}

public record TableDeviceQuality
{
    /// <summary>The hardware id (<c>fb-</c> + MAC), as in <see cref="DeviceResponse"/>.</summary>
    [Required] public required string DeviceId { get; init; }
    public DeviceRole? Role { get; init; }
    public TableEnd? End { get; init; }
    /// <summary>Goals the device sent in the window.</summary>
    [Required] public required int Goals { get; init; }
    /// <summary>0..1 of its goals undone; n = goals, enough from 30.</summary>
    [Required] public required StatValue UndoRate { get; init; }
    /// <summary>0..1 of its consecutive counted goals under 3 s apart in one match.</summary>
    [Required] public required StatValue FastGapRate { get; init; }
    [Required] public required bool LowBatt { get; init; }
    /// <summary>Cut off, a wrong-board image, or silent for 36 h.</summary>
    [Required] public required bool Out { get; init; }
}

public record TableDataQuality
{
    [Required] public required List<TableDeviceQuality> Devices { get; init; }
    [Required] public required int OrphansOtherTable { get; init; }
    [Required] public required int OrphansNoMatch { get; init; }
    [Required] public required double FragmentsPerWeek { get; init; }
    [Required] public required double DiscardedPerWeek { get; init; }
    /// <summary>0..1 of the counted goals in linked games with a scorer; n = goals, enough from 30.</summary>
    [Required] public required StatValue ScorerPickRate { get; init; }
}

public record TableStatsResponse
{
    [Required] public required Guid TableId { get; init; }
    [Required] public required DateTimeOffset From { get; init; }
    [Required] public required DateTimeOffset To { get; init; }
    /// <summary>The IANA zone days, weeks, hours and office hours are in.</summary>
    [Required] public required string TimeZone { get; init; }
    [Required] public required OfficeHoursResponse OfficeHours { get; init; }
    /// <summary>TS1: games in the window.</summary>
    [Required] public required StatValue Games { get; init; }
    /// <summary>TS1: mean games of the full weeks; n = full weeks, enough (for a trend) from 4.</summary>
    [Required] public required StatValue AverageGamesPerWeek { get; init; }
    /// <summary>Every local day of the window, zero days included.</summary>
    [Required] public required List<TableDayGames> GamesPerDay { get; init; }
    /// <summary>Every ISO week the window touches, with its utilisation (TS4 weekly).</summary>
    [Required] public required List<TableWeekStats> Weeks { get; init; }
    /// <summary>TS2.</summary>
    [Required] public required TableHeatmap BusyHours { get; init; }
    /// <summary>TS3: median seconds, first to last goal, of games that reached the winning score; low/high = 25th/75th percentile.</summary>
    [Required] public required StatValue MatchDurationS { get; init; }
    /// <summary>TS4: 0..1 of the office hours busy; n = full weeks, enough from 1.</summary>
    [Required] public required StatValue Utilisation { get; init; }
    /// <summary>No wake rows yet, only games: utilisation undercounts (show "≥ 23 %").</summary>
    [Required] public required bool UtilisationIsLowerBound { get; init; }
    /// <summary>TS5: 0..1 of games whose claim window closed that were submitted; n = those games, enough from 20.</summary>
    [Required] public required StatValue ClaimRate { get; init; }
    [Required] public required StatValue ClaimRateLinked { get; init; }
    [Required] public required StatValue ClaimRateUnlinked { get; init; }
    /// <summary>TS6: 0..1 of counted goals credited to end A; low/high = 95 % Wilson interval; n = games, enough from 30.</summary>
    [Required] public required StatValue EndBias { get; init; }
    /// <summary>TS7.</summary>
    [Required] public required TableDataQuality DataQuality { get; init; }
}

public record TableStatsSummary
{
    [Required] public required Guid TableId { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required TableOccupancyResponse Occupancy { get; init; }
    [Required] public required StatValue Games { get; init; }
    /// <summary>Games in the current local ISO week ("23 games this week").</summary>
    [Required] public required int GamesThisWeek { get; init; }
    [Required] public required StatValue Utilisation { get; init; }
    [Required] public required bool UtilisationIsLowerBound { get; init; }
    [Required] public required StatValue MatchDurationS { get; init; }
}

public record AllTablesBusyResponse
{
    /// <summary>0..1 of the office hours when every table was busy; n = full weeks, enough from 2 (and ≥ 2 tables).</summary>
    [Required] public required StatValue Share { get; init; }
    /// <summary>The longest stretch with every table busy, in seconds; null with fewer than 2 tables or none.</summary>
    public int? LongestS { get; init; }
}

public record TablesStatsOverviewResponse
{
    [Required] public required DateTimeOffset From { get; init; }
    [Required] public required DateTimeOffset To { get; init; }
    [Required] public required string TimeZone { get; init; }
    [Required] public required OfficeHoursResponse OfficeHours { get; init; }
    [Required] public required List<TableStatsSummary> Tables { get; init; }
    /// <summary>Games on all tables in the window.</summary>
    [Required] public required StatValue Games { get; init; }
    /// <summary>TS2 for all tables together: average tables busy per weekday-hour.</summary>
    [Required] public required TableHeatmap BusyTables { get; init; }
    /// <summary>TS8 (admin).</summary>
    [Required] public required AllTablesBusyResponse AllTablesBusy { get; init; }
}
