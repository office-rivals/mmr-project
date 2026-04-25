using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Organizations;

[Collection("Database")]
public class RemoveLastOwnerTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task RemoveLastOwner_ShouldFail()
    {
        var org = await CreateOrganization("Solo Org", "solo-org");
        var (_, ownerMembership) = await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{ownerMembership.Id}");

        Assert.True(
            response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict,
            $"Expected 400/409 but got {(int)response.StatusCode} — last owner was removed from organization");
    }

    [Fact]
    public async Task RemoveOwner_WhenMultipleOwnersExist_ShouldSucceed()
    {
        var org = await CreateOrganization("Multi Org", "multi-org");
        var (_, owner1) = await SeedOrgMember(org.Id, "owner-1", "owner1@test.com", OrganizationRole.Owner);
        var (_, owner2) = await SeedOrgMember(org.Id, "owner-2", "owner2@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{owner2.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }
}
