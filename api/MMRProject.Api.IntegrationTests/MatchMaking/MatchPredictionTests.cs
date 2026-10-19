using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.MatchMaking;

[Collection("Database")]
public class MatchPredictionTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private static readonly string[] Players = ["p1", "p2", "p3", "p4"];

    [Fact]
    public async Task PendingMatch_IncludesPrediction()
    {
        var (org, league) = await SetupLeagueAsync();
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var status = await GetQueueStatusAsync(org.Id, league.Id);
        var pendingMatch = status.PendingMatch!;

        AssertPredictionCovers(pendingMatch.Teams, pendingMatch.Prediction);

        var byIdResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/pending-matches/{pendingMatch.Id}");
        var byId = await ReadJsonAsync<PendingMatchResponse>(byIdResponse);
        Assert.Equivalent(pendingMatch.Prediction, byId!.Prediction, strict: true);
    }

    [Fact]
    public async Task ActiveMatch_IncludesPrediction_AndAsksTheMmrApiOnce()
    {
        var (org, league) = await SetupLeagueAsync();
        await QueueAndMatchAsync(org.Id, league.Id);
        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;
        await AcceptAllAsync(org.Id, league.Id, pending.Id);

        AuthenticateAs("p1");
        var status = await GetQueueStatusAsync(org.Id, league.Id);
        var activeMatches = await GetActiveMatchesAsync(org.Id, league.Id);
        await GetQueueStatusAsync(org.Id, league.Id);

        AssertPredictionCovers(status.ActiveMatch!.Teams, status.ActiveMatch.Prediction);
        var listed = Assert.Single(activeMatches);
        Assert.Equivalent(status.ActiveMatch.Prediction, listed.Prediction, strict: true);
        Assert.Equivalent(pending.Prediction, listed.Prediction, strict: true);
        // Polling the same match, pending or active, reuses the first answer.
        Assert.Equal(1, Factory.StubMmrCalculationApiClient.PredictCallCount);
    }

    [Fact]
    public async Task Prediction_IsNull_WhenTheMmrApiFails()
    {
        var (org, league) = await SetupLeagueAsync();
        Factory.StubMmrCalculationApiClient.ThrowOnPredict = true;
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var statusResponse = await Client.GetAsync($"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        Assert.Equal(HttpStatusCode.OK, statusResponse.StatusCode);
        var status = (await ReadJsonAsync<QueueStatusResponse>(statusResponse))!;
        Assert.NotNull(status.PendingMatch);
        Assert.Null(status.PendingMatch.Prediction);

        await AcceptAllAsync(org.Id, league.Id, status.PendingMatch.Id);
        AuthenticateAs("p1");
        var active = Assert.Single(await GetActiveMatchesAsync(org.Id, league.Id));
        Assert.Null(active.Prediction);
        Assert.Null((await GetQueueStatusAsync(org.Id, league.Id)).ActiveMatch!.Prediction);
        // A failure is not retried on every poll.
        Assert.Equal(1, Factory.StubMmrCalculationApiClient.PredictCallCount);
    }

    [Fact]
    public async Task Prediction_IsNull_WithoutACurrentSeason()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 2);
        foreach (var player in Players)
        {
            await SeedTestUser(org.Id, league.Id, player, $"{player}@test.com");
        }
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var status = await GetQueueStatusAsync(org.Id, league.Id);

        Assert.NotNull(status.PendingMatch);
        Assert.Null(status.PendingMatch.Prediction);
    }

    [Fact]
    public async Task Prediction_AgreesWithTheSubmittedResult()
    {
        var (org, league) = await SetupLeagueAsync();
        var placed = await PlaySeasonMatchesAsync(org.Id, league.Id, Placement.MatchCount);
        await QueueAndMatchAsync(org.Id, league.Id);
        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;
        await AcceptAllAsync(org.Id, league.Id, pending.Id);

        AuthenticateAs("p1");
        var active = Assert.Single(await GetActiveMatchesAsync(org.Id, league.Id));
        var prediction = active.Prediction!;
        var predictRequest = Factory.StubMmrCalculationApiClient.PredictRequests.Last();
        var mmrBefore = await LoadMmrAsync(prediction.Teams.SelectMany(t => t.Players).Select(p => p.LeaguePlayerId));

        var submitResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches/{active.Id}/submit",
            new SubmitActiveMatchResultRequest
            {
                Teams =
                [
                    new ActiveMatchTeamScoreRequest { TeamIndex = 0, Score = 10 },
                    new ActiveMatchTeamScoreRequest { TeamIndex = 1, Score = 4 },
                ],
            });
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);
        var match = (await ReadJsonAsync<MatchResponse>(submitResponse))!;

        // The result was rated from exactly the inputs the prediction used,
        // including which players start from last season's rating.
        var calculationRequest = Factory.StubMmrCalculationApiClient.Requests.Last();
        Assert.Equivalent(predictRequest.Team1.Players, calculationRequest.Team1.Players, strict: true);
        Assert.Equivalent(predictRequest.Team2.Players, calculationRequest.Team2.Players, strict: true);
        var startsFromReset = predictRequest.Team1.Players.Concat(predictRequest.Team2.Players)
            .Count(p => p.IsPreviousSeasonRating == true);
        Assert.Equal(2, startsFromReset);

        var mmrAfter = await LoadMmrAsync(mmrBefore.Keys);
        var deltas = match.Teams.SelectMany(t => t.Players).ToDictionary(p => p.LeaguePlayerId, p => p.RatingDelta);
        foreach (var team in prediction.Teams)
        {
            var won = team.Index == 0;
            foreach (var player in team.Players)
            {
                if (!placed.Contains(player.LeaguePlayerId))
                {
                    AssertHidden(player);
                    continue;
                }

                var predicted = won ? player.MmrIfWin : player.MmrIfLose;
                Assert.Equal(mmrBefore[player.LeaguePlayerId], player.Mmr);
                Assert.Equal(predicted, mmrAfter[player.LeaguePlayerId]);
                Assert.Equal(predicted - player.Mmr, deltas[player.LeaguePlayerId]);
                Assert.True(player.MmrIfWin > player.Mmr, "a win raises MMR");
                Assert.True(player.MmrIfLose < player.Mmr, "a loss lowers MMR");
            }
        }
    }

    [Fact]
    public async Task Prediction_HidesMmr_UntilAPlayerHasPlacedThisSeason()
    {
        var (org, league) = await SetupLeagueAsync();
        await PlaySeasonMatchesAsync(org.Id, league.Id, Placement.MatchCount - 1);
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var pendingMatch = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;

        // The odds still show; only the MMRs that would reveal a placement
        // match's change are withheld.
        AssertPredictionCovers(pendingMatch.Teams, pendingMatch.Prediction);
        Assert.All(pendingMatch.Prediction!.Teams.SelectMany(t => t.Players), AssertHidden);
    }

    private static void AssertPredictionCovers(List<PendingMatchTeamResponse> teams, MatchPredictionResponse? prediction)
    {
        Assert.NotNull(prediction);
        Assert.Equal(teams.Select(t => t.Index), prediction.Teams.Select(t => t.Index));
        foreach (var team in teams)
        {
            var predicted = prediction.Teams.Single(t => t.Index == team.Index);
            Assert.Equal(
                team.Players.Select(p => p.LeaguePlayerId).Order(),
                predicted.Players.Select(p => p.LeaguePlayerId).Order());
        }
        Assert.Equal(1.0, prediction.Teams.Sum(t => t.WinChance), precision: 9);
    }

    private static void AssertHidden(PlayerPredictionResponse player)
    {
        Assert.Null(player.Mmr);
        Assert.Null(player.MmrIfWin);
        Assert.Null(player.MmrIfLose);
    }

    private async Task<(Organization Org, League League)> SetupLeagueAsync()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 2);
        await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-1));
        foreach (var player in Players)
        {
            await SeedTestUser(org.Id, league.Id, player, $"{player}@test.com",
                player == "p1" ? OrganizationRole.Owner : OrganizationRole.Member);
        }
        return (org, league);
    }

    // Two of the four play manual matches first, so the matchmade result mixes
    // players with a rating this season and players on their first match.
    private async Task<HashSet<Guid>> PlaySeasonMatchesAsync(Guid orgId, Guid leagueId, int count)
    {
        var (_, _, p1) = await GetPlayerAsync("p1");
        var (_, _, p2) = await GetPlayerAsync("p2");
        var (_, _, extra1) = await SeedTestUser(orgId, leagueId, "x1", "x1@test.com");
        var (_, _, extra2) = await SeedTestUser(orgId, leagueId, "x2", "x2@test.com");

        AuthenticateAs("p1");
        for (var i = 0; i < count; i++)
        {
            // Each score differs, or the duplicate-submission guard would reject it.
            var response = await Client.PostAsJsonAsync(
                $"api/v3/organizations/{orgId}/leagues/{leagueId}/matches",
                new SubmitMatchRequest
                {
                    Teams =
                    [
                        new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                        new SubmitMatchTeamRequest { Players = [extra1.Id, extra2.Id], Score = i },
                    ],
                });
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }
        return [p1.Id, p2.Id];
    }

    private async Task<(User, OrganizationMembership, LeaguePlayer)> GetPlayerAsync(string identityUserId)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var player = await dbContext.LeaguePlayers
            .Include(lp => lp.OrganizationMembership).ThenInclude(m => m.User)
            .SingleAsync(lp => lp.OrganizationMembership.User!.IdentityUserId == identityUserId);
        return (player.OrganizationMembership.User!, player.OrganizationMembership, player);
    }

    private async Task<Dictionary<Guid, long>> LoadMmrAsync(IEnumerable<Guid> leaguePlayerIds)
    {
        var ids = leaguePlayerIds.ToList();
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        return await dbContext.LeaguePlayers
            .Where(lp => ids.Contains(lp.Id))
            .ToDictionaryAsync(lp => lp.Id, lp => lp.Mmr);
    }

    private async Task QueueAndMatchAsync(Guid orgId, Guid leagueId)
    {
        foreach (var player in Players)
        {
            AuthenticateAs(player);
            var response = await Client.PostAsync($"api/v3/organizations/{orgId}/leagues/{leagueId}/queue", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        await RunMatchMakingCycleAsync();
    }

    private async Task AcceptAllAsync(Guid orgId, Guid leagueId, Guid pendingMatchId)
    {
        foreach (var player in Players)
        {
            AuthenticateAs(player);
            var response = await Client.PostAsync(
                $"api/v3/organizations/{orgId}/leagues/{leagueId}/pending-matches/{pendingMatchId}/accept", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    private async Task<QueueStatusResponse> GetQueueStatusAsync(Guid orgId, Guid leagueId)
    {
        var response = await Client.GetAsync($"api/v3/organizations/{orgId}/leagues/{leagueId}/queue");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<QueueStatusResponse>(response))!;
    }

    private async Task<List<ActiveMatchResponse>> GetActiveMatchesAsync(Guid orgId, Guid leagueId)
    {
        var response = await Client.GetAsync($"api/v3/organizations/{orgId}/leagues/{leagueId}/active-matches");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<List<ActiveMatchResponse>>(response))!;
    }
}
