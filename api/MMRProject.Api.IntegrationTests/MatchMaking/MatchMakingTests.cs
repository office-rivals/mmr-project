using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.MatchMaking;

[Collection("Database")]
public class MatchMakingTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task JoinQueue_VerifyStatus()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com");
        AuthenticateAs("p1");

        var joinResponse = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        Assert.NotNull(status);
        Assert.Single(status.QueuedPlayers);
    }

    [Fact]
    public async Task PendingMatch_CreatedWhenQueueFull()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, queueSize: 4);

        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);
        }

        AuthenticateAs("p1");
        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        Assert.NotNull(status);
        Assert.NotNull(status.PendingMatch);
        Assert.Equal(AcceptanceStatus.Pending, status.PendingMatch.Status);
        Assert.Equal(2, status.PendingMatch.Teams.Count);
    }

    [Fact]
    public async Task AcceptDeclineFlow()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, queueSize: 4);

        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);
        }

        AuthenticateAs("p1");
        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        var pendingMatchId = status!.PendingMatch!.Id;

        // p1 accepts
        var acceptResponse = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatchId}/accept",
            null);
        Assert.Equal(HttpStatusCode.OK, acceptResponse.StatusCode);

        // p2 declines
        AuthenticateAs("p2");
        var declineResponse = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatchId}/decline",
            null);
        Assert.Equal(HttpStatusCode.OK, declineResponse.StatusCode);

        // Check the pending match is now declined
        AuthenticateAs("p1");
        var matchStatus = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatchId}");
        var matchResult = await ReadJsonAsync<PendingMatchResponse>(matchStatus);
        Assert.NotNull(matchResult);
        Assert.Equal(AcceptanceStatus.Declined, matchResult.Status);
    }
}
