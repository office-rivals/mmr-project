using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;

namespace MMRProject.Api.Services.V3;

/// <summary>Is a table in use right now (hardware/analytics/METRICS.md §8.2), from what the devices already send.</summary>
public static class TableOccupancy
{
    /// <summary>The devices' <c>idle_timeout_s</c>: their default, the server doesn't set it.</summary>
    public static readonly TimeSpan IdleTimeout = TimeSpan.FromSeconds(300);

    private static readonly TimeSpan BoardAwake = TimeSpan.FromSeconds(90);
    private static readonly TimeSpan Slack = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan PlayWindow = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan LongPause = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan JustFinished = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan Gathering = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan Backdate = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan Out = TimeSpan.FromHours(36);
    private static readonly TimeSpan SameRequest = TimeSpan.FromSeconds(2);

    /// <summary>How long a device counts as awake after its last request: a scoreboard long-polls, a goal counter is silent.</summary>
    public static TimeSpan AwakeWindow(DeviceRole? role) => role == DeviceRole.Scoreboard ? BoardAwake : IdleTimeout + Slack;

    public record DeviceSignal(DeviceRole? Role, DateTimeOffset? LastSeenAt, DateTimeOffset? LastStatusAt,
        string? LastStatusReason, DateTimeOffset? AwakeSince, bool LowBatt);

    /// <param name="FirstGoal">The first counted goal (event time); null without one.</param>
    public record MatchSignal(TableMatchStatus Status, bool Linked, DateTimeOffset StartedAt, DateTimeOffset? EndedAt,
        DateTimeOffset LastActivityAt, DateTimeOffset? FirstGoal, DateTimeOffset? LastGoal, int ScoreA, int ScoreB);

    /// <param name="Match">The table's newest match.</param>
    /// <param name="RosterSize">2 × the league's team size; null when the table can't scan.</param>
    /// <param name="LastPlayed">The table's last counted goal ever.</param>
    public record Signals(List<DeviceSignal> Devices, MatchSignal? Match, int RosterCount, DateTimeOffset? RosterFirst,
        DateTimeOffset? RosterNewest, int? RosterSize, DateTimeOffset? LastPlayed);

    public static bool IsOut(DeviceSignal d, DateTimeOffset now) =>
        d.LastSeenAt is not { } seen || seen < now - Out ||
        d.LastStatusReason is "cutoff" or "wrong_board" && d.LastStatusAt >= seen - SameRequest;

    private static bool IsAwake(DeviceSignal d, DateTimeOffset now) =>
        !IsOut(d, now) && (d.LastStatusAt is not { } status || status < d.LastSeenAt - SameRequest || d.LastStatusReason == "beam") &&
        d.LastSeenAt >= now - AwakeWindow(d.Role);

    public static TableOccupancyResponse Classify(Signals s, DateTimeOffset now)
    {
        var awake = s.Devices.Where(d => IsAwake(d, now)).ToList();
        var boardAwake = awake.Any(d => d.Role == DeviceRole.Scoreboard);
        var m = s.Match;
        var live = m?.Status == TableMatchStatus.Live;
        // The lobby or made teams: no goal yet in the current game.
        var gathering = s.RosterCount > 0 && (m is null || m.Status == TableMatchStatus.Discarded || live && m.FirstGoal is null);

        TableOccupancyResponse Result(OccupancyStatus status, DateTimeOffset? since, OccupancyReason? reason)
        {
            var score = status == OccupancyStatus.JustFinished ||
                        status is OccupancyStatus.InUse or OccupancyStatus.ProbablyInUse && live && m!.FirstGoal is not null;
            var lineUp = gathering && status == OccupancyStatus.InUse;
            return new TableOccupancyResponse
            {
                Status = status,
                Since = since,
                Reason = reason,
                ScoreA = score ? m!.ScoreA : null,
                ScoreB = score ? m!.ScoreB : null,
                RosterCount = lineUp ? s.RosterCount : null,
                RosterSize = lineUp ? s.RosterSize : null,
            };
        }

        // The earliest evidence, backdated to an awake device's wake when that's at most 15 min before it.
        DateTimeOffset Since(params DateTimeOffset?[] evidence)
        {
            var start = evidence.Where(e => e is not null).Min()!.Value;
            var wake = awake.Select(d => d.AwakeSince).Where(a => a >= start - Backdate).Min();
            return wake < start ? wake.Value : start;
        }

        if (!s.Devices.Any(d => d.Role == DeviceRole.Goal) || s.Devices.All(d => IsOut(d, now)))
        {
            return Result(OccupancyStatus.Unknown, null,
                !s.Devices.Any(d => d.Role == DeviceRole.Goal) ? OccupancyReason.NoDevices
                : s.Devices.Any(d => d.LowBatt || d.LastStatusReason == "cutoff") ? OccupancyReason.LowBattery
                : OccupancyReason.Offline);
        }

        if (live && m!.FirstGoal is { } firstGoal && m.LastActivityAt >= now - PlayWindow)
        {
            return Result(OccupancyStatus.InUse, Since(firstGoal), OccupancyReason.Game);
        }

        var teamsMade = live && m!.Linked && m.FirstGoal is null;
        if (gathering && (s.RosterNewest >= now - Gathering || boardAwake))
        {
            return Result(OccupancyStatus.InUse, Since(s.RosterFirst, teamsMade ? m!.StartedAt : null),
                teamsMade ? OccupancyReason.TeamsMade : OccupancyReason.Gathering);
        }

        if (teamsMade && m!.StartedAt >= now - Gathering && boardAwake)
        {
            return Result(OccupancyStatus.InUse, Since(m.StartedAt), OccupancyReason.TeamsMade);
        }

        if (m is { Status: TableMatchStatus.Finished or TableMatchStatus.Submitted, LastGoal: { } lastGoal } &&
            lastGoal >= now - JustFinished && awake.Count > 0)
        {
            return Result(OccupancyStatus.JustFinished, m.EndedAt ?? lastGoal, null);
        }

        if (live && m!.LastActivityAt >= now - LongPause && awake.Count > 0)
        {
            return Result(OccupancyStatus.ProbablyInUse, Since(m.FirstGoal ?? m.StartedAt), OccupancyReason.LongPause);
        }

        if (awake.Where(d => d.Role == DeviceRole.Scoreboard).Select(d => d.AwakeSince).Min() is { } boardSince &&
            boardSince < now - (IdleTimeout + Slack))
        {
            return Result(OccupancyStatus.ProbablyInUse, boardSince, OccupancyReason.DevicesAwake);
        }

        return Result(OccupancyStatus.Free, s.LastPlayed, awake.Count > 0 ? OccupancyReason.Touched : null);
    }

