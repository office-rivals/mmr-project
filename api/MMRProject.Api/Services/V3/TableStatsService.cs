using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;

namespace MMRProject.Api.Services.V3;

public interface ITableStatsService
{
    /// <summary>TS1–TS7 of analytics/METRICS.md §8.4 in office-rivals/mmr-hardware for one table.</summary>
    Task<TableStatsResponse> GetTableStatsAsync(Guid orgId, Guid tableId, DateTimeOffset? from, DateTimeOffset? to, string? tz);

    /// <summary>Every table's headline numbers, the combined heatmap and TS8.</summary>
    Task<TablesStatsOverviewResponse> GetOverviewAsync(Guid orgId, DateTimeOffset? from, DateTimeOffset? to, string? tz);
}

/// <summary>Busy intervals (§8.3) and their bucketing by local time. Pure, so the tests can pin them.</summary>
public static class TableUsage
{
    public record Interval(DateTimeOffset Start, DateTimeOffset End);

    /// <summary>The office hours utilisation is measured against (§8.3 default): Mon–Fri 08:00–18:00 local.</summary>
    public static bool IsOfficeHour(DateTime local) =>
        local.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday) && local.Hour is >= 8 and < 18;

    private static readonly TimeSpan GameMargin = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan Bump = TimeSpan.FromSeconds(60);

    /// <summary>v1: a match with a counted goal was busy from 60 s before its first goal to 60 s after its last.</summary>
    public static Interval MatchInterval(DateTimeOffset firstGoal, DateTimeOffset lastGoal) =>
        new(firstGoal - GameMargin, lastGoal + GameMargin);

    /// <summary>v2: a device wake, unless it's a bump (under 60 s of use).</summary>
    // ponytail: §8.3 keeps a short wake that had a goal; its goal's v1 interval covers that time anyway.
    public static Interval? WakeInterval(DateTimeOffset wokeAt, DateTimeOffset idleFrom) =>
        idleFrom - wokeAt < Bump ? null : new Interval(wokeAt, idleFrom);

    /// <summary>The union, sorted and clipped to [from, to).</summary>
    public static List<Interval> Merge(IEnumerable<Interval> intervals, DateTimeOffset from, DateTimeOffset to)
    {
        var merged = new List<Interval>();
        foreach (var i in intervals.Select(i => new Interval(i.Start < from ? from : i.Start, i.End > to ? to : i.End))
                     .Where(i => i.End > i.Start).OrderBy(i => i.Start))
        {
            if (merged.Count > 0 && i.Start <= merged[^1].End)
            {
                merged[^1] = merged[^1] with { End = i.End > merged[^1].End ? i.End : merged[^1].End };
            }
            else
            {
                merged.Add(i);
            }
        }

        return merged;
    }

    /// <summary>
    /// Calls <paramref name="add"/> with the local time of each minute slice of [start, end) and its length in
    /// minutes, so buckets follow the zone's own hours (DST included).
    /// </summary>
    public static void Walk(DateTimeOffset start, DateTimeOffset end, TimeZoneInfo tz, Action<DateTime, double> add)
    {
        var t = start;
        while (t < end)
        {
            var next = new DateTimeOffset(t.UtcTicks - t.UtcTicks % TimeSpan.TicksPerMinute, TimeSpan.Zero).AddMinutes(1);
            if (next > end) next = end;
            add(TimeZoneInfo.ConvertTime(t, tz).DateTime, (next - t).TotalMinutes);
            t = next;
        }
    }

    /// <summary>Monday-first weekday index 0–6.</summary>
    public static int Weekday(DateTime local) => ((int)local.DayOfWeek + 6) % 7;

    /// <summary>The Monday of the local date's ISO week.</summary>
    public static DateOnly WeekStart(DateOnly date) => date.AddDays(-Weekday(date.ToDateTime(TimeOnly.MinValue)));

    /// <summary>Linear-interpolated percentile (0–1) of sorted values.</summary>
    public static double Percentile(IReadOnlyList<double> sorted, double p)
    {
        var rank = p * (sorted.Count - 1);
        var lo = (int)Math.Floor(rank);
        var hi = Math.Min(lo + 1, sorted.Count - 1);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
    }

    /// <summary>A3: Wilson score interval (95 %) for <paramref name="k"/> of <paramref name="n"/>.</summary>
    public static (double Low, double High) Wilson(int k, int n)
    {
        const double z = 1.96;
        var p = (double)k / n;
        var centre = (p + z * z / (2 * n)) / (1 + z * z / n);
        var half = z * Math.Sqrt(p * (1 - p) / n + z * z / (4.0 * n * n)) / (1 + z * z / n);
        return (centre - half, centre + half);
    }
}

