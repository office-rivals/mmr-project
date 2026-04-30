using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
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

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var member = await ReadJsonAsync<OrganizationMemberResponse>(response);
        Assert.NotNull(member);
        Assert.Equal(OrganizationRole.Member, member.Role);
        Assert.Equal(MembershipStatus.Invited, member.Status);
    }

    [Fact]
    public async Task InviteMember_WithDisplayNameAndUsername_PersistsBoth()
    {
        var org = await CreateOrganization("Invite Names Org", "invite-names-org");
        await SeedOrgMember(org.Id, "mod-1", "mod@test.com", OrganizationRole.Moderator);
        AuthenticateAs("mod-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest
            {
                Email = "named@test.com",
                Role = OrganizationRole.Member,
                DisplayName = "Named Member",
                Username = "namem",
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var member = await ReadJsonAsync<OrganizationMemberResponse>(response);
        Assert.NotNull(member);
        Assert.Equal("Named Member", member.DisplayName);
        Assert.Equal("namem", member.Username);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var stored = await dbContext.OrganizationMemberships
            .FirstAsync(m => m.Id == member.Id);
        Assert.Equal("Named Member", stored.DisplayName);
        Assert.Equal("namem", stored.Username);
    }

    [Fact]
    public async Task InviteMember_AsModerator_CannotInviteOwner()
    {
        var org = await CreateOrganization("Invite Org Restricted", "invite-org-restricted");
        await SeedOrgMember(org.Id, "mod-1", "mod@test.com", OrganizationRole.Moderator);
        AuthenticateAs("mod-1");

        var response = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "owner-escalation@test.com", Role = OrganizationRole.Owner });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
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

    [Fact]
    public async Task UpdateMemberRole_CannotDemoteLastOwner()
    {
        var org = await CreateOrganization("Solo Owner Org", "solo-owner-org");
        var (_, ownerMembership) = await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{ownerMembership.Id}",
            new UpdateMemberRoleRequest { Role = OrganizationRole.Member });

        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RemoveMember_PreservesLeagueHistoryAndHidesMembership()
    {
        var org = await CreateOrganization("History Org", "history-org");
        var league = await CreateLeague(org.Id, "History League", "history-league");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        var (_, membership, leaguePlayer) = await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");
        AuthenticateAs("owner-1");

        var response = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{membership.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var membersResponse = await Client.GetAsync($"api/v3/organizations/{org.Id}/members");
        Assert.Equal(HttpStatusCode.OK, membersResponse.StatusCode);
        var members = await ReadJsonAsync<List<OrganizationMemberResponse>>(membersResponse);
        Assert.NotNull(members);
        Assert.DoesNotContain(members, m => m.Id == membership.Id);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var storedMembership = await dbContext.OrganizationMemberships
            .FirstAsync(m => m.Id == membership.Id);
        var storedLeaguePlayer = await dbContext.LeaguePlayers
            .FirstOrDefaultAsync(lp => lp.Id == leaguePlayer.Id);

        Assert.Equal(MembershipStatus.Removed, storedMembership.Status);
        Assert.NotNull(storedLeaguePlayer);
    }

    [Fact]
    public async Task ReinviteRemovedMember_ReactivatesExistingMembershipAndLeagueProfile()
    {
        var org = await CreateOrganization("Rejoin Org", "rejoin-org");
        var league = await CreateLeague(org.Id, "Rejoin League", "rejoin-league");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        var (user, membership, leaguePlayer) = await SeedTestUser(
            org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAs("owner-1");
        var removeResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{membership.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);

        var inviteResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = user.Email, Role = OrganizationRole.Member });
        Assert.Equal(HttpStatusCode.OK, inviteResponse.StatusCode);
        var invited = await ReadJsonAsync<OrganizationMemberResponse>(inviteResponse);
        Assert.NotNull(invited);
        Assert.Equal(membership.Id, invited.Id);
        Assert.Equal(MembershipStatus.Invited, invited.Status);

        AuthenticateAs("member-1", email: "member@test.com");
        var meResponse = await Client.GetAsync("api/v3/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var me = await ReadJsonAsync<MeResponse>(meResponse);
        Assert.NotNull(me);
        var orgResponse = Assert.Single(me.Organizations);
        Assert.Equal(org.Id, orgResponse.Id);
        var leagueResponse = Assert.Single(orgResponse.Leagues);
        Assert.Equal(leaguePlayer.Id, leagueResponse.LeaguePlayerId);
    }

    [Fact]
    public async Task UpdateMemberProfile_AsModerator_UpdatesDisplayNameAndUsername()
    {
        var org = await CreateOrganization("Profile Org", "profile-org");
        await SeedOrgMember(org.Id, "mod-1", "mod@test.com", OrganizationRole.Moderator);
        var (_, target) = await SeedOrgMember(org.Id, "target-1", "target@test.com");
        AuthenticateAs("mod-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{target.Id}/profile",
            new UpdateMemberProfileRequest
            {
                DisplayName = "Display Updated",
                Username = "displ",
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReadJsonAsync<OrganizationMemberResponse>(response);
        Assert.NotNull(updated);
        Assert.Equal("Display Updated", updated.DisplayName);
        Assert.Equal("displ", updated.Username);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var stored = await dbContext.OrganizationMemberships.FirstAsync(m => m.Id == target.Id);
        Assert.Equal("Display Updated", stored.DisplayName);
        Assert.Equal("displ", stored.Username);
    }

    [Fact]
    public async Task UpdateMemberProfile_OnUnclaimedMembership_UpdatesInviteEmail()
    {
        var org = await CreateOrganization("Unclaimed Email Org", "unclaimed-email-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        AuthenticateAs("owner-1");

        var inviteResponse = await Client.PostAsJsonAsync($"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "old@test.com", Role = OrganizationRole.Member });
        inviteResponse.EnsureSuccessStatusCode();
        var invited = await ReadJsonAsync<OrganizationMemberResponse>(inviteResponse);
        Assert.NotNull(invited);

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{invited.Id}/profile",
            new UpdateMemberProfileRequest { Email = "new@test.com" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var stored = await dbContext.OrganizationMemberships.FirstAsync(m => m.Id == invited.Id);
        Assert.Equal("new@test.com", stored.InviteEmail);
        Assert.Null(stored.UserId);
    }

    [Fact]
    public async Task UpdateMemberProfile_OnClaimedMembership_RejectsEmailChange()
    {
        var org = await CreateOrganization("Claimed Email Org", "claimed-email-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        var (_, target) = await SeedOrgMember(org.Id, "target-1", "target@test.com");
        AuthenticateAs("owner-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{target.Id}/profile",
            new UpdateMemberProfileRequest { Email = "rejected@test.com" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var stored = await dbContext.OrganizationMemberships
            .Include(m => m.User)
            .FirstAsync(m => m.Id == target.Id);
        Assert.Equal("target@test.com", stored.User!.Email);
        Assert.Null(stored.InviteEmail);
    }

    [Fact]
    public async Task UpdateMemberProfile_AsMember_Forbidden()
    {
        var org = await CreateOrganization("Profile Auth Org", "profile-auth-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "member-1", "member@test.com");
        var (_, target) = await SeedOrgMember(org.Id, "target-1", "target@test.com");
        AuthenticateAs("member-1");

        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{target.Id}/profile",
            new UpdateMemberProfileRequest { DisplayName = "Hacker" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task InviteLinkRejoin_ReactivatesExistingMembershipAndLeagueProfile()
    {
        var org = await CreateOrganization("Invite Rejoin Org", "invite-rejoin-org");
        var league = await CreateLeague(org.Id, "Invite Rejoin League", "invite-rejoin-league");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        var (_, membership, leaguePlayer) = await SeedTestUser(
            org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAs("owner-1");
        var inviteLinkResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/invite-links",
            new CreateInviteLinkRequest());
        Assert.Equal(HttpStatusCode.Created, inviteLinkResponse.StatusCode);
        var inviteLink = await ReadJsonAsync<InviteLinkResponse>(inviteLinkResponse);
        Assert.NotNull(inviteLink);

        var removeResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{membership.Id}");
        Assert.Equal(HttpStatusCode.NoContent, removeResponse.StatusCode);

        AuthenticateAs("member-1", email: "member@test.com");
        var joinResponse = await Client.PostAsync($"api/v3/invites/{inviteLink.Code}/join", null);
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);
        var joined = await ReadJsonAsync<JoinOrganizationResponse>(joinResponse);
        Assert.NotNull(joined);
        Assert.Equal(membership.Id, joined.MembershipId);

        var meResponse = await Client.GetAsync("api/v3/me");
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var me = await ReadJsonAsync<MeResponse>(meResponse);
        Assert.NotNull(me);
        var orgResponse = Assert.Single(me.Organizations);
        Assert.Equal(org.Id, orgResponse.Id);
        var leagueResponse = Assert.Single(orgResponse.Leagues);
        Assert.Equal(leaguePlayer.Id, leagueResponse.LeaguePlayerId);
    }
}