    // ponytail: a handful of queries per table, run for every table in GET tables (polled every 15 s by open
    // overview pages). Fine for an office's few tables; batch the queries per org if that ever shows.
    public static async Task<TableOccupancyResponse> LoadAsync(ApiDbContext dbContext, FoosballTable table,
        DateTimeOffset now)
    {
        var devices = (await dbContext.Devices.AsNoTracking()
                .Where(d => d.TableId == table.Id && d.Claimed)
                .Select(d => new { d.Role, d.LastSeenAt, d.LastStatusAt, d.LastStatus, d.AwakeSince, d.LowBatt })
                .ToListAsync())
            .Select(d => new DeviceSignal(d.Role, d.LastSeenAt, d.LastStatusAt, StatusReason(d.LastStatus), d.AwakeSince, d.LowBatt))
            .ToList();

        var match = await dbContext.TableMatches.AsNoTracking()
            .Include(m => m.Goals.Where(g => g.UndoneAt == null && g.OrphanReason == null))
            .Where(m => m.TableId == table.Id)
            .OrderByDescending(m => m.StartedAt).ThenByDescending(m => m.CreatedAt)
            .FirstOrDefaultAsync();
        var counted = match is null ? [] : TableMatchStats.Counted(match.Goals);

        var roster = await dbContext.TableRosterEntries.AsNoTracking().Where(e => e.TableId == table.Id)
            .GroupBy(e => e.TableId)
            .Select(g => new { Count = g.Count(), First = g.Min(e => e.CreatedAt), Newest = g.Max(e => e.CreatedAt) })
            .FirstOrDefaultAsync();
        var teamSize = await dbContext.Leagues.Where(l => l.Id == table.LeagueId).Select(l => (int?)l.TeamSize).FirstOrDefaultAsync();
        var lastPlayed = await dbContext.TableGoals.AsNoTracking()
            .Where(g => g.TableId == table.Id && g.TableMatchId != null && g.UndoneAt == null && g.OrphanReason == null)
            .MaxAsync(g => (DateTimeOffset?)g.ReceivedAt);

        return Classify(new Signals(devices,
            match is null
                ? null
                : new MatchSignal(match.Status, match.ActiveMatchId is not null, match.StartedAt, match.EndedAt,
                    match.LastActivityAt, counted.Count > 0 ? TableMatchStats.EventTime(counted[0]) : null,
                    counted.Count > 0 ? TableMatchStats.EventTime(counted[^1]) : null, match.ScoreA, match.ScoreB),
            roster?.Count ?? 0, roster?.First, roster?.Newest, teamSize * 2, lastPlayed), now);
    }

    public static string? StatusReason(string? lastStatus)
    {
        if (lastStatus is null)
        {
            return null;
        }

        try
        {
            using var json = JsonDocument.Parse(lastStatus);
            return json.RootElement.TryGetProperty("reason", out var reason) ? reason.GetString() : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