public class TableStatsService(ApiDbContext dbContext, IConfiguration configuration) : ITableStatsService
{
    private static readonly TimeSpan DefaultWindow = TimeSpan.FromDays(30);
    private static readonly TimeSpan FastGap = TimeSpan.FromSeconds(3);

    private TimeSpan ClaimWindow => TimeSpan.FromDays(configuration.GetValue("Hardware:ClaimWindowDays", 7));

    private sealed record Window(DateTimeOffset From, DateTimeOffset To, TimeZoneInfo Tz, DateTimeOffset Now)
    {
        public DateOnly LocalDate(DateTimeOffset t) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(t, Tz).DateTime);

        /// <summary>The ISO weeks (local Mondays) that lie wholly inside the window.</summary>
        public int FullWeeks(IEnumerable<DateOnly> weekStarts) => weekStarts.Count(IsFullWeek);

        public bool IsFullWeek(DateOnly monday) =>
            Start(monday) >= From && Start(monday.AddDays(7)) <= To;

        private DateTimeOffset Start(DateOnly date)
        {
            var local = date.ToDateTime(TimeOnly.MinValue);
            return new DateTimeOffset(local, Tz.GetUtcOffset(local));
        }
    }

    private sealed record Game(TableMatch Match, List<TableGoal> Counted, DateOnly Day, bool Submitted, bool Linked,
        bool ReachedWinningScore, DateTimeOffset? EndedAt);

    private sealed record TableData(FoosballTable Table, List<TableMatch> Matches, List<Game> Games,
        List<TableUsage.Interval> Busy, bool HasWakes, DateTimeOffset? FirstGoalEver);

    public async Task<TableStatsResponse> GetTableStatsAsync(Guid orgId, Guid tableId, DateTimeOffset? from,
        DateTimeOffset? to, string? tz)
    {
        var window = ResolveWindow(from, to, tz);
        var table = await dbContext.FoosballTables.AsNoTracking()
                        .FirstOrDefaultAsync(t => t.Id == tableId && t.OrganizationId == orgId)
                    ?? throw new NotFoundException("Table not found");
        var data = await LoadAsync(table, window);
        var minutes = Bucket(data.Busy, window);
        var games = data.Games;
        var weeks = Weeks(window, games, minutes);
        var fullWeeks = weeks.Count(w => w.FullWeek);

        // TS5: games whose claim window has closed.
        var closed = games.Where(g => g.Submitted || g.EndedAt < window.Now - ClaimWindow).ToList();
        StatValue ClaimRate(IEnumerable<Game> set, int minN)
        {
            var list = set.ToList();
            return Stat(list.Count == 0 ? null : (double)list.Count(g => g.Submitted) / list.Count, list.Count, minN);
        }

        // TS6: goals credited to end A, over the window's games.
        var goals = games.SelectMany(g => g.Counted).ToList();
        var endA = goals.Count(g => g.ScoringEnd == TableEnd.A);
        var wilson = goals.Count > 0 ? TableUsage.Wilson(endA, goals.Count) : ((double, double)?)null;

        return new TableStatsResponse
        {
            TableId = table.Id,
            From = window.From,
            To = window.To,
            TimeZone = window.Tz.Id,
            OfficeHours = OfficeHours,
            Games = Stat(games.Count, games.Count, 1),
            AverageGamesPerWeek = AverageGamesPerWeek(weeks),
            GamesPerDay = GamesPerDay(window, games),
            Weeks = weeks,
            BusyHours = Heatmap(minutes.Cells, minutes.Hours, games.Count, 30, data.FirstGoalEver, window),
            MatchDurationS = MatchDuration(games),
            Utilisation = Stat(minutes.OfficeMinutes > 0 ? minutes.BusyOfficeMinutes / minutes.OfficeMinutes : null,
                fullWeeks, 1),
            UtilisationIsLowerBound = !data.HasWakes,
            ClaimRate = ClaimRate(closed, 20),
            ClaimRateLinked = ClaimRate(closed.Where(g => g.Linked), 20),
            ClaimRateUnlinked = ClaimRate(closed.Where(g => !g.Linked), 20),
            EndBias = Stat(goals.Count > 0 ? (double)endA / goals.Count : null, games.Count, 30) with
            {
                Low = wilson?.Item1,
                High = wilson?.Item2,
            },
            DataQuality = await DataQualityAsync(data, window),
        };
    }

    public async Task<TablesStatsOverviewResponse> GetOverviewAsync(Guid orgId, DateTimeOffset? from,
        DateTimeOffset? to, string? tz)
    {
        var window = ResolveWindow(from, to, tz);
        var tables = await dbContext.FoosballTables.AsNoTracking().Where(t => t.OrganizationId == orgId)
            .OrderBy(t => t.Name).ToListAsync();
        var thisWeek = TableUsage.WeekStart(window.LocalDate(window.Now));

        var rows = new List<TableStatsSummary>();
        var all = new List<(TableData Data, Buckets Minutes)>();
        foreach (var table in tables)
        {
            var data = await LoadAsync(table, window);
            var minutes = Bucket(data.Busy, window);
            all.Add((data, minutes));
            var fullWeeks = Weeks(window, data.Games, minutes).Count(w => w.FullWeek);
            rows.Add(new TableStatsSummary
            {
                TableId = table.Id,
                Name = table.Name,
                Occupancy = await TableOccupancy.LoadAsync(dbContext, table, window.Now),
                Games = Stat(data.Games.Count, data.Games.Count, 1),
                GamesThisWeek = data.Games.Count(g => TableUsage.WeekStart(g.Day) == thisWeek),
                Utilisation = Stat(minutes.OfficeMinutes > 0 ? minutes.BusyOfficeMinutes / minutes.OfficeMinutes : null,
                    fullWeeks, 1),
                UtilisationIsLowerBound = !data.HasWakes,
                MatchDurationS = MatchDuration(data.Games),
            });
        }

        // The combined heatmap: busy minutes summed over the tables ÷ 60 = tables busy on average.
        var hours = Bucket([], window).Hours;
        var combined = new double[7, 24];
        foreach (var (_, minutes) in all)
        {
            for (var d = 0; d < 7; d++)
            for (var h = 0; h < 24; h++)
                combined[d, h] += minutes.Cells[d, h] / 60;
        }

        var games = all.Sum(a => a.Data.Games.Count);
        var firstEver = all.Select(a => a.Data.FirstGoalEver).Where(f => f is not null).Min();
        return new TablesStatsOverviewResponse
        {
            From = window.From,
            To = window.To,
            TimeZone = window.Tz.Id,
            OfficeHours = OfficeHours,
            Tables = rows,
            Games = Stat(games, games, 1),
            BusyTables = Heatmap(combined, hours, games, 30, firstEver, window, perHour: false),
            AllTablesBusy = AllTablesBusy(all.Select(a => a.Data.Busy).ToList(), window),
        };
    }

    private static readonly OfficeHoursResponse OfficeHours = new()
    {
        Days = ["mon", "tue", "wed", "thu", "fri"],
        Start = "08:00",
        End = "18:00",
    };

    private static Window ResolveWindow(DateTimeOffset? from, DateTimeOffset? to, string? tz)
    {
        TimeZoneInfo zone;
        try
        {
            zone = TimeZoneInfo.FindSystemTimeZoneById(string.IsNullOrWhiteSpace(tz) ? "UTC" : tz);
        }
        catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            throw new InvalidArgumentException($"Unknown time zone '{tz}' (use an IANA name such as Europe/Copenhagen)");
        }

        var now = DateTimeOffset.UtcNow;
        var end = to ?? now;
        var start = from ?? end - DefaultWindow;
        if (start >= end || end - start > TimeSpan.FromDays(366))
        {
            throw new InvalidArgumentException("'from' must be before 'to', at most a year apart");
        }

        return new Window(start, end, zone, now);
    }

    private async Task<TableData> LoadAsync(FoosballTable table, Window window)
    {
        // Matches that can have goals in the window (a game is at most a few hours long).
        var matches = await dbContext.TableMatches.AsNoTracking().Include(m => m.Goals)
            .Where(m => m.TableId == table.Id && m.StartedAt < window.To && m.LastActivityAt >= window.From.AddHours(-6))
            .ToListAsync();
        // Each match's league (rated, else linked, else the table's default) decides its winning score.
        var matchIds = matches.Select(m => m.MatchId).OfType<Guid>().ToList();
        var activeIds = matches.Select(m => m.ActiveMatchId).OfType<Guid>().ToList();
        var ratedLeague = await dbContext.Set<V3Match>().Where(m => matchIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, m => m.LeagueId);
        var linkedLeague = await dbContext.V3ActiveMatches.Where(am => activeIds.Contains(am.Id))
            .ToDictionaryAsync(am => am.Id, am => am.LeagueId);
        var winningScores = await dbContext.Leagues.Where(l => l.OrganizationId == table.OrganizationId)
            .ToDictionaryAsync(l => l.Id, l => l.WinningScore);
        int? WinningScore(TableMatch m) =>
            (m.MatchId is { } id && ratedLeague.TryGetValue(id, out var rated) ? rated
                : m.ActiveMatchId is { } am && linkedLeague.TryGetValue(am, out var linked) ? linked
                : table.LeagueId) is { } leagueId
                ? winningScores.GetValueOrDefault(leagueId)
                : null;

        var games = new List<Game>();
        var busy = new List<TableUsage.Interval>();
        foreach (var match in matches)
        {
            var counted = TableMatchStats.Counted(match.Goals);
            if (counted.Count == 0)
            {
                continue;
            }

            var first = TableMatchStats.EventTime(counted[0]);
            busy.Add(TableUsage.MatchInterval(first, TableMatchStats.EventTime(counted[^1])));
            var reached = WinningScore(match) is { } target && Math.Max(match.ScoreA, match.ScoreB) >= target;
            // §8.4: a game is a submitted match, or a finished unclaimed one with ≥ 5 goals or a winner.
            var isGame = match.Status == TableMatchStatus.Submitted ||
                         match.Status == TableMatchStatus.Finished && (counted.Count >= 5 || reached);
            if (isGame && first >= window.From && first < window.To)
            {
                games.Add(new Game(match, counted, window.LocalDate(first), match.Status == TableMatchStatus.Submitted,
                    match.ActiveMatchId is not null, reached, match.EndedAt));
            }
        }

        var wakes = await dbContext.DeviceWakes.AsNoTracking()
            .Where(w => w.TableId == table.Id && w.WokeAt < window.To && w.IdleFrom > window.From)
            .Select(w => new { w.WokeAt, w.IdleFrom }).ToListAsync();
        busy.AddRange(wakes.Select(w => TableUsage.WakeInterval(w.WokeAt, w.IdleFrom)).OfType<TableUsage.Interval>());
        var hasWakes = await dbContext.DeviceWakes.AnyAsync(w => w.TableId == table.Id && w.WokeAt < window.To);

        var firstGoalEver = await dbContext.TableGoals.AsNoTracking()
            .Where(g => g.TableId == table.Id && g.TableMatchId != null && g.UndoneAt == null && g.OrphanReason == null)
            .MinAsync(g => (DateTimeOffset?)g.ReceivedAt);

        return new TableData(table, matches, games, TableUsage.Merge(busy, window.From, window.To), hasWakes, firstGoalEver);
    }

    /// <param name="Cells">Busy minutes per weekday (Mon first) and local hour.</param>
    /// <param name="Hours">How many of each weekday-hour the window holds.</param>
    private sealed record Buckets(double[,] Cells, double[,] Hours, double OfficeMinutes, double BusyOfficeMinutes,
        Dictionary<DateOnly, (double Office, double Busy)> ByWeek);

    private static Buckets Bucket(List<TableUsage.Interval> busy, Window window)
    {
        var cells = new double[7, 24];
        var hours = new double[7, 24];
        var byWeek = new Dictionary<DateOnly, (double Office, double Busy)>();
        double office = 0, busyOffice = 0;
        TableUsage.Walk(window.From, window.To, window.Tz, (local, minutes) =>
        {
            hours[TableUsage.Weekday(local), local.Hour] += minutes / 60;
            if (TableUsage.IsOfficeHour(local))
            {
                office += minutes;
                var week = TableUsage.WeekStart(DateOnly.FromDateTime(local));
                byWeek[week] = (byWeek.GetValueOrDefault(week).Office + minutes, byWeek.GetValueOrDefault(week).Busy);
            }
        });
        foreach (var interval in busy)
        {
            TableUsage.Walk(interval.Start, interval.End, window.Tz, (local, minutes) =>
            {
                cells[TableUsage.Weekday(local), local.Hour] += minutes;
                if (TableUsage.IsOfficeHour(local))
                {
                    busyOffice += minutes;
                    var week = TableUsage.WeekStart(DateOnly.FromDateTime(local));
                    byWeek[week] = (byWeek.GetValueOrDefault(week).Office, byWeek.GetValueOrDefault(week).Busy + minutes);
                }
            });
        }

        return new Buckets(cells, hours, office, busyOffice, byWeek);
    }

    private static StatValue Stat(double? value, int n, int minN) =>
        new() { Value = value, N = n, MinN = minN, Enough = n >= minN };

    private static List<TableDayGames> GamesPerDay(Window window, List<Game> games)
    {
        var days = new List<TableDayGames>();
        for (var day = window.LocalDate(window.From); day <= window.LocalDate(window.To.AddTicks(-1)); day = day.AddDays(1))
        {
            var on = games.Where(g => g.Day == day).ToList();
            days.Add(new TableDayGames
            {
                Date = day.ToString("yyyy-MM-dd"),
                Games = on.Count,
                Submitted = on.Count(g => g.Submitted),
                Unclaimed = on.Count(g => !g.Submitted),
            });
        }

        return days;
    }

    private static List<TableWeekStats> Weeks(Window window, List<Game> games, Buckets minutes)
    {
        var weeks = new List<TableWeekStats>();
        for (var monday = TableUsage.WeekStart(window.LocalDate(window.From));
             monday <= window.LocalDate(window.To.AddTicks(-1));
             monday = monday.AddDays(7))
        {
            var on = games.Where(g => TableUsage.WeekStart(g.Day) == monday).ToList();
            var (office, busy) = minutes.ByWeek.GetValueOrDefault(monday);
            weeks.Add(new TableWeekStats
            {
                WeekStart = monday.ToString("yyyy-MM-dd"),
                FullWeek = window.IsFullWeek(monday),
                Games = on.Count,
                Submitted = on.Count(g => g.Submitted),
                Unclaimed = on.Count(g => !g.Submitted),
                Utilisation = office > 0 ? busy / office : null,
            });
        }

        return weeks;
    }

    /// <summary>TS1 trend base: the mean games of the window's full weeks (show a trend from 4 of them).</summary>
    private static StatValue AverageGamesPerWeek(List<TableWeekStats> weeks)
    {
        var full = weeks.Where(w => w.FullWeek).ToList();
        return Stat(full.Count > 0 ? full.Average(w => w.Games) : null, full.Count, 4);
    }

    /// <summary>TS2: the average per weekday-hour. Enough with ≥ <paramref name="minGames"/> games and 4 weeks of data.</summary>
    private static TableHeatmap Heatmap(double[,] cells, double[,] hours, int games, int minGames,
        DateTimeOffset? firstGoalEver, Window window, bool perHour = true)
    {
        var grid = Enumerable.Range(0, 7)
            .Select(d => Enumerable.Range(0, 24).Select(h => hours[d, h] > 0 ? cells[d, h] / hours[d, h] : 0).ToList())
            .ToList();
        var dataSince = firstGoalEver > window.From ? firstGoalEver.Value : window.From;
        var weeksOfData = Math.Max(0, (window.To - dataSince).TotalDays / 7);
        return new TableHeatmap
        {
            Values = grid,
            Unit = perHour ? "busy_minutes" : "busy_tables",
            N = games,
            MinN = minGames,
            WeeksOfData = Math.Round(weeksOfData, 1),
            Enough = games >= minGames && weeksOfData >= 4,
        };
    }

    /// <summary>TS3: median T1 of the games that reached the winning score, with the 25th–75th percentiles.</summary>
    private static StatValue MatchDuration(List<Game> games)
    {
        var spans = games.Where(g => g.ReachedWinningScore)
            .Select(g => TableMatchStats.SpanSeconds(g.Counted)).OfType<int>().Select(s => (double)s).Order().ToList();
        return spans.Count == 0
            ? Stat(null, 0, 10)
            : Stat(TableUsage.Percentile(spans, 0.5), spans.Count, 10) with
            {
                Low = TableUsage.Percentile(spans, 0.25),
                High = TableUsage.Percentile(spans, 0.75),
            };
    }

    /// <summary>TS8: the share of office minutes when every table was busy at once, and the longest such stretch.</summary>
    private static AllTablesBusyResponse AllTablesBusy(List<List<TableUsage.Interval>> tables, Window window)
    {
        var weeks = new HashSet<DateOnly>();
        TableUsage.Walk(window.From, window.To, window.Tz, (local, _) => weeks.Add(TableUsage.WeekStart(DateOnly.FromDateTime(local))));
        var fullWeeks = window.FullWeeks(weeks);
        var enough = tables.Count >= 2 && fullWeeks >= 2;

        // Intersect the tables' busy intervals.
        var common = tables.Count == 0 ? [] : tables[0];
        foreach (var next in tables.Skip(1))
        {
            common = common.SelectMany(a => next
                    .Where(b => b.Start < a.End && a.Start < b.End)
                    .Select(b => new TableUsage.Interval(a.Start > b.Start ? a.Start : b.Start, a.End < b.End ? a.End : b.End)))
                .ToList();
        }

        double office = 0, allBusy = 0;
        TableUsage.Walk(window.From, window.To, window.Tz, (local, minutes) => office += TableUsage.IsOfficeHour(local) ? minutes : 0);
        foreach (var interval in common)
        {
            TableUsage.Walk(interval.Start, interval.End, window.Tz,
                (local, minutes) => allBusy += TableUsage.IsOfficeHour(local) ? minutes : 0);
        }

        return new AllTablesBusyResponse
        {
            Share = new StatValue
            {
                Value = tables.Count >= 2 && office > 0 ? allBusy / office : null,
                N = fullWeeks,
                MinN = 2,
                Enough = enough,
            },
            LongestS = tables.Count >= 2 && common.Count > 0
                ? (int)Math.Round(common.Max(i => (i.End - i.Start).TotalSeconds))
                : null,
        };
    }

    /// <summary>TS7: per goal counter undo and fast-gap rates, orphans, fragments and scorer picks.</summary>
    private async Task<TableDataQuality> DataQualityAsync(TableData data, Window window)
    {
        var inWindow = data.Matches.SelectMany(m => m.Goals)
            .Where(g => g.ReceivedAt >= window.From && g.ReceivedAt < window.To).ToList();
        var devices = await dbContext.Devices.AsNoTracking()
            .Where(d => d.TableId == data.Table.Id && d.Claimed)
            .Select(d => new { d.Id, d.HardwareId, d.Role, d.End, d.LowBatt, d.LastSeenAt, d.LastStatusAt, d.LastStatus })
            .ToListAsync();

        var deviceQuality = devices.OrderBy(d => d.Role).ThenBy(d => d.End).Select(d =>
        {
            var own = inWindow.Where(g => g.DeviceId == d.Id).OrderBy(TableMatchStats.EventTime).ToList();
            var counted = own.Where(g => g.UndoneAt == null && g.OrphanReason == null).ToList();
            var fast = counted.Zip(counted.Skip(1)).Count(p => p.First.TableMatchId == p.Second.TableMatchId &&
                                                              TableMatchStats.EventTime(p.Second) - TableMatchStats.EventTime(p.First) < FastGap);
            return new TableDeviceQuality
            {
                DeviceId = d.HardwareId,
                Role = d.Role,
                End = d.End,
                Goals = own.Count,
                UndoRate = Stat(own.Count > 0 ? (double)own.Count(g => g.UndoneAt != null) / own.Count : null, own.Count, 30),
                FastGapRate = Stat(counted.Count > 1 ? (double)fast / (counted.Count - 1) : null, own.Count, 30),
                LowBatt = d.LowBatt,
                Out = TableOccupancy.IsOut(new TableOccupancy.DeviceSignal(d.Role, d.LastSeenAt, d.LastStatusAt,
                    TableOccupancy.StatusReason(d.LastStatus), null, d.LowBatt), window.Now),
            };
        }).ToList();

        var orphans = await dbContext.TableGoals.AsNoTracking()
            .Where(g => g.TableId == data.Table.Id && g.OrphanReason != null && g.ReceivedAt >= window.From && g.ReceivedAt < window.To)
            .GroupBy(g => g.OrphanReason).Select(g => new { Reason = g.Key, Count = g.Count() }).ToListAsync();

        // Played but not games: fragments (finished, unclaimed, too short) and discarded matches with a goal.
        var played = data.Matches.Where(m => TableMatchStats.Counted(m.Goals) is { Count: > 0 } c &&
                                             TableMatchStats.EventTime(c[0]) >= window.From && TableMatchStats.EventTime(c[0]) < window.To)
            .ToList();
        var gameIds = data.Games.Select(g => g.Match.Id).ToHashSet();
        var linkedGoals = data.Games.Where(g => g.Linked).SelectMany(g => g.Counted).ToList();
        var weeks = Math.Max(1, (window.To - window.From).TotalDays / 7);

        return new TableDataQuality
        {
            Devices = deviceQuality,
            OrphansOtherTable = orphans.FirstOrDefault(o => o.Reason == OrphanReason.OtherTable)?.Count ?? 0,
            OrphansNoMatch = orphans.FirstOrDefault(o => o.Reason == OrphanReason.NoMatch)?.Count ?? 0,
            FragmentsPerWeek = played.Count(m => m.Status == TableMatchStatus.Finished && !gameIds.Contains(m.Id)) / weeks,
            DiscardedPerWeek = played.Count(m => m.Status == TableMatchStatus.Discarded) / weeks,
            ScorerPickRate = Stat(linkedGoals.Count > 0
                ? (double)linkedGoals.Count(g => g.ScorerLeaguePlayerId != null) / linkedGoals.Count
                : null, linkedGoals.Count, 30),
        };
    }
}
