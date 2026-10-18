using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.Services.V3;

/// <summary>
/// Goal-timeline statistics of a table match, as defined in <c>hardware/analytics/METRICS.md</c> (a port of
/// its reference <c>example.py</c>). Pure functions, so the scoreboard, the app and the stats pages compute
/// them the same way.
/// </summary>
public static class TableMatchStats
{
    /// <summary>A counted goal: the credited team's index (0 = end A) and the scorer, if picked.</summary>
    public record Goal(int Team, Guid? Scorer);

    private const double MvpMinCoverage = 0.7;
    private const double Epsilon = 1e-9;
    private static readonly TimeSpan MaxGap = TimeSpan.FromMinutes(5);

    // OpenSkill's beta² for the default mu = 25, sigma = 25/3 (go-openskill rating/predict.go).
    private const double Beta2 = 25.0 / 6 * (25.0 / 6);

    /// <summary>§1.4: the device time unless it's unsynced or runs ahead, else the server's receipt time.</summary>
    public static DateTimeOffset EventTime(TableGoal goal) =>
        goal.OccurredAt is { } occurred && goal.ReceivedAt - occurred >= TimeSpan.FromSeconds(-2)
            ? occurred
            : goal.ReceivedAt;

    /// <summary>§1.3–1.4: goals that count (not undone, not orphans), in event-time order.</summary>
    public static List<TableGoal> Counted(IEnumerable<TableGoal> goals) =>
        goals.Where(g => g.UndoneAt == null && g.OrphanReason == null)
            .OrderBy(EventTime).ThenBy(g => g.DeviceId).ThenBy(g => g.Seq).ThenBy(g => g.ReceivedAt)
            .ToList();

    /// <summary>T1: first to last counted goal, each gap capped at 5 min (a pause). Null below 2 goals.</summary>
    public static int? SpanSeconds(IReadOnlyList<TableGoal> counted)
    {
        if (counted.Count < 2)
        {
            return null;
        }

        var span = counted.Zip(counted.Skip(1), (a, b) => EventTime(b) - EventTime(a))
            .Sum(gap => Math.Min(gap.TotalSeconds, MaxGap.TotalSeconds));
        return (int)Math.Round(Math.Max(0, span));
    }

    /// <summary>
    /// §4.1 contribution score: each goal +1 for the credited team, −1 for the conceding one. A picked scorer
    /// takes the +1, an own goal puts the −1 on its scorer alone, everything else is shared equally.
    /// With <paramref name="values"/> (C5 impact) a goal is worth its value instead of 1.
    /// </summary>
    /// <param name="teams">Players by team index (0 = end A).</param>
    public static Dictionary<Guid, double> Contribution(IReadOnlyList<IReadOnlyList<Guid>> teams,
        IReadOnlyList<Goal> goals, IReadOnlyList<double>? values = null)
    {
        var credit = teams.SelectMany(t => t).Distinct().ToDictionary(p => p, _ => 0.0);
        void Share(IReadOnlyList<Guid> team, double value)
        {
            foreach (var player in team)
            {
                credit[player] += value / team.Count;
            }
        }

        for (var i = 0; i < goals.Count; i++)
        {
            var value = values?[i] ?? 1.0;
            var credited = teams[goals[i].Team];
            var conceding = teams[1 - goals[i].Team];
            var scorer = goals[i].Scorer is { } s && credit.ContainsKey(s) ? s : (Guid?)null;
            var ownGoal = scorer is { } o && conceding.Contains(o);

            if (scorer is { } x && !ownGoal) credit[x] += value;
            else Share(credited, value);

            if (ownGoal) credit[scorer!.Value] -= value;
            else Share(conceding, -value);
        }

        return credit;
    }

