using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Statistics;

[Collection("Database")]
public class TimeDistributionTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetTimeDistribution_ReturnsBucketsByDayAndHour()
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

        for (var i = 0; i < 3; i++)
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
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/statistics/time-distribution");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await ReadJsonAsync<TimeDistributionResponse>(response);
        Assert.NotNull(result);
        Assert.NotEmpty(result.Entries);

        // All 3 matches were submitted in the same minute, so they should bucket together
        var totalCount = result.Entries.Sum(e => e.Count);
        Assert.Equal(3, totalCount);

        Assert.All(result.Entries, e =>
        {
            Assert.InRange(e.DayOfWeek, 0, 6);
            Assert.InRange(e.HourOfDay, 0, 23);
            Assert.True(e.Count > 0);
        });
    }

    [Fact]
    public async Task GetTimeDistribution_ScopedToLeagueAndSeason()
    {
        var org = await CreateOrganization();
        var league1 = await CreateLeague(org.Id, "League 1", "league-1");
        var league2 = await CreateLeague(org.Id, "League 2", "league-2");
        await CreateSeason(org.Id, league1.Id);
        await CreateSeason(org.Id, league2.Id);

        var (_, _, p1L1) = await SeedTestUser(org.Id, league1.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, p2L1) = await SeedTestUser(org.Id, league1.Id, "p2", "p2@test.com");
        var (_, _, p3L1) = await SeedTestUser(org.Id, league1.Id, "p3", "p3@test.com");
        var (_, _, p4L1) = await SeedTestUser(org.Id, league1.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1L1.Id, p2L1.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3L1.Id, p4L1.Id], Score = 5 }
                ]
            });

        var league1Resp = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/statistics/time-distribution");
        var league1Stats = await ReadJsonAsync<TimeDistributionResponse>(league1Resp);
        Assert.NotNull(league1Stats);
        Assert.Equal(1, league1Stats.Entries.Sum(e => e.Count));

        var league2Resp = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/statistics/time-distribution");
        var league2Stats = await ReadJsonAsync<TimeDistributionResponse>(league2Resp);
        Assert.NotNull(league2Stats);
        Assert.Empty(league2Stats.Entries);
    }
}
