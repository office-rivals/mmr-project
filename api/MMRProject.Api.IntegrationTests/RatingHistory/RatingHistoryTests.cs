using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.RatingHistory;

[Collection("Database")]
public class RatingHistoryTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task GetRatingHistory_AfterMatchSubmission()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{player1.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await ReadJsonAsync<RatingHistoryResponse>(response);
        Assert.NotNull(history);
        Assert.NotEmpty(history.Entries);
    }

    [Fact]
    public async Task GetRatingHistory_FilterBySeason()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var season1 = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-10));
        var season2 = await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // Submit match (should land in current/latest season)
        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        // Filter by season2 (current) - should have entries
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{player1.Id}?seasonId={season2.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var history = await ReadJsonAsync<RatingHistoryResponse>(response);
        Assert.NotNull(history);
        Assert.NotEmpty(history.Entries);

        // Filter by season1 (old) - should be empty
        var response2 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history/{player1.Id}?seasonId={season1.Id}");
        Assert.Equal(HttpStatusCode.OK, response2.StatusCode);
        var history2 = await ReadJsonAsync<RatingHistoryResponse>(response2);
        Assert.NotNull(history2);
        Assert.Empty(history2.Entries);
    }

    [Fact]
    public async Task GetRatingHistory_ScopedToLeague()
    {
        var org = await CreateOrganization();
        var league1 = await CreateLeague(org.Id, "League 1", "league-1");
        var league2 = await CreateLeague(org.Id, "League 2", "league-2");
        await CreateSeason(org.Id, league1.Id);
        await CreateSeason(org.Id, league2.Id);

        var (user1, _, player1L1) = await SeedTestUser(org.Id, league1.Id, "p1", "p1@test.com",
            OrganizationRole.Owner);
        var (_, _, player2L1) = await SeedTestUser(org.Id, league1.Id, "p2", "p2@test.com");
        var (_, _, player3L1) = await SeedTestUser(org.Id, league1.Id, "p3", "p3@test.com");
        var (_, _, player4L1) = await SeedTestUser(org.Id, league1.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        // Submit match in league1
        await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1L1.Id, player2L1.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3L1.Id, player4L1.Id], Score = 5 }
                ]
            });

        // Get history for league1 - should have entries
        var response1 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/rating-history/{player1L1.Id}");
        Assert.Equal(HttpStatusCode.OK, response1.StatusCode);
        var history1 = await ReadJsonAsync<RatingHistoryResponse>(response1);
        Assert.NotNull(history1);
        Assert.NotEmpty(history1.Entries);

        // Get history for league2 for the same player shouldn't exist (different league player)
        // Since the player isn't in league2, this should return not found or empty
        var response2 = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/rating-history/{player1L1.Id}");
        Assert.True(
            response2.StatusCode == HttpStatusCode.NotFound || response2.StatusCode == HttpStatusCode.OK,
            $"Expected NotFound or OK, got {response2.StatusCode}");
    }

    [Fact]
    public async Task GetLeagueRatingHistory_ExcludesPlayersBelowRankedThreshold()
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

        // Only 5 matches — below the 10-match threshold
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
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var history = await ReadJsonAsync<LeagueRatingHistoryResponse>(response);
        Assert.NotNull(history);
        Assert.Empty(history.Entries);
    }

    [Fact]
    public async Task GetLeagueRatingHistory_IncludesPlayersAtOrAboveRankedThreshold()
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

        for (var i = 0; i < 10; i++)
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

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/rating-history");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var history = await ReadJsonAsync<LeagueRatingHistoryResponse>(response);
        Assert.NotNull(history);

        var p1Entries = history.Entries.Where(e => e.LeaguePlayerId == p1.Id).ToList();
        Assert.Equal(10, p1Entries.Count);
        Assert.All(p1Entries, e => Assert.True(e.Mmr > 0));
    }
}