    /// <summary>
    /// §4.2 top contributor: the highest contribution, on a tie the higher impact (C5), still tied → null.
    /// 2v2 only, and only when at least 70 % of the counted goals have a known scorer (own goals included).
    /// </summary>
    /// <param name="ratings">Pre-match (mu, sigma) per player; only loaded on a tie.</param>
    public static async Task<Guid?> MvpAsync(IReadOnlyList<IReadOnlyList<Guid>> teams, IReadOnlyList<Goal> goals,
        int? winningScore, Func<Task<Dictionary<Guid, (double Mu, double Sigma)>>> ratings)
    {
        if (teams.Count != 2 || teams.Any(t => t.Count != 2) || goals.Count == 0)
        {
            return null;
        }

        var players = teams.SelectMany(t => t).ToHashSet();
        if (goals.Count(g => g.Scorer is { } s && players.Contains(s)) < MvpMinCoverage * goals.Count)
        {
            return null;
        }

        var top = Leaders(Contribution(teams, goals), players);
        if (top.Count == 1 || winningScore is not { } target)
        {
            return top.Count == 1 ? top[0] : null;
        }

        var rating = await ratings();
        var p = GoalProbability(PredictWin(teams.Select(t => t.Select(pl => rating[pl]).ToList()).ToList()), target);
        var top2 = Leaders(Contribution(teams, goals, GoalValues(goals, p, target)), top);
        return top2.Count == 1 ? top2[0] : null;
    }

    private static List<Guid> Leaders(Dictionary<Guid, double> scores, IReadOnlyCollection<Guid> among)
    {
        var best = among.Max(p => scores[p]);
        return among.Where(p => scores[p] > best - Epsilon).ToList();
    }

    /// <summary>C5: each goal's value, how much it moved the credited team's chance to win (Appendix A1).</summary>
    public static List<double> GoalValues(IReadOnlyList<Goal> goals, double p, int winningScore)
    {
        var (a, b) = (0, 0);
        var values = new List<double>();
        foreach (var goal in goals)
        {
            var before = RaceWin(a, b, p, winningScore);
            (a, b) = goal.Team == 0 ? (a + 1, b) : (a, b + 1);
            values.Add(Math.Abs(RaceWin(a, b, p, winningScore) - before));
        }

        return values;
    }

    /// <summary>A2: OpenSkill's PredictWin for team 0 against team 1.</summary>
    public static double PredictWin(IReadOnlyList<IReadOnlyList<(double Mu, double Sigma)>> teams) =>
        Phi((teams[0].Sum(r => r.Mu) - teams[1].Sum(r => r.Mu)) /
            Math.Sqrt(2 * Beta2 + teams[0].Sum(r => r.Sigma * r.Sigma) + teams[1].Sum(r => r.Sigma * r.Sigma)));

    /// <summary>A1: chance team 0 reaches <paramref name="winningScore"/> first from a:b, each goal theirs with p.</summary>
    public static double RaceWin(int a, int b, double p, int winningScore)
    {
        if (a >= winningScore) return 1;
        if (b >= winningScore) return 0;
        int need = winningScore - a, other = winningScore - b;
        double sum = 0, ways = 1; // C(need − 1 + k, k)
        for (var k = 0; k < other; k++)
        {
            if (k > 0) ways = ways * (need - 1 + k) / k;
            sum += ways * Math.Pow(p, need) * Math.Pow(1 - p, k);
        }

        return sum;
    }

    /// <summary>A2: the per-goal probability whose race to the winning score equals the win probability.</summary>
    public static double GoalProbability(double win, int winningScore)
    {
        double lo = 1e-6, hi = 1 - 1e-6;
        for (var i = 0; i < 60; i++)
        {
            var mid = (lo + hi) / 2;
            if (RaceWin(0, 0, mid, winningScore) < win) lo = mid;
            else hi = mid;
        }

        return (lo + hi) / 2;
    }

    // Standard normal CDF; erf by Abramowitz–Stegun 7.1.26 (error < 1.5e-7, plenty for a tie-break).
    private static double Phi(double x)
    {
        var z = Math.Abs(x) / Math.Sqrt(2);
        var t = 1 / (1 + 0.3275911 * z);
        var erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t *
            Math.Exp(-z * z);
        return 0.5 * (1 + (x < 0 ? -erf : erf));
    }
}
