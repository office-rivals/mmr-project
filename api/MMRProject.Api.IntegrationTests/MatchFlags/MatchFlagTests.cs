using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.MatchFlags;

[Collection("Database")]
public class MatchFlagTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task CreateFlag_AndListFlags()
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

        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = 5 }
                ]
            });
        matchResponse.EnsureSuccessStatusCode();
        var match = await matchResponse.Content.ReadFromJsonAsync<MatchResponse>();

        var flagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags",
            new CreateMatchFlagRequest { MatchId = match!.Id, Reason = "Wrong score" });

        Assert.Equal(HttpStatusCode.Created, flagResponse.StatusCode);
        var flag = await flagResponse.Content.ReadFromJsonAsync<MatchFlagResponse>();
        Assert.NotNull(flag);
        Assert.Equal(MatchFlagStatus.Open, flag.Status);
        Assert.Equal("Wrong score", flag.Reason);

        var listResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var flags = await listResponse.Content.ReadFromJsonAsync<List<MatchFlagResponse>>();
        Assert.NotNull(flags);
        Assert.Single(flags);
    }

    [Fact]
    public async Task AdminResolveFlag()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "p1", "p1@test.com",
            OrganizationRole.Moderator);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "p2", "p2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("p1");

        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = 5 }
                ]
            });
        matchResponse.EnsureSuccessStatusCode();
        var match = await matchResponse.Content.ReadFromJsonAsync<MatchResponse>();

        var flagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags",
            new CreateMatchFlagRequest { MatchId = match!.Id, Reason = "Wrong score" });
        flagResponse.EnsureSuccessStatusCode();
        var flag = await flagResponse.Content.ReadFromJsonAsync<MatchFlagResponse>();

        var resolveResponse = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/admin/match-flags/{flag!.Id}/resolve",
            new ResolveMatchFlagRequest
                { Status = MatchFlagStatus.Resolved, ResolutionNote = "Score corrected" });

        Assert.Equal(HttpStatusCode.OK, resolveResponse.StatusCode);
        var resolved = await resolveResponse.Content.ReadFromJsonAsync<MatchFlagResponse>();
        Assert.NotNull(resolved);
        Assert.Equal(MatchFlagStatus.Resolved, resolved.Status);
        Assert.Equal("Score corrected", resolved.ResolutionNote);
    }
}
