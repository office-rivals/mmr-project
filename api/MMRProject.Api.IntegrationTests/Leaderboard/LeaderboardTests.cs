using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Leaderboard;

[Collection("Database")]
public class LeaderboardTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Leaderboard_ReturnsRankedPlayersForLeague()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com");
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");

        AuthenticateAs("p1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var leaderboard = await ReadJsonAsync<LeaderboardResponse>(response);
        Assert.NotNull(leaderboard);
        Assert.Equal(3, leaderboard.Entries.Count);
        Assert.All(leaderboard.Entries, e => Assert.True(e.Rank > 0));
    }

    [Fact]
    public async Task Leaderboard_IsScopedToLeague()
    {
        var org = await CreateOrganization();
        var league1 = await CreateLeague(org.Id, "League 1", "league-1");
        var league2 = await CreateLeague(org.Id, "League 2", "league-2");

        var (_, _, p1L1) = await SeedTestUser(org.Id, league1.Id, "p1", "p1@test.com");
        var (_, _, p2L1) = await SeedTestUser(org.Id, league1.Id, "p2", "p2@test.com");
        // p1 also exists in league2 via SeedTestUser (different league player entry needed)
        var (_, _, p1L2) = await SeedTestUser(org.Id, league2.Id, "p3", "p3@test.com");

        AuthenticateAs("p1");

        var response1 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/leaderboard");
        var lb1 = await ReadJsonAsync<LeaderboardResponse>(response1);
        Assert.NotNull(lb1);
        Assert.Equal(2, lb1.Entries.Count);

        AuthenticateAs("p3");

        var response2 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/leaderboard");
        var lb2 = await ReadJsonAsync<LeaderboardResponse>(response2);
        Assert.NotNull(lb2);
        Assert.Single(lb2.Entries);
    }
}
