using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Authorization;

[Collection("Database")]
public class PatAuthorizationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task WriteScopedPat_CanCallWriteEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-read-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);

        AuthenticateAsPat("owner-1", "write", org.Id);

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Allowed", Slug = "allowed" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task OrgScopedPat_CannotAccessDifferentOrganization()
    {
        var orgA = await CreateOrganization("Org A", "pat-org-a");
        var orgB = await CreateOrganization("Org B", "pat-org-b");

        var user = await SeedUser("member-1", "member@test.com");
        await SeedExistingUserMembership(orgA.Id, user.Id);
        await SeedExistingUserMembership(orgB.Id, user.Id);

        AuthenticateAsPat("member-1", "write", orgA.Id);

        var response = await Client.GetAsync($"api/v3/organizations/{orgB.Id}/members");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LeagueScopedPat_CannotCallOrganizationWideEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-league-org");
        var league = await CreateLeague(org.Id, "League", "pat-league");
        await SeedOrgMember(org.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write", org.Id, league.Id);

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}/members");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task JwtOnlyTokenManagement_RejectsPatAuthentication()
    {
        await SeedUser("member-1", "member@test.com");
        AuthenticateAsPat("member-1", "write");

        var response = await Client.GetAsync("api/v3/me/tokens");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task WriteScopedPat_CanReadTenantScopedEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-read-allowed-org");
        var league = await CreateLeague(org.Id, "League", "pat-read-allowed-league");
        await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write", org.Id, league.Id);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task WriteScopedPat_CanResolveCurrentLeaguePlayer()
    {
        var org = await CreateOrganization("Org", "pat-player-org");
        var league = await CreateLeague(org.Id, "League", "pat-player-league");
        await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write", org.Id, league.Id);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
