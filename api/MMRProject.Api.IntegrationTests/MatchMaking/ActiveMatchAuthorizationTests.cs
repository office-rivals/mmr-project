using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.MatchMaking;

[Collection("Database")]
public class ActiveMatchAuthorizationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task NonParticipantMember_CannotCancelActiveMatch()
    {
        var (org, league, activeMatchId) = await CreateActiveMatchAsync();
        await SeedTestUser(org.Id, league.Id, "spectator", "spectator@test.com");

        AuthenticateAs("spectator");

        var response = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches/{activeMatchId}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task NonParticipantMember_CannotSubmitActiveMatchResult()
    {
        var (org, league, activeMatchId) = await CreateActiveMatchAsync();
        await SeedTestUser(org.Id, league.Id, "spectator", "spectator@test.com");

        AuthenticateAs("spectator");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches/{activeMatchId}/submit",
            new SubmitActiveMatchResultRequest
            {
                Teams =
                [
                    new ActiveMatchTeamScoreRequest { TeamIndex = 0, Score = 10 },
                    new ActiveMatchTeamScoreRequest { TeamIndex = 1, Score = 5 }
                ]
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Moderator_CanCancelActiveMatchWithoutBeingParticipant()
    {
        var (org, league, activeMatchId) = await CreateActiveMatchAsync();
        await SeedOrgMember(org.Id, "moderator", "moderator@test.com", OrganizationRole.Moderator);

        AuthenticateAs("moderator");

        var response = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches/{activeMatchId}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    private async Task<(Organization Organization, League League, Guid ActiveMatchId)> CreateActiveMatchAsync()
    {
        var org = await CreateOrganization("Org", Guid.NewGuid().ToString("n")[..8]);
        var league = await CreateLeague(org.Id, "League", Guid.NewGuid().ToString("n")[..8], 4);
        await CreateSeason(org.Id, league.Id);

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            await SeedTestUser(org.Id, league.Id, playerId, $"{playerId}@test.com");
        }

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);
        }

        await RunMatchMakingCycleAsync();

        AuthenticateAs("p1");
        var queueStatusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var queueStatus = await ReadJsonAsync<QueueStatusResponse>(queueStatusResponse);
        var pendingMatchId = queueStatus!.PendingMatch!.Id;

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            var acceptResponse = await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatchId}/accept",
                null);
            Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);
        }

        AuthenticateAs("p1");
        var activeMatchesResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches");
        var activeMatches = await ReadJsonAsync<List<ActiveMatchResponse>>(activeMatchesResponse);

        return (org, league, activeMatches!.Single().Id);
    }
}
