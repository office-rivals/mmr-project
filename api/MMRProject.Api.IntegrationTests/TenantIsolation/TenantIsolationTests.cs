using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.TenantIsolation;

[Collection("Database")]
public class TenantIsolationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task OrgA_DataNotVisibleInOrgB()
    {
        var orgA = await CreateOrganization("Org A", "org-a");
        var orgB = await CreateOrganization("Org B", "org-b");

        var leagueA = await CreateLeague(orgA.Id, "League A", "league-a");
        var leagueB = await CreateLeague(orgB.Id, "League B", "league-b");

        var (_, _, pA1) = await SeedTestUser(orgA.Id, leagueA.Id, "userA-1", "a1@test.com");
        var (_, _, pA2) = await SeedTestUser(orgA.Id, leagueA.Id, "userA-2", "a2@test.com");
        var (_, _, pB1) = await SeedTestUser(orgB.Id, leagueB.Id, "userB-1", "b1@test.com");

        // User from org B should not see org A's leagues
        AuthenticateAs("userB-1");
        var leaguesResponse = await Client.GetAsync($"api/v3/organizations/{orgA.Id}/leagues");
        Assert.Equal(HttpStatusCode.Forbidden, leaguesResponse.StatusCode);

        // User from org A should see org A's leaderboard
        AuthenticateAs("userA-1");
        var leaderboardA = await Client.GetAsync(
            $"api/v3/organizations/{orgA.Id}/leagues/{leagueA.Id}/leaderboard");
        Assert.Equal(HttpStatusCode.OK, leaderboardA.StatusCode);
        var lbA = await ReadJsonAsync<LeaderboardResponse>(leaderboardA);
        Assert.NotNull(lbA);
        Assert.Equal(2, lbA.Entries.Count);
    }

    [Fact]
    public async Task CrossLeagueIsolation_WithinSameOrg()
    {
        var org = await CreateOrganization("Multi League Org", "ml-org");
        var league1 = await CreateLeague(org.Id, "League 1", "league-1");
        var league2 = await CreateLeague(org.Id, "League 2", "league-2");

        await CreateSeason(org.Id, league1.Id);
        await CreateSeason(org.Id, league2.Id);

        var (_, _, p1L1) = await SeedTestUser(org.Id, league1.Id, "user-1", "u1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2L1) = await SeedTestUser(org.Id, league1.Id, "user-2", "u2@test.com");
        var (_, _, p3L1) = await SeedTestUser(org.Id, league1.Id, "user-3", "u3@test.com");
        var (_, _, p4L1) = await SeedTestUser(org.Id, league1.Id, "user-4", "u4@test.com");

        // Only user-5 is in league2
        var (_, _, p1L2) = await SeedTestUser(org.Id, league2.Id, "user-5", "u5@test.com");

        AuthenticateAs("user-1");

        // Submit a match in league1
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1L1.Id, p2L1.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3L1.Id, p4L1.Id], Score = 5 }
                ]
            });
        matchResponse.EnsureSuccessStatusCode();

        // League2's matches should be empty
        AuthenticateAs("user-5");
        var league2Matches = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/matches");
        Assert.Equal(HttpStatusCode.OK, league2Matches.StatusCode);
        var matches = await ReadJsonAsync<List<MatchResponse>>(league2Matches);
        Assert.NotNull(matches);
        Assert.Empty(matches);

        // League2's leaderboard should only have one player
        var league2Lb = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/leaderboard");
        var lb = await ReadJsonAsync<LeaderboardResponse>(league2Lb);
        Assert.NotNull(lb);
        Assert.Single(lb.Entries);
    }
}
