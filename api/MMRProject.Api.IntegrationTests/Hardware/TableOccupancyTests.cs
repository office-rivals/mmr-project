using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Services.V3;
using static MMRProject.Api.Services.V3.TableOccupancy;

namespace MMRProject.Api.IntegrationTests.Hardware;

/// <summary>hardware/analytics/METRICS.md §8.2 (occupancy) and §8.3–8.4 (busy intervals, stats maths).</summary>
public class TableOccupancyTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 15, 12, 0, 0, TimeSpan.Zero);
    private static DateTimeOffset Ago(double minutes) => Now.AddMinutes(-minutes);

    /// <summary>Awake since <paramref name="since"/> minutes, last request <paramref name="seen"/> minutes ago.</summary>
    private static DeviceSignal Awake(DeviceRole role, double since, double seen = 0.1) =>
        new(role, Ago(seen), null, null, Ago(since), false);

    private static DeviceSignal Asleep(DeviceRole role) => new(role, Ago(30), Ago(29), "sleep", null, false);

    private static MatchSignal Live(double firstGoal, double lastActivity, bool linked = false) =>
        new(TableMatchStatus.Live, linked, Ago(firstGoal + 1), null, Ago(lastActivity), Ago(firstGoal), Ago(lastActivity), 3, 2);

    private static TableOccupancyResponse Of(List<DeviceSignal> devices, MatchSignal? match = null, int roster = 0,
        double rosterFirst = 0, double rosterNewest = 0) =>
        Classify(new Signals(devices, match, roster, roster > 0 ? Ago(rosterFirst) : null,
            roster > 0 ? Ago(rosterNewest) : null, 4, Ago(120)), Now);

    [Fact]
    public void Unknown_WithoutAGoalCounterOrWithEveryDeviceOut()
    {
        Assert.Equal((OccupancyStatus.Unknown, OccupancyReason.NoDevices),
            (Of([Awake(DeviceRole.Scoreboard, 1)]).Status, Of([Awake(DeviceRole.Scoreboard, 1)]).Reason));
        var silent = new DeviceSignal(DeviceRole.Goal, Ago(37 * 60), Ago(40 * 60), "sleep", null, false);
        Assert.Equal(OccupancyReason.Offline, Of([silent]).Reason);
        var cutOff = new DeviceSignal(DeviceRole.Goal, Ago(10), Ago(10), "cutoff", null, true);
        var out2 = Of([cutOff, silent with { Role = DeviceRole.Scoreboard }]);
        Assert.Equal((OccupancyStatus.Unknown, OccupancyReason.LowBattery, null), (out2.Status, out2.Reason, out2.Since));
        // A live game wins over nothing, even with every device asleep: a goal is evidence on its own.
        Assert.Equal(OccupancyStatus.InUse, Of([Asleep(DeviceRole.Goal)], Live(3, 1)).Status);
    }

    [Fact]
    public void InUse_ALiveGame_SinceBackdatedToAWakeAtMost15MinEarlier()
    {
        var game = Of([Awake(DeviceRole.Scoreboard, 10), Asleep(DeviceRole.Goal)], Live(4, 1));
        Assert.Equal((OccupancyStatus.InUse, OccupancyReason.Game, Ago(10), 3, 2),
            (game.Status, game.Reason, game.Since, game.ScoreA, game.ScoreB));
        // A board left awake by passers-by doesn't backdate it.
        Assert.Equal(Ago(4), Of([Awake(DeviceRole.Scoreboard, 25), Asleep(DeviceRole.Goal)], Live(4, 1)).Since);
    }

    [Fact]
    public void InUse_WhilePlayersGather_OrTeamsAreMade()
    {
        var gathering = Of([Asleep(DeviceRole.Scoreboard), Asleep(DeviceRole.Goal)], roster: 2, rosterFirst: 6, rosterNewest: 3);
        Assert.Equal((OccupancyStatus.InUse, OccupancyReason.Gathering, Ago(6), 2, 4),
            (gathering.Status, gathering.Reason, gathering.Since, gathering.RosterCount, gathering.RosterSize));
        // An old lobby counts only while the board is awake.
        Assert.Equal(OccupancyStatus.Free,
            Of([Asleep(DeviceRole.Scoreboard), Asleep(DeviceRole.Goal)], roster: 2, rosterFirst: 20, rosterNewest: 20).Status);
        Assert.Equal(OccupancyStatus.InUse,
            Of([Awake(DeviceRole.Scoreboard, 21), Asleep(DeviceRole.Goal)], roster: 2, rosterFirst: 20, rosterNewest: 20).Status);

        var teams = new MatchSignal(TableMatchStatus.Live, true, Ago(2), null, Ago(2), null, null, 0, 0);
        var made = Of([Awake(DeviceRole.Scoreboard, 8), Asleep(DeviceRole.Goal)], teams, roster: 4, rosterFirst: 5, rosterNewest: 3);
        Assert.Equal((OccupancyStatus.InUse, OccupancyReason.TeamsMade, Ago(8), null),
            (made.Status, made.Reason, made.Since, made.ScoreA));
    }

    [Fact]
    public void JustFinished_For3MinAfterTheLastGoal_WhileADeviceIsAwake()
    {
        var finished = new MatchSignal(TableMatchStatus.Finished, false, Ago(12), Ago(1.5), Ago(1.5), Ago(11), Ago(2), 10, 7);
        var result = Of([Awake(DeviceRole.Goal, 12, seen: 2)], finished);
        Assert.Equal((OccupancyStatus.JustFinished, Ago(1.5), 10, 7), (result.Status, result.Since, result.ScoreA, result.ScoreB));
        Assert.Equal(OccupancyStatus.Free, Of([Asleep(DeviceRole.Goal)], finished).Status);
        var older = Of([Awake(DeviceRole.Goal, 12, seen: 2)], finished with { LastGoal = Ago(4) });
        Assert.Equal((OccupancyStatus.Free, OccupancyReason.Touched, Ago(120)), (older.Status, older.Reason, older.Since));
    }

    [Fact]
    public void ProbablyInUse_ALongPause_OrABoardAwakeLongerThanABump()
    {
        var pause = Of([Awake(DeviceRole.Goal, 15, seen: 3)], Live(14, 10));
        Assert.Equal((OccupancyStatus.ProbablyInUse, OccupancyReason.LongPause, 3), (pause.Status, pause.Reason, pause.ScoreA));
        Assert.Equal(OccupancyStatus.Free, Of([Awake(DeviceRole.Goal, 22, seen: 3)], Live(25, 20)).Status);

        var kept = Of([Awake(DeviceRole.Scoreboard, 7), Asleep(DeviceRole.Goal)]);
        Assert.Equal((OccupancyStatus.ProbablyInUse, OccupancyReason.DevicesAwake, Ago(7)), (kept.Status, kept.Reason, kept.Since));
        // A bump wakes it for the idle timeout only: free, but someone's nearby.
        Assert.Equal((OccupancyStatus.Free, OccupancyReason.Touched),
            (Of([Awake(DeviceRole.Scoreboard, 3), Asleep(DeviceRole.Goal)]).Status, Of([Awake(DeviceRole.Scoreboard, 3), Asleep(DeviceRole.Goal)]).Reason));
    }

    [Fact]
    public void Awake_EndsWithAStatus_ATimeout_OrAHeartbeat()
    {
        // A heartbeat is a status: the request was the status itself, so not awake.
        var heartbeat = new DeviceSignal(DeviceRole.Scoreboard, Ago(0.1), Ago(0.1), "heartbeat", Ago(0.1), false);
        Assert.Equal((OccupancyStatus.Free, null), (Of([heartbeat, Asleep(DeviceRole.Goal)]).Status, Of([heartbeat, Asleep(DeviceRole.Goal)]).Reason));
        // A board silent for 2 min (lost sleep status) and a goal counter silent for 7 min are asleep.
        Assert.Null(Of([Awake(DeviceRole.Scoreboard, 10, seen: 2), Awake(DeviceRole.Goal, 10, seen: 7)]).Reason);
        Assert.Equal(OccupancyReason.Touched, Of([Awake(DeviceRole.Goal, 10, seen: 5.5)]).Reason);
    }

    [Fact]
    public void BusyIntervals_MergeClipAndDropBumps()
    {
        var t0 = Ago(60);
        var merged = TableUsage.Merge(
        [
            TableUsage.MatchInterval(t0, t0.AddMinutes(8)),
            new TableUsage.Interval(t0.AddMinutes(5), t0.AddMinutes(12)),
            new TableUsage.Interval(t0.AddMinutes(30), t0.AddMinutes(70)),
        ], t0, Now);
        Assert.Equal([(t0, t0.AddMinutes(12)), (t0.AddMinutes(30), Now)], merged.Select(i => (i.Start, i.End)));
        Assert.Null(TableUsage.WakeInterval(t0, t0.AddSeconds(30)));
        Assert.NotNull(TableUsage.WakeInterval(t0, t0.AddMinutes(4)));
    }

    [Fact]
    public void Walk_BucketsByLocalHour_AcrossTheDstChange()
    {
        // Copenhagen springs forward at 01:00 UTC on 2026-03-29: local 02:00 doesn't exist.
        var tz = TimeZoneInfo.FindSystemTimeZoneById("Europe/Copenhagen");
        var byHour = new Dictionary<int, double>();
        TableUsage.Walk(new DateTimeOffset(2026, 3, 29, 0, 30, 0, TimeSpan.Zero), new DateTimeOffset(2026, 3, 29, 2, 30, 20, TimeSpan.Zero),
            tz, (local, minutes) => byHour[local.Hour] = byHour.GetValueOrDefault(local.Hour) + minutes);
        Assert.Equal([1, 3, 4], byHour.Keys.Order());
        Assert.Equal(30, byHour[1], 6);
        Assert.Equal(60, byHour[3], 6);
        Assert.Equal(30 + 1.0 / 3, byHour[4], 6);
        Assert.Equal(6, TableUsage.Weekday(new DateTime(2026, 3, 29))); // a Sunday
        Assert.Equal(new DateOnly(2026, 3, 23), TableUsage.WeekStart(new DateOnly(2026, 3, 29)));
        Assert.True(TableUsage.IsOfficeHour(new DateTime(2026, 10, 15, 8, 0, 0)));
        Assert.False(TableUsage.IsOfficeHour(new DateTime(2026, 10, 15, 18, 0, 0)));
        Assert.False(TableUsage.IsOfficeHour(new DateTime(2026, 10, 17, 12, 0, 0)));
    }

    [Fact]
    public void Wilson_AndPercentiles()
    {
        var (low, high) = TableUsage.Wilson(50, 100);
        Assert.Equal(0.4038, low, 4);
        Assert.Equal(0.5962, high, 4);
        Assert.Equal(0.0, TableUsage.Wilson(0, 10).Low, 6);
        double[] spans = [300, 420, 540, 600, 900];
        Assert.Equal(540, TableUsage.Percentile(spans, 0.5));
        Assert.Equal(420, TableUsage.Percentile(spans, 0.25));
        Assert.Equal(750, TableUsage.Percentile([600, 900], 0.5));
    }
}
