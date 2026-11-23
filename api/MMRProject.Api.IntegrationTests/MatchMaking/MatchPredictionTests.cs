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
    public async Task PendingMatch_IsPredicted_ForItsPlayersOnly()
    {
        var (org, league) = await SetupLeagueAsync();
        await SeedTestUser(org.Id, league.Id, "outsider", "outsider@test.com");
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var pendingMatch = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;
        var prediction = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, pendingMatch.Id));

        Assert.Equal(pendingMatch.Id, prediction.PendingMatchId);
        AssertPredictionCovers(pendingMatch.Teams, prediction);

        // A found match is private to its players, as GET pending-matches/{id} is.
        AuthenticateAs("outsider");
        Assert.Empty(await GetPredictionsAsync(org.Id, league.Id, pendingMatch.Id));
    }

    [Fact]
    public async Task ActiveMatch_IsPredicted_ForTheLeague_AndAsksTheMmrApiOnce()
    {
        var (org, league) = await SetupLeagueAsync();
        await SeedTestUser(org.Id, league.Id, "outsider", "outsider@test.com");
        await QueueAndMatchAsync(org.Id, league.Id);
        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;
        var whenFound = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, pending.Id));
        await AcceptAllAsync(org.Id, league.Id, pending.Id);

        AuthenticateAs("p1");
        var active = Assert.Single(await GetActiveMatchesAsync(org.Id, league.Id));
        var whenLive = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, active.PendingMatchId));
        // Live matches are listed for the whole league, so their odds are too.
        AuthenticateAs("outsider");
        var forOutsider = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, active.PendingMatchId));

        AssertPredictionCovers(active.Teams, whenLive);
        Assert.Equivalent(whenFound, whenLive, strict: true);
        Assert.Equivalent(whenLive, forOutsider, strict: true);
        // Asking again for the same match reuses the first answer.
        Assert.Equal(1, Factory.StubMmrCalculationApiClient.PredictCallCount);
    }

    [Fact]
    public async Task ActiveMatch_IsPredicted_ForAModeratorWhoDoesNotPlay()
    {
        var (org, league) = await SetupLeagueAsync();
        await SeedOrgMember(org.Id, "moderator", "moderator@test.com", OrganizationRole.Moderator);
        await QueueAndMatchAsync(org.Id, league.Id);
        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;

        // Not a player, so a found match stays private.
        AuthenticateAs("moderator");
        Assert.Empty(await GetPredictionsAsync(org.Id, league.Id, pending.Id));

        await AcceptAllAsync(org.Id, league.Id, pending.Id);
        AuthenticateAs("moderator");
        var prediction = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, pending.Id));
        Assert.Equal(pending.Id, prediction.PendingMatchId);
    }

    [Fact]
    public async Task MatchResponses_CarryNoPrediction()
    {
        var (org, league) = await SetupLeagueAsync();
        await QueueAndMatchAsync(org.Id, league.Id);
        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;
        await AcceptAllAsync(org.Id, league.Id, pending.Id);

        AuthenticateAs("p1");
        var queueJson = await Client.GetStringAsync($"api/v3/organizations/{org.Id}/leagues/{league.Id}/queue");
        var activeJson = await Client.GetStringAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/active-matches");

        // Polling the queue or the live matches never asks the MMR API.
        Assert.DoesNotContain("prediction", queueJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("prediction", activeJson, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(0, Factory.StubMmrCalculationApiClient.PredictCallCount);
    }

    [Fact]
    public async Task Predictions_LeaveOutMatches_ThatCannotBePredicted()
    {
        var (org, league) = await SetupLeagueAsync();
        var (otherOrg, otherLeague) = await SetupLeagueAsync("q");
        await QueueAndMatchAsync(otherOrg.Id, otherLeague.Id, "q");
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("q1");
        var elsewhere = (await GetQueueStatusAsync(otherOrg.Id, otherLeague.Id)).PendingMatch!;
        // Live, so its league is the only thing that keeps it out.
        await AcceptAllAsync(otherOrg.Id, otherLeague.Id, elsewhere.Id, "q");
        AuthenticateAs("p1");
        var mine = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;

        // Unknown ids and another league's matches are simply not in the answer.
        var predictions = await GetPredictionsAsync(org.Id, league.Id, mine.Id, Guid.NewGuid(), elsewhere.Id);
        Assert.Equal([mine.Id], predictions.Select(p => p.PendingMatchId));
    }

    [Fact]
    public async Task Predictions_AreEmpty_WhenTheMmrApiFails()
    {
        var (org, league) = await SetupLeagueAsync();
        Factory.StubMmrCalculationApiClient.ThrowOnPredict = true;
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;
        Assert.Empty(await GetPredictionsAsync(org.Id, league.Id, pending.Id));
        Assert.Empty(await GetPredictionsAsync(org.Id, league.Id, pending.Id));
        // A failure is not retried on every request.
        Assert.Equal(1, Factory.StubMmrCalculationApiClient.PredictCallCount);
    }

    [Fact]
    public async Task Predictions_AreEmpty_WithoutACurrentSeason()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 2);
        foreach (var player in Players)
        {
            await SeedTestUser(org.Id, league.Id, player, $"{player}@test.com");
        }
        await QueueAndMatchAsync(org.Id, league.Id);

        AuthenticateAs("p1");
        var pending = (await GetQueueStatusAsync(org.Id, league.Id)).PendingMatch!;

        Assert.Empty(await GetPredictionsAsync(org.Id, league.Id, pending.Id));
    }

    [Fact]
    public async Task Predictions_RejectTooManyIds()
    {
        var (org, league) = await SetupLeagueAsync();
        AuthenticateAs("p1");

        var ids = Enumerable.Range(0, V3MatchMakingService.MaxPredictedMatches + 1)
            .Select(_ => $"pendingMatchId={Guid.NewGuid()}");
        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-predictions?{string.Join('&', ids)}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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
        var prediction = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, active.PendingMatchId));
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
        var prediction = Assert.Single(await GetPredictionsAsync(org.Id, league.Id, pendingMatch.Id));

        // The odds still show; only the MMRs that would reveal a placement
        // match's change are withheld.
        AssertPredictionCovers(pendingMatch.Teams, prediction);
        Assert.All(prediction.Teams.SelectMany(t => t.Players), AssertHidden);
    }

    private static void AssertPredictionCovers(List<PendingMatchTeamResponse> teams, MatchPredictionResponse prediction)
    {
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

    // Players are named <prefix>1..4, so two leagues can live side by side.
    private async Task<(Organization Org, League League)> SetupLeagueAsync(string prefix = "p")
    {
        var org = await CreateOrganization(slug: $"{prefix}-org");
        var league = await CreateLeague(org.Id, teamSize: 2);
        await CreateSeason(org.Id, league.Id, DateTimeOffset.UtcNow.AddDays(-1));
        foreach (var player in PlayersNamed(prefix))
        {
            await SeedTestUser(org.Id, league.Id, player, $"{player}@test.com",
                player == $"{prefix}1" ? OrganizationRole.Owner : OrganizationRole.Member);
        }
        return (org, league);
    }

    private static string[] PlayersNamed(string prefix) =>
        [.. Players.Select(p => prefix + p[1..])];

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

    private async Task QueueAndMatchAsync(Guid orgId, Guid leagueId, string prefix = "p")
    {
        foreach (var player in PlayersNamed(prefix))
        {
            AuthenticateAs(player);
            var response = await Client.PostAsync($"api/v3/organizations/{orgId}/leagues/{leagueId}/queue", null);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        await RunMatchMakingCycleAsync();
    }

    private async Task AcceptAllAsync(Guid orgId, Guid leagueId, Guid pendingMatchId, string prefix = "p")
    {
        foreach (var player in PlayersNamed(prefix))
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

    private async Task<List<MatchPredictionResponse>> GetPredictionsAsync(
        Guid orgId, Guid leagueId, params Guid[] pendingMatchIds)
    {
        var query = string.Join('&', pendingMatchIds.Select(id => $"pendingMatchId={id}"));
        var response = await Client.GetAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/match-predictions?{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<List<MatchPredictionResponse>>(response))!;
    }

    private async Task<List<ActiveMatchResponse>> GetActiveMatchesAsync(Guid orgId, Guid leagueId)
    {
        var response = await Client.GetAsync($"api/v3/organizations/{orgId}/leagues/{leagueId}/active-matches");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<List<ActiveMatchResponse>>(response))!;
    }
}
