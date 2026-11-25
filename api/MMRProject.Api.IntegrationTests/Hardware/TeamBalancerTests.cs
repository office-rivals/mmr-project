using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.Hardware;

public class TeamBalancerTests
{
    [Fact]
    public void RandomSplit_IsTwoHalves_AndEverySplitAboutEquallyLikely()
    {
        var players = Enumerable.Range(1, 4).Select(i => new LeaguePlayer { Id = Guid.NewGuid(), Mmr = i }).ToList();
        const int runs = 6000;
        var counts = new Dictionary<string, int>();
        for (var i = 0; i < runs; i++)
        {
            var teams = TeamBalancer.RandomSplit(players);
            Assert.Equal([2, 2], teams.Select(t => t.Count));
            Assert.Equal(players.ToHashSet(), teams.SelectMany(t => t).ToHashSet());
            // Which pair is at end A: 6 equally likely outcomes, ~1000 each (σ ≈ 29).
            var key = string.Join(",", teams[0].Select(p => p.Mmr).Order());
            counts[key] = counts.GetValueOrDefault(key) + 1;
        }

        Assert.Equal(6, counts.Count);
        Assert.All(counts.Values, c => Assert.InRange(c, 850, 1150));
    }
}
