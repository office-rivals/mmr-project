using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Organizations;

[Collection("Database")]
public class OrganizationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task CreateOrganization_Succeeds()
    {
        await SeedUser("owner-1", "owner@test.com");
        AuthenticateAs("owner-1");

        var response = await Client.PostAsJsonAsync("api/v3/organizations",
            new CreateOrganizationRequest { Name = "My Org", Slug = "my-org" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var org = await ReadJsonAsync<OrganizationResponse>(response);
        Assert.NotNull(org);
        Assert.Equal("My Org", org.Name);
        Assert.Equal("my-org", org.Slug);
    }

    [Fact]
    public async Task CreateOrganization_DuplicateSlug_Fails()
    {
        await CreateOrganization("Existing", "existing-slug");
        await SeedUser("user-1", "user@test.com");
        AuthenticateAs("user-1");

        var response = await Client.PostAsJsonAsync("api/v3/organizations",
            new CreateOrganizationRequest { Name = "Another Org", Slug = "existing-slug" });

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetOrganization_ReturnsCorrectData()
    {
        var org = await CreateOrganization("Get Org", "get-org");
        await SeedOrgMember(org.Id, "user-1", "user@test.com");
        AuthenticateAs("user-1");

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await ReadJsonAsync<OrganizationResponse>(response);
        Assert.NotNull(result);
        Assert.Equal("Get Org", result.Name);
        Assert.Equal("get-org", result.Slug);
    }

    [Fact]
    public async Task UpdateOrganization_AsOwner_Succeeds()
    {
        var org = await CreateOrganization("Old Name", "old-slug");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PatchAsJsonAsync($"api/v3/organizations/{org.Id}",
            new UpdateOrganizationRequest { Name = "New Name" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await ReadJsonAsync<OrganizationResponse>(response);
        Assert.NotNull(result);
        Assert.Equal("New Name", result.Name);
    }

    [Fact]
    public async Task InviteMember_Succeeds()
    {
        var org = await CreateOrganization("Invite Org", "invite-org");
        await SeedOrgMember(org.Id, "mod-1", "mod@test.com", OrganizationRole.Moderator);
        AuthenticateAs("mod-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "newmember@test.com", Role = OrganizationRole.Member });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var member = await ReadJsonAsync<OrganizationMemberResponse>(response);
        Assert.NotNull(member);
        Assert.Equal(OrganizationRole.Member, member.Role);
        Assert.Equal(MembershipStatus.Invited, member.Status);
    }

    [Fact]
    public async Task UpdateMemberRole_AsOwner_Succeeds()
    {
        var org = await CreateOrganization("Role Org", "role-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var inviteResponse = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "member@test.com", Role = OrganizationRole.Member });
        inviteResponse.EnsureSuccessStatusCode();
        var invited = await ReadJsonAsync<OrganizationMemberResponse>(inviteResponse);

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{invited!.Id}",
            new UpdateMemberRoleRequest { Role = OrganizationRole.Moderator });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReadJsonAsync<OrganizationMemberResponse>(response);
        Assert.NotNull(updated);
        Assert.Equal(OrganizationRole.Moderator, updated.Role);
    }
}
