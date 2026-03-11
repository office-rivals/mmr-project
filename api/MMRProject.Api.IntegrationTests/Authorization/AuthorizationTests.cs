using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Authorization;

[Collection("Database")]
public class AuthorizationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task Member_CannotAccessOwnerOnlyEndpoints()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "member-1", "member@test.com", OrganizationRole.Member);
        AuthenticateAs("member-1");

        var updateOrgResponse = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}",
            new UpdateOrganizationRequest { Name = "Hacked" });

        Assert.Equal(HttpStatusCode.Forbidden, updateOrgResponse.StatusCode);

        var createLeagueResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "New League", Slug = "new-league" });

        Assert.Equal(HttpStatusCode.Forbidden, createLeagueResponse.StatusCode);
    }

    [Fact]
    public async Task NonMember_Gets403OnOrgEndpoints()
    {
        var org = await CreateOrganization();

        await SeedUser("outsider-1", "outsider@test.com");
        AuthenticateAs("outsider-1");

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}/members");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Member_CannotInviteMembers()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "member-1", "member@test.com", OrganizationRole.Member);
        AuthenticateAs("member-1");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "new@test.com", Role = OrganizationRole.Member });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Member_CannotDeleteMatch()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id);
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, "owner-1", "owner@test.com",
            OrganizationRole.Owner);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com",
            OrganizationRole.Member);
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, "p3", "p3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, "p4", "p4@test.com");

        AuthenticateAs("owner-1");
        var submitResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1.Id, p2.Id], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3.Id, p4.Id], Score = 5 }
                ]
            });
        submitResponse.EnsureSuccessStatusCode();
        var match = await submitResponse.Content.ReadFromJsonAsync<MatchResponse>();

        AuthenticateAs("member-1");
        var deleteResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{match!.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, deleteResponse.StatusCode);
    }
}
