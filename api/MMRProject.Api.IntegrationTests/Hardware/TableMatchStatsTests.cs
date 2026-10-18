using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.Hardware;

/// <summary>The worked example of hardware/analytics/METRICS.md §7 (numbers from its example.py).</summary>
public class TableMatchStatsTests
{
    private static readonly Guid Alice = Guid.NewGuid(), Bob = Guid.NewGuid(), Carol = Guid.NewGuid(), Dave = Guid.NewGuid();
    private static readonly IReadOnlyList<IReadOnlyList<Guid>> Teams = [new[] { Alice, Bob }, new[] { Carol, Dave }];

    // Counted goals in order (the undone double count left out): credited team (0 = A) and scorer.
    private static readonly List<TableMatchStats.Goal> Goals = new (int Team, Guid? Scorer)[]
    {
        (1, Carol), (1, Dave), (0, Alice), (1, Carol), (1, Carol), (1, null), (0, Bob), (0, Dave), (0, Alice),
        (1, Dave), (0, Alice), (0, Alice), (0, null), (1, Carol), (1, Carol), (0, Bob), (0, Alice), (1, Dave), (0, Bob),
    }.Select(g => new TableMatchStats.Goal(g.Team, g.Scorer)).ToList();

    private static Task<Dictionary<Guid, (double Mu, double Sigma)>> Ratings() => Task.FromResult(
        new Dictionary<Guid, (double, double)> { [Alice] = (27, 3), [Bob] = (24, 4), [Carol] = (28, 3), [Dave] = (26, 3.5) });

    [Fact]
    public async Task WorkedExample_ContributionImpactAndMvp()
    {
        var contribution = TableMatchStats.Contribution(Teams, Goals);
        Assert.Equal([1.5, -0.5, 1.0, -2.0], new[] { Alice, Bob, Carol, Dave }.Select(p => Math.Round(contribution[p], 9)));

        var rating = await Ratings();
        var p0 = TableMatchStats.PredictWin(Teams.Select(t => t.Select(pl => rating[pl]).ToList()).ToList());
        var p = TableMatchStats.GoalProbability(p0, 10);
        var impact = TableMatchStats.Contribution(Teams, Goals, TableMatchStats.GoalValues(Goals, p, 10));
        Assert.Equal([0.265, 0.366, -0.217, -0.414], new[] { Alice, Bob, Carol, Dave }.Select(pl => Math.Round(impact[pl], 3)));
        // A team's impact sums to its result minus its pre-match expectation (A won).
        Assert.Equal(1 - p0, impact[Alice] + impact[Bob], 6);

        Assert.Equal(Alice, await TableMatchStats.MvpAsync(Teams, Goals, 10, Ratings));
    }

    [Fact]
    public async Task Mvp_NeedsScorers_TwoPlayersASide_AndBreaksTiesOnImpact()
    {
        var unknown = Goals.Select((g, i) => i < 6 ? g with { Scorer = null } : g).ToList(); // 11/19 known
        Assert.Null(await TableMatchStats.MvpAsync(Teams, unknown, 10, Ratings));
        Assert.Null(await TableMatchStats.MvpAsync([new[] { Alice }, new[] { Carol }], [new(0, Alice)], 10, Ratings));

        // Alice and Bob both score 5 in a 10:0 (tied on contribution). In a blowout the early goals move the
        // win chance most (Alice 0.486 vs Bob 0.145 by example.py's maths), so Alice wins on impact.
        var tied = Enumerable.Range(0, 10).Select(i => new TableMatchStats.Goal(0, i < 5 ? Alice : Bob)).ToList();
        Assert.Equal(Alice, await TableMatchStats.MvpAsync(Teams, tied, 10, Ratings));
        Assert.Null(await TableMatchStats.MvpAsync(Teams, tied, null, Ratings));
    }
}
