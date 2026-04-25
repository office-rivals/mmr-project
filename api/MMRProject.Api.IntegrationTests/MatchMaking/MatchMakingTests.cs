using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
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
    public async Task PendingMatch_CreatedByCoordinatorWhenQueueFull()
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
        var queuedStatusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var queuedStatus = await ReadJsonAsync<QueueStatusResponse>(queuedStatusResponse);
        Assert.NotNull(queuedStatus);
        Assert.Null(queuedStatus.PendingMatch);

        await RunMatchMakingCycleAsync();

        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        Assert.NotNull(status);
        Assert.NotNull(status.PendingMatch);
        Assert.Equal(AcceptanceStatus.Pending, status.PendingMatch.Status);
        Assert.Equal(2, status.PendingMatch.Teams.Count);
    }

    [Fact]
    public async Task ExpiredPendingMatch_AllPlayersAccepted_DoesNotDecline()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, queueSize: 2);
        var (_, _, player1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com");
        var (_, _, player2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            var pendingMatch = new V3PendingMatch
            {
                OrganizationId = org.Id,
                LeagueId = league.Id,
                Status = AcceptanceStatus.Pending,
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-5),
                Acceptances =
                [
                    new PendingMatchAcceptance
                    {
                        LeaguePlayerId = player1.Id,
                        Status = AcceptanceStatus.Accepted,
                        AcceptedAt = DateTimeOffset.UtcNow,
                    },
                    new PendingMatchAcceptance
                    {
                        LeaguePlayerId = player2.Id,
                        Status = AcceptanceStatus.Accepted,
                        AcceptedAt = DateTimeOffset.UtcNow,
                    },
                ],
            };

            dbContext.V3PendingMatches.Add(pendingMatch);
            dbContext.QueueEntries.AddRange(
                new QueueEntry
                {
                    OrganizationId = org.Id,
                    LeagueId = league.Id,
                    LeaguePlayerId = player1.Id,
                    JoinedAt = DateTimeOffset.UtcNow.AddMinutes(-2),
                },
                new QueueEntry
                {
                    OrganizationId = org.Id,
                    LeagueId = league.Id,
                    LeaguePlayerId = player2.Id,
                    JoinedAt = DateTimeOffset.UtcNow.AddMinutes(-1),
                });
            await dbContext.SaveChangesAsync();
        }

        await RunMatchMakingCycleAsync();

        using var verifyScope = Factory.Services.CreateScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var storedPendingMatch = await verifyDbContext.V3PendingMatches.SingleAsync(pm => pm.LeagueId == league.Id);
        var queuedCount = await verifyDbContext.QueueEntries.CountAsync(q => q.LeagueId == league.Id);

        Assert.Equal(AcceptanceStatus.Pending, storedPendingMatch.Status);
        Assert.Equal(2, queuedCount);
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

        await RunMatchMakingCycleAsync();

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

    [Fact]
    public async Task LeaveQueue_RemovesPlayer()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com");
        AuthenticateAs("p1");

        await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);

        var leaveResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        Assert.Equal(HttpStatusCode.NoContent, leaveResponse.StatusCode);

        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        Assert.NotNull(status);
        Assert.Empty(status.QueuedPlayers);
    }

    [Fact]
    public async Task FullFlow_QueueToActiveToSubmit()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, queueSize: 4);
        await CreateSeason(org.Id, league.Id);

        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com", OrganizationRole.Owner);
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        // All 4 join queue
        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);
        }

        await RunMatchMakingCycleAsync();

        // Get pending match
        AuthenticateAs("p1");
        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        Assert.NotNull(status?.PendingMatch);
        var pendingMatchId = status.PendingMatch.Id;

        // All 4 accept
        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            var acceptResp = await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatchId}/accept",
                null);
            Assert.Equal(HttpStatusCode.OK, acceptResp.StatusCode);
        }

        // Should now have an active match
        AuthenticateAs("p1");
        var activeResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches");
        Assert.Equal(HttpStatusCode.OK, activeResponse.StatusCode);
        var activeMatches = await ReadJsonAsync<List<ActiveMatchResponse>>(activeResponse);
        Assert.NotNull(activeMatches);
        Assert.Single(activeMatches);
        var activeMatchId = activeMatches[0].Id;

        // Submit result
        var submitResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches/{activeMatchId}/submit",
            new SubmitActiveMatchResultRequest
            {
                Teams =
                [
                    new ActiveMatchTeamScoreRequest { TeamIndex = 0, Score = 10 },
                    new ActiveMatchTeamScoreRequest { TeamIndex = 1, Score = 5 }
                ]
            });
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);
        var match = await ReadJsonAsync<MatchResponse>(submitResponse);
        Assert.NotNull(match);
        Assert.Equal(MatchSource.Matchmaking, match.Source);
    }

    [Fact]
    public async Task CancelActiveMatch_Succeeds()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, queueSize: 4);
        await CreateSeason(org.Id, league.Id);

        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com", OrganizationRole.Owner);
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, _) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue", null);
        }

        await RunMatchMakingCycleAsync();

        AuthenticateAs("p1");
        var statusResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var status = await ReadJsonAsync<QueueStatusResponse>(statusResponse);
        var pendingMatchId = status!.PendingMatch!.Id;

        foreach (var playerId in new[] { "p1", "p2", "p3", "p4" })
        {
            AuthenticateAs(playerId);
            await Client.PostAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatchId}/accept",
                null);
        }

        AuthenticateAs("p1");
        var activeResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches");
        var activeMatches = await ReadJsonAsync<List<ActiveMatchResponse>>(activeResponse);
        var activeMatchId = activeMatches![0].Id;

        var cancelResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches/{activeMatchId}");
        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

        var afterResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches");
        var afterMatches = await ReadJsonAsync<List<ActiveMatchResponse>>(afterResponse);
        Assert.NotNull(afterMatches);
        Assert.Empty(afterMatches);
    }
}
