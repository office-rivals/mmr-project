using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.MatchFlags;

[Collection("Database")]
public class MatchFlagTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private async Task<(Organization Org, League League, LeaguePlayer P1, LeaguePlayer P2, LeaguePlayer P3, LeaguePlayer P4)> SetupTestData(
        OrganizationRole p1Role = OrganizationRole.Owner)
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com", p1Role);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        return (org, league, p1, p2, p3, p4);
    }

    private async Task<MatchResponse> SubmitMatch(Guid orgId, Guid leagueId, Guid p1Id, Guid p2Id, Guid p3Id, Guid p4Id)
    {
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1Id, p2Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3Id, p4Id], Score = 5 }
                ]
            });
        matchResponse.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<MatchResponse>(matchResponse))!;
    }

    private async Task<MatchFlagResponse> CreateFlag(Guid orgId, Guid leagueId, Guid matchId, string reason = "Wrong score")
    {
        var flagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/match-flags",
            new CreateMatchFlagRequest { MatchId = matchId, Reason = reason });
        flagResponse.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<MatchFlagResponse>(flagResponse))!;
    }

    [Fact]
    public async Task CreateFlag_AndListFlags()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags",
            new CreateMatchFlagRequest { MatchId = match.Id, Reason = "Wrong score" });

        Assert.Equal(HttpStatusCode.Created, flagResponse.StatusCode);
        var flag = await ReadJsonAsync<MatchFlagResponse>(flagResponse);
        Assert.NotNull(flag);
        Assert.Equal(MatchFlagStatus.Open, flag.Status);
        Assert.Equal("Wrong score", flag.Reason);

        var listResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var flags = await ReadJsonAsync<List<MatchFlagResponse>>(listResponse);
        Assert.NotNull(flags);
        Assert.Single(flags);
    }

    [Fact]
    public async Task AdminResolveFlag()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData(OrganizationRole.Moderator);
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flag = await CreateFlag(org.Id, league.Id, match.Id);

        var resolveResponse = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/admin/match-flags/{flag.Id}/resolve",
            new ResolveMatchFlagRequest
                { Status = MatchFlagStatus.Resolved, ResolutionNote = "Score corrected" });

        Assert.Equal(HttpStatusCode.OK, resolveResponse.StatusCode);
        var resolved = await ReadJsonAsync<MatchFlagResponse>(resolveResponse);
        Assert.NotNull(resolved);
        Assert.Equal(MatchFlagStatus.Resolved, resolved.Status);
        Assert.Equal("Score corrected", resolved.ResolutionNote);
    }

    [Fact]
    public async Task GetMyFlags_ReturnsOnlyMyFlags()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        await CreateFlag(org.Id, league.Id, match.Id, "P1's flag");

        // Create flag as p2
        AuthenticateAs("p2");
        await CreateFlag(org.Id, league.Id, match.Id, "P2's flag");

        // Get my flags as p1
        AuthenticateAs("p1");
        var myFlagsResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/me");
        Assert.Equal(HttpStatusCode.OK, myFlagsResponse.StatusCode);
        var myFlags = await ReadJsonAsync<List<MatchFlagResponse>>(myFlagsResponse);
        Assert.NotNull(myFlags);
        Assert.Single(myFlags);
        Assert.Equal("P1's flag", myFlags[0].Reason);

        // Get my flags as p2
        AuthenticateAs("p2");
        var p2FlagsResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/me");
        var p2Flags = await ReadJsonAsync<List<MatchFlagResponse>>(p2FlagsResponse);
        Assert.NotNull(p2Flags);
        Assert.Single(p2Flags);
        Assert.Equal("P2's flag", p2Flags[0].Reason);
    }

    [Fact]
    public async Task UpdateFlagReason_AsCreator_Succeeds()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flag = await CreateFlag(org.Id, league.Id, match.Id, "Original reason");

        var updateResponse = await Client.PutAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}",
            new UpdateMatchFlagReasonRequest { Reason = "Updated reason" });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await ReadJsonAsync<MatchFlagResponse>(updateResponse);
        Assert.NotNull(updated);
        Assert.Equal("Updated reason", updated.Reason);
    }

    [Fact]
    public async Task UpdateFlagReason_AsNonCreator_Fails()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flag = await CreateFlag(org.Id, league.Id, match.Id);

        // Try to update as p2
        AuthenticateAs("p2");
        var updateResponse = await Client.PutAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}",
            new UpdateMatchFlagReasonRequest { Reason = "Hacked reason" });

        Assert.Equal(HttpStatusCode.Forbidden, updateResponse.StatusCode);
    }

    [Fact]
    public async Task DeleteFlag_AsCreator_Succeeds()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flag = await CreateFlag(org.Id, league.Id, match.Id);

        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Verify flag is gone
        var listResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/me");
        var flags = await ReadJsonAsync<List<MatchFlagResponse>>(listResponse);
        Assert.NotNull(flags);
        Assert.Empty(flags);
    }

    [Fact]
    public async Task DeleteFlag_AsNonCreator_Fails()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flag = await CreateFlag(org.Id, league.Id, match.Id);

        // Try to delete as p2
        AuthenticateAs("p2");
        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, deleteResponse.StatusCode);
    }

    [Fact]
    public async Task CreateDuplicateFlag_Fails()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        await CreateFlag(org.Id, league.Id, match.Id, "First flag");

        // Try to create another flag for the same match
        var duplicateResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags",
            new CreateMatchFlagRequest { MatchId = match.Id, Reason = "Duplicate flag" });

        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
    }

    [Fact]
    public async Task CreateFlag_AfterDeletingPrevious_Succeeds()
    {
        var (org, league, p1, p2, p3, p4) = await SetupTestData();
        AuthenticateAs("p1");

        var match = await SubmitMatch(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id);
        var flag = await CreateFlag(org.Id, league.Id, match.Id, "First flag");

        // Delete the flag
        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        // Create a new flag for the same match
        var newFlagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags",
            new CreateMatchFlagRequest { MatchId = match.Id, Reason = "New flag" });

        Assert.Equal(HttpStatusCode.Created, newFlagResponse.StatusCode);
        var newFlag = await ReadJsonAsync<MatchFlagResponse>(newFlagResponse);
        Assert.NotNull(newFlag);
        Assert.Equal("New flag", newFlag.Reason);
    }
}
