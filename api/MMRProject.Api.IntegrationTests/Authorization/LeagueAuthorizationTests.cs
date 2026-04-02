using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Authorization;

[Collection("Database")]
public class LeagueAuthorizationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task OrgMember_NotInLeague_CannotReadLeaderboard()
    {
        var org = await CreateOrganization("Org", "league-auth-org");
        var leagueA = await CreateLeague(org.Id, "League A", "league-auth-a");
        var leagueB = await CreateLeague(org.Id, "League B", "league-auth-b");

        await SeedTestUser(org.Id, leagueA.Id, "member-1", "member1@test.com");
        await SeedTestUser(org.Id, leagueB.Id, "member-2", "member2@test.com");

        AuthenticateAs("member-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{leagueB.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task OrgMember_NotInLeague_CannotGetLeague()
    {
        var org = await CreateOrganization("Org", "league-auth-get-org");
        var leagueA = await CreateLeague(org.Id, "League A", "league-auth-get-a");
        var leagueB = await CreateLeague(org.Id, "League B", "league-auth-get-b");

        await SeedTestUser(org.Id, leagueA.Id, "member-1", "member1@test.com");
        await SeedTestUser(org.Id, leagueB.Id, "member-2", "member2@test.com");

        AuthenticateAs("member-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{leagueB.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task OrgMember_NotInLeague_CannotSubmitMatch()
    {
        var org = await CreateOrganization("Org", "league-auth-submit-org");
        var leagueA = await CreateLeague(org.Id, "League A", "league-auth-submit-a");
        var leagueB = await CreateLeague(org.Id, "League B", "league-auth-submit-b");
        await CreateSeason(org.Id, leagueB.Id);

        await SeedTestUser(org.Id, leagueA.Id, "member-1", "member1@test.com");
        var (_, _, p2) = await SeedTestUser(org.Id, leagueB.Id, "member-2", "member2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, leagueB.Id, "member-3", "member3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, leagueB.Id, "member-4", "member4@test.com");
        var (_, _, p5) = await SeedTestUser(org.Id, leagueB.Id, "member-5", "member5@test.com");

        AuthenticateAs("member-1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{leagueB.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p2.Id, p3.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p4.Id, p5.Id], Score = 5 }
                ]
            });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task OrgModerator_NotInLeague_CanReadLeaderboard()
    {
        var org = await CreateOrganization("Org", "league-auth-mod-org");
        var league = await CreateLeague(org.Id, "League", "league-auth-mod-league");

        await SeedOrgMember(org.Id, "moderator-1", "moderator@test.com", OrganizationRole.Moderator);
        await SeedTestUser(org.Id, league.Id, "member-1", "member1@test.com");

        AuthenticateAs("moderator-1");

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task NonMember_CannotGetOrganization()
    {
        var org = await CreateOrganization("Secret Org", "secret-org");
        await SeedUser("outsider-1", "outsider@test.com");

        AuthenticateAs("outsider-1");

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
