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
        // No matches yet → all players are unranked (rank 0, mmr null).
        Assert.All(leaderboard.Entries, e => Assert.Null(e.Mmr));
        Assert.All(leaderboard.Entries, e => Assert.Equal(0, e.Rank));
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

    [Fact]
    public async Task Leaderboard_IncludesWinsLossesAndStreaks()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // p1+p2 win 3 in a row against p3+p4 (current winning streak = 3 for p1, losing streak = 3 for p3)
        for (var i = 0; i < 3; i++)
        {
            var resp = await Client.PostAsJsonAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
                new SubmitMatchRequest
                {
                    Teams =
                    [
                        new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                        new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = i }
                    ]
                });
            Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        }

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var lb = await ReadJsonAsync<LeaderboardResponse>(response);
        Assert.NotNull(lb);

        var p1Entry = lb.Entries.Single(e => e.LeaguePlayerId == p1.Id);
        Assert.Equal(3, p1Entry.Wins);
        Assert.Equal(0, p1Entry.Losses);
        Assert.Equal(3, p1Entry.WinningStreak);
        Assert.Equal(0, p1Entry.LosingStreak);

        var p3Entry = lb.Entries.Single(e => e.LeaguePlayerId == p3.Id);
        Assert.Equal(0, p3Entry.Wins);
        Assert.Equal(3, p3Entry.Losses);
        Assert.Equal(0, p3Entry.WinningStreak);
        Assert.Equal(3, p3Entry.LosingStreak);
    }

    [Fact]
    public async Task Leaderboard_MmrIsNullForPlayersBelowRankedThreshold()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // 5 matches < 10-match threshold, so MMR should be null for all participants
        for (var i = 0; i < 5; i++)
        {
            await Client.PostAsJsonAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
                new SubmitMatchRequest
                {
                    Teams =
                    [
                        new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                        new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = i }
                    ]
                });
        }

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");
        var lb = await ReadJsonAsync<LeaderboardResponse>(response);
        Assert.NotNull(lb);

        var p1Entry = lb.Entries.Single(e => e.LeaguePlayerId == p1.Id);
        Assert.Null(p1Entry.Mmr);
        Assert.Equal(0, p1Entry.Rank); // unranked
        Assert.Equal(5, p1Entry.Wins);
    }

    [Fact]
    public async Task Leaderboard_FiltersBySeason()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var pastSeason = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddMonths(-6));
        var currentSeason = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // 12 matches in current season — enough for ranked
        for (var i = 0; i < 12; i++)
        {
            await Client.PostAsJsonAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
                new SubmitMatchRequest
                {
                    Teams =
                    [
                        new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                        new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = i % 9 }
                    ]
                });
        }

        var currentResp = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard?seasonId={currentSeason.Id}");
        var currentLb = await ReadJsonAsync<LeaderboardResponse>(currentResp);
        Assert.NotNull(currentLb);
        var p1Current = currentLb.Entries.Single(e => e.LeaguePlayerId == p1.Id);
        Assert.NotNull(p1Current.Mmr);
        Assert.Equal(12, p1Current.Wins);

        var pastResp = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard?seasonId={pastSeason.Id}");
        var pastLb = await ReadJsonAsync<LeaderboardResponse>(pastResp);
        Assert.NotNull(pastLb);
        // No matches in the past season — entries shouldn't exist for it
        Assert.DoesNotContain(pastLb.Entries, e => e.LeaguePlayerId == p1.Id);
    }
}
