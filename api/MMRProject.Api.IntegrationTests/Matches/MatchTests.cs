using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Matches;

[Collection("Database")]
public class MatchTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task SubmitMatch_CreatesTeamsAndRatingHistory()
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

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest
                        { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest
                        { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var match = await response.Content.ReadFromJsonAsync<MatchResponse>();
        Assert.NotNull(match);
        Assert.Equal(2, match.Teams.Count);
        Assert.Equal(MatchSource.Manual, match.Source);

        var winnerTeam = match.Teams.First(t => t.Score == 10);
        Assert.True(winnerTeam.IsWinner);
    }

    [Fact]
    public async Task GetMatches_ReturnsLeagueScopedResults()
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

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league1.Id}/matches");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var matches = await response.Content.ReadFromJsonAsync<List<MatchResponse>>();
        Assert.NotNull(matches);
        Assert.Single(matches);
        Assert.Equal(league1.Id, matches[0].LeagueId);

        var emptyResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league2.Id}/matches");
        var emptyMatches = await emptyResponse.Content.ReadFromJsonAsync<List<MatchResponse>>();
        Assert.NotNull(emptyMatches);
        Assert.Empty(emptyMatches);
    }

    [Fact]
    public async Task DeleteMatch_AsModerator_Succeeds()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Moderator);
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, player3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, player4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var submitResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [player1.Id, player2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [player3.Id, player4.Id], Score = 5 }
                ]
            });
        submitResponse.EnsureSuccessStatusCode();
        var match = await submitResponse.Content.ReadFromJsonAsync<MatchResponse>();

        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{match!.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{match.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }
}
