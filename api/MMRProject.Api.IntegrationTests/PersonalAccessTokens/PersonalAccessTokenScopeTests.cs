using System.Net;
using System.Net.Http.Json;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.PersonalAccessTokens;

[Collection("Database")]
public class PersonalAccessTokenScopeTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task CreateToken_ForOrgUserIsNotMemberOf_ShouldFail()
    {
        // Arrange: two orgs, user is only member of orgA
        var orgA = await CreateOrganization("Org A", "org-a");
        var orgB = await CreateOrganization("Org B", "org-b");

        await SeedOrgMember(orgA.Id, "user-1", "user1@test.com", OrganizationRole.Member);
        await SeedOrgMember(orgB.Id, "user-2", "user2@test.com", OrganizationRole.Member);

        AuthenticateAs("user-1");

        // Act: user-1 tries to create a PAT scoped to orgB
        var response = await Client.PostAsJsonAsync("api/v3/me/tokens", new CreateTokenRequest
        {
            Name = "Sneaky Token",
            Scope = "read",
            OrganizationId = orgB.Id,
        });

        // Assert: should be forbidden, not created
        Assert.True(
            response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.BadRequest,
            $"Expected 403/400 but got {(int)response.StatusCode} — user was able to mint a PAT for an org they don't belong to");
    }

    [Fact]
    public async Task CreateToken_ForLeagueInDifferentOrg_ShouldFail()
    {
        // Arrange: user is member of orgA, but targets a league in orgB
        var orgA = await CreateOrganization("Org A", "org-a-2");
        var orgB = await CreateOrganization("Org B", "org-b-2");
        var leagueB = await CreateLeague(orgB.Id, "League B", "league-b");

        await SeedOrgMember(orgA.Id, "user-1", "user1@test.com", OrganizationRole.Member);
        await SeedOrgMember(orgB.Id, "user-2", "user2@test.com", OrganizationRole.Member);

        AuthenticateAs("user-1");

        // Act: user-1 creates a PAT with orgA but leagueB (which belongs to orgB)
        var response = await Client.PostAsJsonAsync("api/v3/me/tokens", new CreateTokenRequest
        {
            Name = "Cross-Org League Token",
            Scope = "read",
            OrganizationId = orgA.Id,
            LeagueId = leagueB.Id,
        });

        // Assert: should be rejected
        Assert.True(
            response.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.BadRequest,
            $"Expected 403/400 but got {(int)response.StatusCode} — user was able to mint a PAT for a league in another org");
    }
}
