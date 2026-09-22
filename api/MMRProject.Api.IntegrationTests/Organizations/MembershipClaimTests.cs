using System.Data.Common;
using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Auth;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using Npgsql;

namespace MMRProject.Api.IntegrationTests.Organizations;

[Collection("Database")]
public class MembershipClaimTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task ClaimableList_AppliesIdentityPrivacyAndVerifiedEmailRules()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "requester", "requester@test.com");
        var nameOnly = await SeedPlaceholder(org.Id, "Name Only");
        var addressed = await SeedPlaceholder(
            org.Id, "Addressed", "REQUESTER@test.com", MembershipStatus.Invited);
        await SeedPlaceholder(org.Id, "Someone Else", "other@test.com", MembershipStatus.Invited);
        await SeedOrgMember(org.Id, "claimed", "claimed@test.com");
        await SeedPlaceholder(org.Id, "Removed", status: MembershipStatus.Removed);

        AuthenticateAs("requester", email: "requester@test.com", emailVerified: true);
        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}/members/claimable");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await ReadJsonAsync<ClaimableMembershipsResponse>(response);
        Assert.NotNull(result);
        Assert.True(result.RequesterEligible);
        Assert.Equal(new[] { addressed.Id, nameOnly.Id }.Order(), result.Memberships
            .Select(m => m.OrganizationMembershipId).Order().ToList());
        Assert.DoesNotContain("other@test.com", await response.Content.ReadAsStringAsync());

        AuthenticateAs("requester", email: "requester@test.com");
        response = await Client.GetAsync($"api/v3/organizations/{org.Id}/members/claimable");
        result = await ReadJsonAsync<ClaimableMembershipsResponse>(response);
        Assert.NotNull(result);
        Assert.Equal(nameOnly.Id, Assert.Single(result.Memberships).OrganizationMembershipId);
    }

    [Fact]
    public async Task Create_IsIdempotentAndMapsPendingConflicts()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "requester-1", "one@test.com");
        await SeedOrgMember(org.Id, "requester-2", "two@test.com");
        var firstTarget = await SeedPlaceholder(org.Id, "First");
        var secondTarget = await SeedPlaceholder(org.Id, "Second");

        var first = await CreateClaimAsync(org.Id, firstTarget.Id, "requester-1");
        var repeated = await CreateClaimAsync(org.Id, firstTarget.Id, "requester-1");
        Assert.Equal(first.Id, repeated.Id);

        AuthenticateAs("requester-1");
        var secondTargetResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/claim-requests",
            new CreateMembershipClaimRequest { OrganizationMembershipId = secondTarget.Id });
        Assert.Equal(HttpStatusCode.BadRequest, secondTargetResponse.StatusCode);

        AuthenticateAs("requester-2");
        var occupiedTargetResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/claim-requests",
            new CreateMembershipClaimRequest { OrganizationMembershipId = firstTarget.Id });
        Assert.Equal(HttpStatusCode.Conflict, occupiedTargetResponse.StatusCode);
    }

    [Fact]
    public async Task Approve_PreservesPlaceholderHistoryAndRetiresFreshMembership()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, ownerMembership, ownerPlayer) = await SeedTestUser(
            org.Id, league.Id, "owner", "owner@test.com", OrganizationRole.Owner);

        AuthenticateAs("owner");
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, new CreateMatchPlayerRequest { DisplayName = "Zed Guest" }));
        Assert.Equal(HttpStatusCode.Created, matchResponse.StatusCode);
        var match = await ReadJsonAsync<MatchResponse>(matchResponse);
        Assert.NotNull(match);
        var originalPlayerId = match.Teams.SelectMany(t => t.Players)
            .Single(p => p.DisplayName == "Zed Guest").LeaguePlayerId;

        var inviteResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/invite-links", new CreateInviteLinkRequest());
        var invite = await ReadJsonAsync<InviteLinkResponse>(inviteResponse);
        Assert.NotNull(invite);
        await SeedUser("requester", "requester@test.com");
        AuthenticateAs("requester", email: "requester@test.com");
        var joinResponse = await Client.PostAsync($"api/v3/invites/{invite.Code}/join", null);
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);
        var joined = await ReadJsonAsync<JoinOrganizationResponse>(joinResponse);
        Assert.NotNull(joined);

        Guid targetId;
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            targetId = await db.LeaguePlayers
                .Where(lp => lp.Id == originalPlayerId)
                .Select(lp => lp.OrganizationMembershipId)
                .SingleAsync();
        }

        var claim = await CreateClaimAsync(org.Id, targetId, "requester");
        AuthenticateAs("owner");
        var approveResponse = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{claim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveResponse.StatusCode);

        using var verificationScope = Factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var requesterUserId = await verificationDb.V3Users
            .Where(u => u.IdentityUserId == "requester").Select(u => u.Id).SingleAsync();
        var linked = Assert.Single(await verificationDb.OrganizationMemberships
            .Where(m => m.OrganizationId == org.Id && m.UserId == requesterUserId).ToListAsync());
        Assert.Equal(targetId, linked.Id);
        var retired = await verificationDb.OrganizationMemberships.SingleAsync(m => m.Id == joined.MembershipId);
        Assert.Null(retired.UserId);
        Assert.Equal(MembershipStatus.Removed, retired.Status);
        Assert.False(await verificationDb.LeaguePlayers.AnyAsync(lp =>
            lp.OrganizationMembershipId == retired.Id));
        Assert.True(await verificationDb.LeaguePlayers.AnyAsync(lp => lp.Id == originalPlayerId));
        Assert.True(await verificationDb.RatingHistories.AnyAsync(r => r.LeaguePlayerId == originalPlayerId));
        Assert.True(await verificationDb.MatchTeamPlayers.AnyAsync(p => p.LeaguePlayerId == originalPlayerId));
        Assert.Equal(ownerMembership.Id, (await verificationDb.MembershipClaimRequests
            .SingleAsync(c => c.Id == claim.Id)).ReviewedByMembershipId);
    }

    [Fact]
    public async Task Approve_CarriesClaimantRoleInsteadOfPlaceholderRole()
    {
        var memberOrg = await CreateOrganization("Member Role", "member-role");
        await SeedOrgMember(memberOrg.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(memberOrg.Id, "requester", "requester@test.com");
        var elevatedTarget = await SeedPlaceholder(
            memberOrg.Id, "Elevated Placeholder", role: OrganizationRole.Owner);
        var memberClaim = await CreateClaimAsync(memberOrg.Id, elevatedTarget.Id, "requester");
        await ApproveClaimAsync(memberOrg.Id, memberClaim.Id, "owner");

        var ownerOrg = await CreateOrganization("Owner Role", "owner-role");
        await SeedOrgMember(ownerOrg.Id, "sole-owner", "sole@test.com", OrganizationRole.Owner);
        var ordinaryTarget = await SeedPlaceholder(ownerOrg.Id, "Ordinary Placeholder");
        var ownerClaim = await CreateClaimAsync(ownerOrg.Id, ordinaryTarget.Id, "sole-owner");
        await ApproveClaimAsync(ownerOrg.Id, ownerClaim.Id, "sole-owner");

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(OrganizationRole.Member,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == elevatedTarget.Id)).Role);
        Assert.Equal(OrganizationRole.Owner,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == ordinaryTarget.Id)).Role);
        Assert.True(await db.OrganizationMemberships.AnyAsync(m =>
            m.OrganizationId == ownerOrg.Id && m.Status == MembershipStatus.Active
            && m.Role == OrganizationRole.Owner));
    }

    [Fact]
    public async Task Authorization_BlocksModeratorSelfApprovalMembersAndPats()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "moderator", "moderator@test.com", OrganizationRole.Moderator);
        await SeedOrgMember(org.Id, "member", "member@test.com");
        var moderatorTarget = await SeedPlaceholder(org.Id, "Moderator Target");
        var moderatorClaim = await CreateClaimAsync(org.Id, moderatorTarget.Id, "moderator");

        AuthenticateAs("moderator");
        var response = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{moderatorClaim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        AuthenticateAs("member");
        response = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{moderatorClaim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        AuthenticateAsPat("owner", PatScopes.Write, org.Id);
        var requests = new HttpRequestMessage[]
        {
            new(HttpMethod.Get, $"api/v3/organizations/{org.Id}/members/claimable"),
            JsonRequest(HttpMethod.Post, $"api/v3/organizations/{org.Id}/claim-requests",
                new CreateMembershipClaimRequest { OrganizationMembershipId = moderatorTarget.Id }),
            new(HttpMethod.Get, $"api/v3/organizations/{org.Id}/claim-requests/mine"),
            new(HttpMethod.Get, $"api/v3/organizations/{org.Id}/claim-requests"),
            new(HttpMethod.Delete, $"api/v3/organizations/{org.Id}/claim-requests/{moderatorClaim.Id}"),
            new(HttpMethod.Post, $"api/v3/organizations/{org.Id}/claim-requests/{moderatorClaim.Id}/approve"),
            JsonRequest(HttpMethod.Post,
                $"api/v3/organizations/{org.Id}/claim-requests/{moderatorClaim.Id}/reject",
                new ReviewMembershipClaimRequest()),
        };
        foreach (var request in requests)
        {
            using var patResponse = await Client.SendAsync(request);
            Assert.Equal(HttpStatusCode.Forbidden, patResponse.StatusCode);
        }
    }

    [Fact]
    public async Task Approve_AfterClaimantPlayedMatch_RejectsWithoutMutation()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, _, ownerPlayer) = await SeedTestUser(
            org.Id, league.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var (_, requesterMembership, requesterPlayer) = await SeedTestUser(
            org.Id, league.Id, "requester", "requester@test.com");
        var target = await SeedPlaceholder(org.Id, "Target");
        var claim = await CreateClaimAsync(org.Id, target.Id, "requester");

        AuthenticateAs("owner");
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, requesterPlayer.Id));
        Assert.Equal(HttpStatusCode.Created, matchResponse.StatusCode);
        var response = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{claim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("match activity", await response.Content.ReadAsStringAsync());

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Null((await db.OrganizationMemberships.SingleAsync(m => m.Id == target.Id)).UserId);
        Assert.Equal(MembershipStatus.Active,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == requesterMembership.Id)).Status);
        Assert.Equal(MembershipClaimStatus.Pending,
            (await db.MembershipClaimRequests.SingleAsync(c => c.Id == claim.Id)).Status);
    }

    [Fact]
    public async Task Approve_AfterClaimantRemoval_ReturnsBadRequest()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var (_, requesterMembership) = await SeedOrgMember(org.Id, "requester", "requester@test.com");
        var target = await SeedPlaceholder(org.Id, "Target");
        var claim = await CreateClaimAsync(org.Id, target.Id, "requester");

        AuthenticateAs("owner");
        var remove = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{requesterMembership.Id}");
        Assert.Equal(HttpStatusCode.NoContent, remove.StatusCode);
        var response = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{claim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Approve_IsIdempotentAndRollsBackWhenTargetWasClaimed()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "requester", "requester@test.com");
        var target = await SeedPlaceholder(org.Id, "Target");
        var claim = await CreateClaimAsync(org.Id, target.Id, "requester");

        var first = await ApproveClaimAsync(org.Id, claim.Id, "owner");
        var second = await ApproveClaimAsync(org.Id, claim.Id, "owner");
        Assert.Equal(first.Id, second.Id);

        var otherOrg = await CreateOrganization("Claimed Target", "claimed-target");
        await SeedOrgMember(otherOrg.Id, "owner-2", "owner2@test.com", OrganizationRole.Owner);
        var (_, requesterMembership) = await SeedOrgMember(
            otherOrg.Id, "requester-2", "requester2@test.com");
        var contested = await SeedPlaceholder(otherOrg.Id, "Contested");
        var contestedClaim = await CreateClaimAsync(otherOrg.Id, contested.Id, "requester-2");
        var otherUser = await SeedUser("other", "other@test.com");
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            var stored = await db.OrganizationMemberships.SingleAsync(m => m.Id == contested.Id);
            stored.UserId = otherUser.Id;
            stored.Status = MembershipStatus.Active;
            await db.SaveChangesAsync();
        }

        AuthenticateAs("owner-2");
        var response = await Client.PostAsync(
            $"api/v3/organizations/{otherOrg.Id}/claim-requests/{contestedClaim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var verificationScope = Factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(MembershipStatus.Active,
            (await verificationDb.OrganizationMemberships.SingleAsync(m => m.Id == requesterMembership.Id)).Status);
        Assert.Equal(MembershipClaimStatus.Pending,
            (await verificationDb.MembershipClaimRequests.SingleAsync(c => c.Id == contestedClaim.Id)).Status);
    }

    [Fact]
    public async Task RejectAndCancel_KeepMembershipsAndEnforceOwnership()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "requester", "requester@test.com");
        await SeedOrgMember(org.Id, "unrelated", "unrelated@test.com");
        var rejectedTarget = await SeedPlaceholder(org.Id, "Rejected");
        var rejectedClaim = await CreateClaimAsync(org.Id, rejectedTarget.Id, "requester");

        AuthenticateAs("owner");
        var rejectResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{rejectedClaim.Id}/reject",
            new ReviewMembershipClaimRequest { ReviewNote = "Not the same person" });
        Assert.Equal(HttpStatusCode.OK, rejectResponse.StatusCode);

        var cancelledTarget = await SeedPlaceholder(org.Id, "Cancelled");
        var cancelledClaim = await CreateClaimAsync(org.Id, cancelledTarget.Id, "requester");
        AuthenticateAs("requester");
        var cancelResponse = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{cancelledClaim.Id}");
        Assert.Equal(HttpStatusCode.NoContent, cancelResponse.StatusCode);

        var protectedTarget = await SeedPlaceholder(org.Id, "Protected");
        var protectedClaim = await CreateClaimAsync(org.Id, protectedTarget.Id, "requester");
        AuthenticateAs("unrelated");
        var forbidden = await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{protectedClaim.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Null((await db.OrganizationMemberships.SingleAsync(m => m.Id == rejectedTarget.Id)).UserId);
        Assert.Equal(MembershipClaimStatus.Rejected,
            (await db.MembershipClaimRequests.SingleAsync(c => c.Id == rejectedClaim.Id)).Status);
        Assert.Equal(MembershipClaimStatus.Cancelled,
            (await db.MembershipClaimRequests.SingleAsync(c => c.Id == cancelledClaim.Id)).Status);
    }

    [Fact]
    public async Task RemoveMember_CancelsRequestsByRequesterAndTarget()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var (_, firstRequester) = await SeedOrgMember(org.Id, "requester-1", "one@test.com");
        await SeedOrgMember(org.Id, "requester-2", "two@test.com");
        var firstTarget = await SeedPlaceholder(org.Id, "First");
        var secondTarget = await SeedPlaceholder(org.Id, "Second");
        var firstClaim = await CreateClaimAsync(org.Id, firstTarget.Id, "requester-1");
        var secondClaim = await CreateClaimAsync(org.Id, secondTarget.Id, "requester-2");

        AuthenticateAs("owner");
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{firstRequester.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/members/{secondTarget.Id}")).StatusCode);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(MembershipClaimStatus.Cancelled,
            (await db.MembershipClaimRequests.SingleAsync(c => c.Id == firstClaim.Id)).Status);
        Assert.Equal(MembershipClaimStatus.Cancelled,
            (await db.MembershipClaimRequests.SingleAsync(c => c.Id == secondClaim.Id)).Status);
    }

    [Fact]
    public async Task Approve_EnforcesTenantIsolation()
    {
        var orgA = await CreateOrganization("Org A", "org-a");
        var orgB = await CreateOrganization("Org B", "org-b");
        var (owner, _) = await SeedOrgMember(
            orgA.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedExistingUserMembership(orgB.Id, owner.Id, OrganizationRole.Owner);
        await SeedOrgMember(orgA.Id, "requester", "requester@test.com");
        var target = await SeedPlaceholder(orgA.Id, "Target");
        var claim = await CreateClaimAsync(orgA.Id, target.Id, "requester");

        AuthenticateAs("owner");
        var response = await Client.PostAsync(
            $"api/v3/organizations/{orgB.Id}/claim-requests/{claim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PhaseZero_ModeratorCannotRedirectOwnerInvite()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "moderator", "moderator@test.com", OrganizationRole.Moderator);
        AuthenticateAs("owner");
        var invite = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "owner2@example.com", Role = OrganizationRole.Owner });
        var invited = await ReadJsonAsync<OrganizationMemberResponse>(invite);
        Assert.NotNull(invited);

        AuthenticateAs("moderator");
        var response = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{invited.Id}/profile",
            new UpdateMemberProfileRequest { Email = "redirect@example.com" });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task EmailInviteClaim_PreservesNameHandlesCaseAndRejectsAmbiguity()
    {
        var org = await CreateOrganization("Email Claim", "email-claim");
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var target = await SeedPlaceholder(
            org.Id, "Guest Bob", "Guest.Bob@Test.com", MembershipStatus.Invited);
        var invite = await CreateInviteLinkForAsync(org.Id, "owner");

        AuthenticateAs("guest-bob", email: "guest.bob@test.com");
        var joinResponse = await Client.PostAsync($"api/v3/invites/{invite.Code}/join", null);
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);
        var joined = await ReadJsonAsync<JoinOrganizationResponse>(joinResponse);
        Assert.Equal(target.Id, joined!.MembershipId);

        var exactOrg = await CreateOrganization("Exact Claim", "exact-claim");
        await SeedOrgMember(exactOrg.Id, "exact-owner", "exact-owner@test.com", OrganizationRole.Owner);
        var exactTarget = await SeedPlaceholder(
            exactOrg.Id, "Exact", "exact@test.com", MembershipStatus.Invited);
        var caseVariant = await SeedPlaceholder(
            exactOrg.Id, "Case Variant", "EXACT@test.com", MembershipStatus.Invited);
        var exactInvite = await CreateInviteLinkForAsync(exactOrg.Id, "exact-owner");

        AuthenticateAs("exact-user", email: "exact@test.com");
        var exactResponse = await Client.PostAsync($"api/v3/invites/{exactInvite.Code}/join", null);
        Assert.Equal(HttpStatusCode.OK, exactResponse.StatusCode);
        Assert.Equal(exactTarget.Id,
            (await ReadJsonAsync<JoinOrganizationResponse>(exactResponse))!.MembershipId);

        var ambiguousOrg = await CreateOrganization("Ambiguous Claim", "ambiguous-claim");
        await SeedOrgMember(
            ambiguousOrg.Id, "ambiguous-owner", "ambiguous-owner@test.com", OrganizationRole.Owner);
        var firstAmbiguous = await SeedPlaceholder(
            ambiguousOrg.Id, "First", "Ambiguous@Test.com", MembershipStatus.Invited);
        var secondAmbiguous = await SeedPlaceholder(
            ambiguousOrg.Id, "Second", "AMBIGUOUS@test.com", MembershipStatus.Invited);
        var ambiguousInvite = await CreateInviteLinkForAsync(ambiguousOrg.Id, "ambiguous-owner");

        AuthenticateAs("ambiguous-user", email: "ambiguous@test.com");
        var ambiguousResponse = await Client.PostAsync(
            $"api/v3/invites/{ambiguousInvite.Code}/join", null);
        Assert.Equal(HttpStatusCode.BadRequest, ambiguousResponse.StatusCode);
        Assert.Contains("Multiple invitations", await ambiguousResponse.Content.ReadAsStringAsync());

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal("Guest Bob",
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == target.Id)).DisplayName);
        Assert.Equal(MembershipStatus.Invited,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == caseVariant.Id)).Status);
        Assert.All(await db.OrganizationMemberships
                .Where(m => m.Id == firstAmbiguous.Id || m.Id == secondAmbiguous.Id)
                .ToListAsync(),
            membership =>
            {
                Assert.Null(membership.UserId);
                Assert.Equal(MembershipStatus.Invited, membership.Status);
            });
    }

    [Fact]
    public async Task AutoClaimInvites_MatchesCaseInsensitivelyAndPreservesNames()
    {
        var firstOrg = await CreateOrganization("Auto Claim One", "auto-claim-one");
        var secondOrg = await CreateOrganization("Auto Claim Two", "auto-claim-two");
        var joinedOrg = await CreateOrganization("Auto Claim Joined", "auto-claim-joined");
        var first = await SeedPlaceholder(
            firstOrg.Id, "First Guest", "AUTO@Test.com", MembershipStatus.Invited);
        var second = await SeedPlaceholder(
            secondOrg.Id, "Second Guest", "Auto@test.com", MembershipStatus.Invited);
        await SeedOrgMember(joinedOrg.Id, "auto-user", "auto@test.com");
        var joinedVariantOne = await SeedPlaceholder(
            joinedOrg.Id, "Joined Variant One", "AUTO@Test.com", MembershipStatus.Invited);
        var joinedVariantTwo = await SeedPlaceholder(
            joinedOrg.Id, "Joined Variant Two", "Auto@Test.com", MembershipStatus.Invited);

        AuthenticateAs("auto-user", email: "auto@test.com");
        var response = await Client.GetAsync("api/v3/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var memberships = await db.OrganizationMemberships
            .Where(m => m.Id == first.Id || m.Id == second.Id)
            .OrderBy(m => m.DisplayName)
            .ToListAsync();
        Assert.All(memberships, membership =>
        {
            Assert.NotNull(membership.UserId);
            Assert.Equal(MembershipStatus.Active, membership.Status);
        });
        Assert.Equal(new[] { "First Guest", "Second Guest" },
            memberships.Select(m => m.DisplayName).ToArray());
        Assert.All(await db.OrganizationMemberships
                .Where(m => m.Id == joinedVariantOne.Id || m.Id == joinedVariantTwo.Id)
                .ToListAsync(),
            membership =>
            {
                Assert.Null(membership.UserId);
                Assert.Equal(MembershipStatus.Invited, membership.Status);
            });
    }

    [Fact]
    public async Task MatchSubmitEmailReuse_PrefersExactCaseAndRejectsAmbiguity()
    {
        var org = await CreateOrganization("Submit Email", "submit-email");
        var league = await CreateLeague(org.Id, "Submit Email League", "submit-email-league", teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, _, ownerPlayer) = await SeedTestUser(
            org.Id, league.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var exactTarget = await SeedPlaceholder(
            org.Id, "Exact Target", "exact-player@test.com", MembershipStatus.Invited);
        var exactVariant = await SeedPlaceholder(
            org.Id, "Exact Variant", "EXACT-PLAYER@test.com", MembershipStatus.Invited);

        AuthenticateAs("owner");
        var exactResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, new CreateMatchPlayerRequest
            {
                DisplayName = "Ignored Name",
                Email = "exact-player@test.com",
            }));
        Assert.Equal(HttpStatusCode.Created, exactResponse.StatusCode);

        var unnamedTarget = await SeedPlaceholder(
            org.Id, null, "Unnamed@Test.com", MembershipStatus.Invited);
        var populatedResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, new CreateMatchPlayerRequest
            {
                DisplayName = "Named After Lock",
                Username = "named-after-lock",
                Email = "unnamed@test.com",
            }));
        Assert.Equal(HttpStatusCode.Created, populatedResponse.StatusCode);

        var firstAmbiguous = await SeedPlaceholder(
            org.Id, "First Ambiguous", "Ambiguous-Player@Test.com", MembershipStatus.Invited);
        var secondAmbiguous = await SeedPlaceholder(
            org.Id, "Second Ambiguous", "AMBIGUOUS-PLAYER@test.com", MembershipStatus.Invited);
        var ambiguousResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, new CreateMatchPlayerRequest
            {
                DisplayName = "Ambiguous",
                Email = "ambiguous-player@test.com",
            }));
        Assert.Equal(HttpStatusCode.BadRequest, ambiguousResponse.StatusCode);
        Assert.Contains("Multiple organization members", await ambiguousResponse.Content.ReadAsStringAsync());

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.True(await db.LeaguePlayers.AnyAsync(lp =>
            lp.LeagueId == league.Id && lp.OrganizationMembershipId == exactTarget.Id));
        Assert.False(await db.LeaguePlayers.AnyAsync(lp =>
            lp.LeagueId == league.Id && lp.OrganizationMembershipId == exactVariant.Id));
        var populated = await db.OrganizationMemberships.SingleAsync(m => m.Id == unnamedTarget.Id);
        Assert.Equal("Named After Lock", populated.DisplayName);
        Assert.Equal("named-after-lock", populated.Username);
        Assert.False(await db.LeaguePlayers.AnyAsync(lp =>
            lp.OrganizationMembershipId == firstAmbiguous.Id
            || lp.OrganizationMembershipId == secondAmbiguous.Id));
    }

    [Fact]
    public async Task Approve_RechecksRemovedTargetWithoutMutatingClaim()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "requester", "requester@test.com");
        var target = await SeedPlaceholder(org.Id, "Target");
        var claim = await CreateClaimAsync(org.Id, target.Id, "requester");
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == target.Id)).Status = MembershipStatus.Removed;
            await db.SaveChangesAsync();
        }

        AuthenticateAs("owner");
        var response = await Client.PostAsync(
            $"api/v3/organizations/{org.Id}/claim-requests/{claim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var verificationScope = Factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(MembershipStatus.Removed,
            (await verificationDb.OrganizationMemberships.SingleAsync(m => m.Id == target.Id)).Status);
        Assert.Equal(MembershipClaimStatus.Pending,
            (await verificationDb.MembershipClaimRequests.SingleAsync(c => c.Id == claim.Id)).Status);
    }

    [Fact]
    public async Task MembershipCreationRaces_SerializeWithApprovalAndKeepTombstoneEmpty()
    {
        var joinOrg = await CreateOrganization("Join Race", "join-race");
        var joinLeague = await CreateLeague(joinOrg.Id, "Join League", "join-league", teamSize: 1);
        var (_, joinMembership) = await SeedOrgMember(
            joinOrg.Id, "join-owner", "join@test.com", OrganizationRole.Owner);
        var joinTarget = await SeedPlaceholder(joinOrg.Id, "Join Target");
        var joinClaim = await CreateClaimAsync(joinOrg.Id, joinTarget.Id, "join-owner");

        await using (var blocker = await LockRowAsync("organization_memberships", joinMembership.Id))
        {
            AuthenticateAs("join-owner");
            var approveTask = Client.PostAsync(
                $"api/v3/organizations/{joinOrg.Id}/claim-requests/{joinClaim.Id}/approve", null);
            await Task.Delay(250);
            var joinTask = Client.PostAsync(
                $"api/v3/organizations/{joinOrg.Id}/leagues/{joinLeague.Id}/players", null);
            await Task.Delay(250);
            await blocker.ReleaseAsync();

            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await joinTask).StatusCode);
        }

        var submitOrg = await CreateOrganization("Submit Race", "submit-race");
        var submitLeague = await CreateLeague(
            submitOrg.Id, "Submit League", "submit-league", teamSize: 1);
        await CreateSeason(submitOrg.Id, submitLeague.Id);
        var (_, submitMembership) = await SeedOrgMember(
            submitOrg.Id, "submit-owner", "submit@test.com", OrganizationRole.Owner);
        var (_, _, opponent) = await SeedTestUser(
            submitOrg.Id, submitLeague.Id, "opponent", "opponent@test.com");
        var submitTarget = await SeedPlaceholder(submitOrg.Id, "Submit Target");
        var submitClaim = await CreateClaimAsync(submitOrg.Id, submitTarget.Id, "submit-owner");

        await using (var blocker = await LockRowAsync("organization_memberships", submitMembership.Id))
        {
            AuthenticateAs("submit-owner");
            var approveTask = Client.PostAsync(
                $"api/v3/organizations/{submitOrg.Id}/claim-requests/{submitClaim.Id}/approve", null);
            await Task.Delay(250);
            var submitTask = Client.PostAsJsonAsync(
                $"api/v3/organizations/{submitOrg.Id}/leagues/{submitLeague.Id}/matches",
                OneVsOneMembership(submitMembership.Id, opponent.Id));
            await Task.Delay(250);
            await blocker.ReleaseAsync();

            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await submitTask).StatusCode);
        }

        var invitedOrg = await CreateOrganization("Invited Match", "invited-match");
        var invitedLeague = await CreateLeague(
            invitedOrg.Id, "Invited League", "invited-league", teamSize: 1);
        await CreateSeason(invitedOrg.Id, invitedLeague.Id);
        var (_, _, submitter) = await SeedTestUser(
            invitedOrg.Id, invitedLeague.Id, "invited-owner", "invited-owner@test.com",
            OrganizationRole.Owner);
        var invited = await SeedPlaceholder(
            invitedOrg.Id, "Invited Player", "invited@test.com", MembershipStatus.Invited);
        AuthenticateAs("invited-owner");
        var invitedResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{invitedOrg.Id}/leagues/{invitedLeague.Id}/matches",
            OneVsOneMembership(invited.Id, submitter.Id));
        Assert.Equal(HttpStatusCode.Created, invitedResponse.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.False(await db.LeaguePlayers.AnyAsync(lp =>
            lp.OrganizationMembershipId == joinMembership.Id
            || lp.OrganizationMembershipId == submitMembership.Id));
        Assert.True(await db.LeaguePlayers.AnyAsync(lp => lp.OrganizationMembershipId == invited.Id));
    }

    [Fact]
    public async Task MatchEdit_HoldsMembershipLockUntilParticipationIsSaved()
    {
        var org = await CreateOrganization("Edit Race", "edit-race");
        var league = await CreateLeague(org.Id, "Edit League", "edit-league", teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, _, ownerPlayer) = await SeedTestUser(
            org.Id, league.Id, "edit-owner", "edit-owner@test.com", OrganizationRole.Owner);
        var (_, _, opponent) = await SeedTestUser(
            org.Id, league.Id, "edit-opponent", "edit-opponent@test.com");
        var (_, requesterMembership) = await SeedOrgMember(
            org.Id, "edit-requester", "edit-requester@test.com");

        AuthenticateAs("edit-owner");
        var originalResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, opponent.Id));
        var original = await ReadJsonAsync<MatchResponse>(originalResponse);
        Assert.NotNull(original);

        var target = await SeedPlaceholder(org.Id, "Edit Target");
        var claim = await CreateClaimAsync(org.Id, target.Id, "edit-requester");
        var editGate = new DbCommandGate("DELETE FROM match_team_players", CommandGateTiming.Before);

        await using var editFactory = new IntegrationTestFactory(PostgresFixture, editGate);
        await using var reviewFactory = new IntegrationTestFactory(PostgresFixture);
        using var editClient = editFactory.CreateClient();
        using var reviewClient = reviewFactory.CreateClient();
        editFactory.ClaimsProvider.SetUser("edit-owner", "edit-owner@test.com");
        reviewFactory.ClaimsProvider.SetUser("edit-owner", "edit-owner@test.com");

        var editTask = editClient.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{original.Id}",
            OneVsOneMemberships(requesterMembership.Id, target.Id));
        try
        {
            await editGate.WaitUntilReachedAsync();
            var approveTask = reviewClient.PostAsync(
                $"api/v3/organizations/{org.Id}/claim-requests/{claim.Id}/approve", null);
            await WaitForBlockedMembershipLockAsync();
            Assert.False(approveTask.IsCompleted);

            editGate.Release();
            Assert.Equal(HttpStatusCode.OK, (await editTask).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await approveTask).StatusCode);
        }
        finally
        {
            editGate.Release();
        }

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(MembershipStatus.Active,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == requesterMembership.Id)).Status);
        Assert.True(await db.MatchTeamPlayers.AnyAsync(p =>
            p.LeaguePlayer.OrganizationMembershipId == requesterMembership.Id));
        Assert.True(await db.MatchTeamPlayers.AnyAsync(p =>
            p.LeaguePlayer.OrganizationMembershipId == target.Id));
    }

    [Fact]
    public async Task MatchEdits_WithReversedMembershipOrder_DoNotDeadlock()
    {
        var org = await CreateOrganization("Edit Order", "edit-order");
        var league = await CreateLeague(org.Id, "Edit Order League", "edit-order-league", teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, _, firstOriginalPlayer) = await SeedTestUser(
            org.Id, league.Id, "order-owner", "order-owner@test.com", OrganizationRole.Owner);
        var (_, _, secondOriginalPlayer) = await SeedTestUser(
            org.Id, league.Id, "order-second", "order-second@test.com");
        var (_, _, thirdOriginalPlayer) = await SeedTestUser(
            org.Id, league.Id, "order-third", "order-third@test.com");
        var (_, _, fourthOriginalPlayer) = await SeedTestUser(
            org.Id, league.Id, "order-fourth", "order-fourth@test.com");

        AuthenticateAs("order-owner");
        var firstOriginalResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(firstOriginalPlayer.Id, secondOriginalPlayer.Id));
        var secondOriginalResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(thirdOriginalPlayer.Id, fourthOriginalPlayer.Id));
        var firstOriginal = await ReadJsonAsync<MatchResponse>(firstOriginalResponse);
        var secondOriginal = await ReadJsonAsync<MatchResponse>(secondOriginalResponse);
        Assert.NotNull(firstOriginal);
        Assert.NotNull(secondOriginal);

        var firstMembership = await SeedPlaceholder(org.Id, "Order First");
        var secondMembership = await SeedPlaceholder(org.Id, "Order Second");
        var firstGate = new DbCommandGate("FOR UPDATE", CommandGateTiming.After);

        await using var firstFactory = new IntegrationTestFactory(PostgresFixture, firstGate);
        await using var secondFactory = new IntegrationTestFactory(PostgresFixture);
        using var firstClient = firstFactory.CreateClient();
        using var secondClient = secondFactory.CreateClient();
        firstFactory.ClaimsProvider.SetUser("order-owner", "order-owner@test.com");
        secondFactory.ClaimsProvider.SetUser("order-owner", "order-owner@test.com");

        var firstEditTask = firstClient.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{firstOriginal.Id}",
            OneVsOneMemberships(firstMembership.Id, secondMembership.Id));
        Task<HttpResponseMessage>? secondEditTask = null;
        try
        {
            await firstGate.WaitUntilReachedAsync();
            secondEditTask = secondClient.PatchAsJsonAsync(
                $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches/{secondOriginal.Id}",
                OneVsOneMemberships(secondMembership.Id, firstMembership.Id));
            await WaitForBlockedMembershipLockAsync();

            firstGate.Release();
            Assert.Equal(HttpStatusCode.OK, (await firstEditTask).StatusCode);
            Assert.NotNull(secondEditTask);
            Assert.Equal(HttpStatusCode.OK, (await secondEditTask).StatusCode);
        }
        finally
        {
            firstGate.Release();
        }
    }

    [Fact]
    public async Task SelfApproval_AllowsOwnerButRejectsModerator()
    {
        var ownerOrg = await CreateOrganization("Owner Self", "owner-self");
        await SeedOrgMember(ownerOrg.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var ownerTarget = await SeedPlaceholder(ownerOrg.Id, "Owner Target");
        var ownerClaim = await CreateClaimAsync(ownerOrg.Id, ownerTarget.Id, "owner");
        Assert.Equal(MembershipClaimStatus.Approved,
            (await ApproveClaimAsync(ownerOrg.Id, ownerClaim.Id, "owner")).Status);

        var moderatorOrg = await CreateOrganization("Moderator Self", "moderator-self");
        await SeedOrgMember(moderatorOrg.Id, "moderator", "moderator@test.com",
            OrganizationRole.Moderator);
        var moderatorTarget = await SeedPlaceholder(moderatorOrg.Id, "Moderator Target");
        var moderatorClaim = await CreateClaimAsync(
            moderatorOrg.Id, moderatorTarget.Id, "moderator");
        AuthenticateAs("moderator");
        var response = await Client.PostAsync(
            $"api/v3/organizations/{moderatorOrg.Id}/claim-requests/{moderatorClaim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PlaceholderEmailEdit_TransitionsStatusAndSupportsBothClaimPaths()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var target = await SeedPlaceholder(org.Id, "Pre-signup Guest");

        AuthenticateAs("owner");
        var setEmail = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{target.Id}/profile",
            new UpdateMemberProfileRequest { Email = "guest@test.com" });
        Assert.Equal(HttpStatusCode.OK, setEmail.StatusCode);
        Assert.Equal(MembershipStatus.Invited,
            (await ReadJsonAsync<OrganizationMemberResponse>(setEmail))!.Status);

        await SeedUser("guest", "guest@test.com");
        AuthenticateAs("guest", email: "guest@test.com");
        Assert.Equal(HttpStatusCode.OK, (await Client.GetAsync("api/v3/me")).StatusCode);

        var clearTarget = await SeedPlaceholder(
            org.Id, "Clear Email", "clear@test.com", MembershipStatus.Invited);
        AuthenticateAs("owner");
        var clearEmail = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{clearTarget.Id}/profile",
            new UpdateMemberProfileRequest { Email = " " });
        Assert.Equal(MembershipStatus.Active,
            (await ReadJsonAsync<OrganizationMemberResponse>(clearEmail))!.Status);

        await SeedOrgMember(org.Id, "joined", "joined@test.com");
        var joinedTarget = await SeedPlaceholder(org.Id, "Already Joined");
        AuthenticateAs("owner");
        await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{joinedTarget.Id}/profile",
            new UpdateMemberProfileRequest { Email = "joined@test.com" });
        AuthenticateAs("joined", email: "joined@test.com", emailVerified: true);
        var claimableResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/members/claimable");
        var claimable = await ReadJsonAsync<ClaimableMembershipsResponse>(claimableResponse);
        Assert.Contains(claimable!.Memberships, m => m.OrganizationMembershipId == joinedTarget.Id);
    }

    [Fact]
    public async Task MembershipWrites_RacingApprovalUseXminInsteadOfLosingUpdates()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(org.Id, "moderator", "moderator@test.com", OrganizationRole.Moderator);
        AuthenticateAs("owner");
        var inviteResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members",
            new InviteMemberRequest { Email = "invite@test.com", Role = OrganizationRole.Member });
        var invite = await ReadJsonAsync<OrganizationMemberResponse>(inviteResponse);
        Assert.NotNull(invite);

        await using (var ownerFactory = new IntegrationTestFactory(PostgresFixture))
        await using (var moderatorFactory = new IntegrationTestFactory(PostgresFixture))
        using (var ownerClient = ownerFactory.CreateClient())
        using (var moderatorClient = moderatorFactory.CreateClient())
        await using (var blocker = await LockRowAsync("organization_memberships", invite.Id))
        {
            ownerFactory.ClaimsProvider.SetUser("owner", "owner@test.com");
            moderatorFactory.ClaimsProvider.SetUser("moderator", "moderator@test.com");
            var promoteTask = ownerClient.PatchAsJsonAsync(
                $"api/v3/organizations/{org.Id}/members/{invite.Id}",
                new UpdateMemberRoleRequest { Role = OrganizationRole.Owner });
            var emailTask = moderatorClient.PatchAsJsonAsync(
                $"api/v3/organizations/{org.Id}/members/{invite.Id}/profile",
                new UpdateMemberProfileRequest { Email = "changed@test.com" });
            await Task.Delay(350);
            await blocker.ReleaseAsync();
            var statuses = new[] { (await promoteTask).StatusCode, (await emailTask).StatusCode };
            Assert.Contains(HttpStatusCode.OK, statuses);
            Assert.Contains(HttpStatusCode.Conflict, statuses);
        }

        var raceOrg = await CreateOrganization("Approval Race", "approval-race");
        await SeedOrgMember(raceOrg.Id, "race-owner", "race-owner@test.com", OrganizationRole.Owner);
        var (_, claimant) = await SeedOrgMember(
            raceOrg.Id, "claimant", "claimant@test.com", OrganizationRole.Moderator);
        var target = await SeedPlaceholder(raceOrg.Id, "Race Target");
        var claim = await CreateClaimAsync(raceOrg.Id, target.Id, "claimant");

        await using (var reviewFactory = new IntegrationTestFactory(PostgresFixture))
        await using (var roleFactory = new IntegrationTestFactory(PostgresFixture))
        using (var reviewClient = reviewFactory.CreateClient())
        using (var roleClient = roleFactory.CreateClient())
        await using (var blocker = await LockRowAsync("organization_memberships", claimant.Id))
        {
            reviewFactory.ClaimsProvider.SetUser("race-owner", "race-owner@test.com");
            roleFactory.ClaimsProvider.SetUser("race-owner", "race-owner@test.com");
            var approveTask = reviewClient.PostAsync(
                $"api/v3/organizations/{raceOrg.Id}/claim-requests/{claim.Id}/approve", null);
            await Task.Delay(250);
            var demoteTask = roleClient.PatchAsJsonAsync(
                $"api/v3/organizations/{raceOrg.Id}/members/{claimant.Id}",
                new UpdateMemberRoleRequest { Role = OrganizationRole.Member });
            await Task.Delay(250);
            await blocker.ReleaseAsync();
            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await demoteTask).StatusCode);
        }
    }

    [Fact]
    public async Task MatchActivity_RacingApprovalSerializesAtTheLeaguePlayerDelete()
    {
        var insertFirst = await SeedMatchClaimRaceAsync("insert-first");
        var beforeDelete = new DbCommandGate("DELETE FROM league_players", CommandGateTiming.Before);
        await using (var reviewFactory = new IntegrationTestFactory(PostgresFixture, beforeDelete))
        await using (var matchFactory = new IntegrationTestFactory(PostgresFixture))
        using (var reviewClient = reviewFactory.CreateClient())
        using (var matchClient = matchFactory.CreateClient())
        {
            reviewFactory.ClaimsProvider.SetUser("insert-first-owner", "insert-first-owner@test.com");
            matchFactory.ClaimsProvider.SetUser("insert-first-owner", "insert-first-owner@test.com");
            var approveTask = reviewClient.PostAsync(
                $"api/v3/organizations/{insertFirst.OrgId}/claim-requests/{insertFirst.ClaimId}/approve", null);
            try
            {
                await beforeDelete.WaitUntilReachedAsync();
                var matchResponse = await matchClient.PostAsJsonAsync(
                    $"api/v3/organizations/{insertFirst.OrgId}/leagues/{insertFirst.LeagueId}/matches",
                    OneVsOne(insertFirst.OwnerPlayerId, insertFirst.RequesterPlayerId));
                Assert.Equal(HttpStatusCode.Created, matchResponse.StatusCode);
            }
            finally
            {
                beforeDelete.Release();
            }

            Assert.Equal(HttpStatusCode.Conflict, (await approveTask).StatusCode);
        }

        var deleteFirst = await SeedMatchClaimRaceAsync("delete-first");
        var afterDelete = new DbCommandGate("DELETE FROM league_players", CommandGateTiming.After);
        await using (var reviewFactory = new IntegrationTestFactory(PostgresFixture, afterDelete))
        await using (var matchFactory = new IntegrationTestFactory(PostgresFixture))
        using (var reviewClient = reviewFactory.CreateClient())
        using (var matchClient = matchFactory.CreateClient())
        {
            reviewFactory.ClaimsProvider.SetUser("delete-first-owner", "delete-first-owner@test.com");
            matchFactory.ClaimsProvider.SetUser("delete-first-owner", "delete-first-owner@test.com");
            var approveTask = reviewClient.PostAsync(
                $"api/v3/organizations/{deleteFirst.OrgId}/claim-requests/{deleteFirst.ClaimId}/approve", null);
            Task<HttpResponseMessage>? matchTask = null;
            try
            {
                await afterDelete.WaitUntilReachedAsync();
                matchTask = matchClient.PostAsJsonAsync(
                    $"api/v3/organizations/{deleteFirst.OrgId}/leagues/{deleteFirst.LeagueId}/matches",
                    OneVsOne(deleteFirst.OwnerPlayerId, deleteFirst.RequesterPlayerId));
                await Task.Delay(250);
                Assert.False(matchTask.IsCompleted);
            }
            finally
            {
                afterDelete.Release();
            }

            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.NotNull(matchTask);
            Assert.Equal(HttpStatusCode.Conflict, (await matchTask).StatusCode);
        }

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal(MembershipStatus.Active,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == insertFirst.RequesterMembershipId)).Status);
        Assert.True(await db.MatchTeamPlayers.AnyAsync(p =>
            p.LeaguePlayerId == insertFirst.RequesterPlayerId));
        Assert.Equal(MembershipStatus.Removed,
            (await db.OrganizationMemberships.SingleAsync(m => m.Id == deleteFirst.RequesterMembershipId)).Status);
        Assert.False(await db.LeaguePlayers.AnyAsync(lp =>
            lp.OrganizationMembershipId == deleteFirst.RequesterMembershipId));
        Assert.False(await db.MatchTeamPlayers.AnyAsync(p =>
            p.LeaguePlayerId == deleteFirst.RequesterPlayerId));
    }

    [Fact]
    public async Task TerminalDecisions_RacingApprovalCannotOverwriteApprovedStatus()
    {
        var cancelOrg = await CreateOrganization("Cancel Race", "cancel-race");
        await SeedOrgMember(cancelOrg.Id, "cancel-owner", "cancel-owner@test.com", OrganizationRole.Owner);
        var cancelTarget = await SeedPlaceholder(cancelOrg.Id, "Cancel Target");
        var cancelClaim = await CreateClaimAsync(cancelOrg.Id, cancelTarget.Id, "cancel-owner");

        await using (var blocker = await LockRowAsync("membership_claim_requests", cancelClaim.Id))
        {
            AuthenticateAs("cancel-owner");
            var approveTask = Client.PostAsync(
                $"api/v3/organizations/{cancelOrg.Id}/claim-requests/{cancelClaim.Id}/approve", null);
            await Task.Delay(250);
            var cancelTask = Client.DeleteAsync(
                $"api/v3/organizations/{cancelOrg.Id}/claim-requests/{cancelClaim.Id}");
            await Task.Delay(250);
            await blocker.ReleaseAsync();
            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await cancelTask).StatusCode);
        }

        var rejectOrg = await CreateOrganization("Reject Race", "reject-race");
        await SeedOrgMember(rejectOrg.Id, "reject-owner", "reject-owner@test.com", OrganizationRole.Owner);
        var rejectTarget = await SeedPlaceholder(rejectOrg.Id, "Reject Target");
        var rejectClaim = await CreateClaimAsync(rejectOrg.Id, rejectTarget.Id, "reject-owner");

        await using (var blocker = await LockRowAsync("membership_claim_requests", rejectClaim.Id))
        {
            AuthenticateAs("reject-owner");
            var approveTask = Client.PostAsync(
                $"api/v3/organizations/{rejectOrg.Id}/claim-requests/{rejectClaim.Id}/approve", null);
            await Task.Delay(250);
            var rejectTask = Client.PostAsJsonAsync(
                $"api/v3/organizations/{rejectOrg.Id}/claim-requests/{rejectClaim.Id}/reject",
                new ReviewMembershipClaimRequest());
            await Task.Delay(250);
            await blocker.ReleaseAsync();
            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await rejectTask).StatusCode);
        }
    }

    [Fact]
    public async Task PendingMatchActivity_IgnoresDeclinedDebrisButBlocksLiveMatches()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 1);
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var (_, requesterMembership, requesterPlayer) = await SeedTestUser(
            org.Id, league.Id, "requester", "requester@test.com");
        var target = await SeedPlaceholder(org.Id, "Target");
        await SeedPendingMatchAsync(org.Id, league.Id, requesterPlayer.Id, AcceptanceStatus.Declined);

        var claim = await CreateClaimAsync(org.Id, target.Id, "requester");
        await ApproveClaimAsync(org.Id, claim.Id, "owner");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            Assert.False(await db.PendingMatchTeamPlayers.AnyAsync(p =>
                p.LeaguePlayerId == requesterPlayer.Id));
            Assert.False(await db.PendingMatchAcceptances.AnyAsync(a =>
                a.LeaguePlayerId == requesterPlayer.Id));
            Assert.False(await db.LeaguePlayers.AnyAsync(lp =>
                lp.OrganizationMembershipId == requesterMembership.Id));
        }

        var liveOrg = await CreateOrganization("Live Pending", "live-pending");
        var liveLeague = await CreateLeague(liveOrg.Id, "Live League", "live-league", teamSize: 1);
        await SeedOrgMember(liveOrg.Id, "live-owner", "live-owner@test.com", OrganizationRole.Owner);
        var (_, _, livePlayer) = await SeedTestUser(
            liveOrg.Id, liveLeague.Id, "live-requester", "live-requester@test.com");
        var liveTarget = await SeedPlaceholder(liveOrg.Id, "Live Target");
        await SeedPendingMatchAsync(liveOrg.Id, liveLeague.Id, livePlayer.Id, AcceptanceStatus.Pending);

        AuthenticateAs("live-requester");
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{liveOrg.Id}/claim-requests",
            new CreateMembershipClaimRequest { OrganizationMembershipId = liveTarget.Id });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("match activity", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task MatchFlags_AreRepointedAndConcurrentCreationCannotUseTombstone()
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, _, ownerPlayer) = await SeedTestUser(
            org.Id, league.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var (_, _, opponent) = await SeedTestUser(
            org.Id, league.Id, "opponent", "opponent@test.com");
        var (_, requesterMembership, _) = await SeedTestUser(
            org.Id, league.Id, "requester", "requester@test.com");
        AuthenticateAs("owner");
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/matches",
            OneVsOne(ownerPlayer.Id, opponent.Id));
        var match = await ReadJsonAsync<MatchResponse>(matchResponse);
        Assert.NotNull(match);

        AuthenticateAs("requester");
        var flagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags",
            new CreateMatchFlagRequest { MatchId = match.Id, Reason = "Wrong score" });
        Assert.Equal(HttpStatusCode.Created, flagResponse.StatusCode);
        var flag = await ReadJsonAsync<MatchFlagResponse>(flagResponse);
        Assert.NotNull(flag);
        var target = await SeedPlaceholder(org.Id, "Target");
        await SeedLeaguePlayerAsync(org.Id, league.Id, target.Id);
        var claim = await CreateClaimAsync(org.Id, target.Id, "requester");
        await ApproveClaimAsync(org.Id, claim.Id, "owner");

        AuthenticateAs("requester");
        var mineResponse = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/me");
        var mine = await ReadJsonAsync<List<MatchFlagResponse>>(mineResponse);
        Assert.Equal(target.Id, Assert.Single(mine!).FlaggedByMembershipId);
        Assert.Equal(HttpStatusCode.OK, (await Client.PutAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}",
            new UpdateMatchFlagReasonRequest { Reason = "Updated reason" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Client.DeleteAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/match-flags/{flag.Id}")).StatusCode);

        var raceOrg = await CreateOrganization("Flag Race", "flag-race");
        var raceLeague = await CreateLeague(raceOrg.Id, "Flag League", "flag-league", teamSize: 1);
        await CreateSeason(raceOrg.Id, raceLeague.Id);
        var (_, raceMembership, _) = await SeedTestUser(
            raceOrg.Id, raceLeague.Id, "race-owner", "race-owner@test.com", OrganizationRole.Owner);
        var (_, _, first) = await SeedTestUser(
            raceOrg.Id, raceLeague.Id, "first", "first@test.com");
        var (_, _, second) = await SeedTestUser(
            raceOrg.Id, raceLeague.Id, "second", "second@test.com");
        AuthenticateAs("first");
        var raceMatchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{raceOrg.Id}/leagues/{raceLeague.Id}/matches",
            OneVsOne(first.Id, second.Id));
        var raceMatch = await ReadJsonAsync<MatchResponse>(raceMatchResponse);
        Assert.NotNull(raceMatch);
        var raceTarget = await SeedPlaceholder(raceOrg.Id, "Race Target");
        var raceClaim = await CreateClaimAsync(raceOrg.Id, raceTarget.Id, "race-owner");

        await using (var blocker = await LockRowAsync("organization_memberships", raceMembership.Id))
        {
            AuthenticateAs("race-owner");
            var approveTask = Client.PostAsync(
                $"api/v3/organizations/{raceOrg.Id}/claim-requests/{raceClaim.Id}/approve", null);
            await Task.Delay(250);
            var createFlagTask = Client.PostAsJsonAsync(
                $"api/v3/organizations/{raceOrg.Id}/leagues/{raceLeague.Id}/match-flags",
                new CreateMatchFlagRequest { MatchId = raceMatch.Id, Reason = "Race" });
            await Task.Delay(250);
            await blocker.ReleaseAsync();
            Assert.Equal(HttpStatusCode.OK, (await approveTask).StatusCode);
            Assert.Equal(HttpStatusCode.Conflict, (await createFlagTask).StatusCode);
        }

        using var verificationScope = Factory.Services.CreateScope();
        var verificationDb = verificationScope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.False(await verificationDb.V3MatchFlags.AnyAsync(f =>
            f.FlaggedByMembershipId == requesterMembership.Id
            || f.FlaggedByMembershipId == raceMembership.Id));
    }

    [Fact]
    public async Task Approve_EmailRecheckUsesPersistedRequesterVerification()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "moderator", "moderator@test.com", OrganizationRole.Moderator);
        await SeedOrgMember(org.Id, "requester", "requester@test.com");
        var addressed = await SeedPlaceholder(
            org.Id, "Addressed", "requester@test.com", MembershipStatus.Invited);
        var claim = await CreateClaimAsync(
            org.Id, addressed.Id, "requester", "requester@test.com", emailVerified: true);
        await ApproveClaimAsync(org.Id, claim.Id, "moderator");

        var unverifiedOrg = await CreateOrganization("Unverified", "unverified");
        await SeedOrgMember(unverifiedOrg.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        await SeedOrgMember(unverifiedOrg.Id, "unverified", "unverified@test.com");
        var changedTarget = await SeedPlaceholder(unverifiedOrg.Id, "Initially Name Only");
        var unverifiedClaim = await CreateClaimAsync(
            unverifiedOrg.Id, changedTarget.Id, "unverified", "unverified@test.com");
        AuthenticateAs("owner");
        await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{unverifiedOrg.Id}/members/{changedTarget.Id}/profile",
            new UpdateMemberProfileRequest { Email = "unverified@test.com" });
        var response = await Client.PostAsync(
            $"api/v3/organizations/{unverifiedOrg.Id}/claim-requests/{unverifiedClaim.Id}/approve", null);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        Assert.Equal("requester@test.com", (await db.MembershipClaimRequests
            .SingleAsync(c => c.Id == claim.Id)).RequesterVerifiedEmail);
        Assert.Null((await db.MembershipClaimRequests
            .SingleAsync(c => c.Id == unverifiedClaim.Id)).RequesterVerifiedEmail);
    }

    [Fact]
    public async Task ConcurrencyException_IsReturnedAsConflictProblemDetails()
    {
        var org = await CreateOrganization();
        await SeedOrgMember(org.Id, "owner", "owner@test.com", OrganizationRole.Owner);
        var (_, target) = await SeedOrgMember(org.Id, "target", "target@test.com");

        await using var firstFactory = new IntegrationTestFactory(PostgresFixture);
        await using var secondFactory = new IntegrationTestFactory(PostgresFixture);
        using var firstClient = firstFactory.CreateClient();
        using var secondClient = secondFactory.CreateClient();
        firstFactory.ClaimsProvider.SetUser("owner", "owner@test.com");
        secondFactory.ClaimsProvider.SetUser("owner", "owner@test.com");

        await using var blocker = await LockRowAsync("organization_memberships", target.Id);
        var firstTask = firstClient.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{target.Id}/profile",
            new UpdateMemberProfileRequest { DisplayName = "First" });
        var secondTask = secondClient.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/members/{target.Id}/profile",
            new UpdateMemberProfileRequest { DisplayName = "Second" });
        await Task.Delay(350);
        await blocker.ReleaseAsync();

        var responses = new[] { await firstTask, await secondTask };
        Assert.Contains(responses, r => r.StatusCode == HttpStatusCode.OK);
        var conflict = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Contains("retry", await conflict.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    private async Task<OrganizationMembership> SeedPlaceholder(
        Guid orgId,
        string? displayName,
        string? inviteEmail = null,
        MembershipStatus status = MembershipStatus.Active,
        OrganizationRole role = OrganizationRole.Member)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var membership = new OrganizationMembership
        {
            OrganizationId = orgId,
            DisplayName = displayName,
            InviteEmail = inviteEmail,
            Status = status,
            Role = role,
        };
        db.OrganizationMemberships.Add(membership);
        await db.SaveChangesAsync();
        return membership;
    }

    private async Task<MembershipClaimRequestResponse> CreateClaimAsync(
        Guid orgId,
        Guid targetId,
        string identityUserId,
        string? email = null,
        bool emailVerified = false)
    {
        AuthenticateAs(identityUserId, email: email, emailVerified: emailVerified);
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/claim-requests",
            new CreateMembershipClaimRequest { OrganizationMembershipId = targetId });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var claim = await ReadJsonAsync<MembershipClaimRequestResponse>(response);
        Assert.NotNull(claim);
        return claim;
    }

    private async Task<MembershipClaimRequestResponse> ApproveClaimAsync(
        Guid orgId, Guid claimId, string actorIdentityUserId)
    {
        AuthenticateAs(actorIdentityUserId);
        var response = await Client.PostAsync(
            $"api/v3/organizations/{orgId}/claim-requests/{claimId}/approve", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var claim = await ReadJsonAsync<MembershipClaimRequestResponse>(response);
        Assert.NotNull(claim);
        return claim;
    }

    private async Task<InviteLinkResponse> CreateInviteLinkForAsync(
        Guid orgId, string ownerIdentityUserId)
    {
        AuthenticateAs(ownerIdentityUserId);
        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/invite-links", new CreateInviteLinkRequest());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var invite = await ReadJsonAsync<InviteLinkResponse>(response);
        Assert.NotNull(invite);
        return invite;
    }

    private static SubmitMatchRequest OneVsOne(
        Guid firstPlayerId, Guid secondPlayerId) => new()
    {
        Teams =
        [
            new SubmitMatchTeamRequest { Players = [firstPlayerId], Score = 10 },
            new SubmitMatchTeamRequest { Players = [secondPlayerId], Score = 5 },
        ],
    };

    private static SubmitMatchRequest OneVsOne(
        Guid firstPlayerId, CreateMatchPlayerRequest secondPlayer) => new()
    {
        Teams =
        [
            new SubmitMatchTeamRequest { Players = [firstPlayerId], Score = 10 },
            new SubmitMatchTeamRequest
            {
                Players = [new SubmitMatchPlayerRequest { NewPlayer = secondPlayer }],
                Score = 5,
            },
        ],
    };

    private static SubmitMatchRequest OneVsOneMembership(
        Guid membershipId, Guid leaguePlayerId) => new()
    {
        Teams =
        [
            new SubmitMatchTeamRequest
            {
                Players = [new SubmitMatchPlayerRequest { OrganizationMembershipId = membershipId }],
                Score = 10,
            },
            new SubmitMatchTeamRequest { Players = [leaguePlayerId], Score = 5 },
        ],
    };

    private static SubmitMatchRequest OneVsOneMemberships(
        Guid firstMembershipId, Guid secondMembershipId) => new()
    {
        Teams =
        [
            new SubmitMatchTeamRequest
            {
                Players = [new SubmitMatchPlayerRequest { OrganizationMembershipId = firstMembershipId }],
                Score = 10,
            },
            new SubmitMatchTeamRequest
            {
                Players = [new SubmitMatchPlayerRequest { OrganizationMembershipId = secondMembershipId }],
                Score = 5,
            },
        ],
    };

    private async Task SeedPendingMatchAsync(
        Guid orgId, Guid leagueId, Guid leaguePlayerId, AcceptanceStatus status)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var pendingMatch = new V3PendingMatch
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            Status = status,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5),
        };
        var team = new PendingMatchTeam
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            PendingMatchId = pendingMatch.Id,
            Index = 0,
        };
        team.Players.Add(new PendingMatchTeamPlayer
        {
            PendingMatchTeamId = team.Id,
            LeaguePlayerId = leaguePlayerId,
            Index = 0,
        });
        pendingMatch.Teams.Add(team);
        pendingMatch.Acceptances.Add(new PendingMatchAcceptance
        {
            PendingMatchId = pendingMatch.Id,
            LeaguePlayerId = leaguePlayerId,
            Status = status,
        });
        db.V3PendingMatches.Add(pendingMatch);
        await db.SaveChangesAsync();
    }

    private async Task<LeaguePlayer> SeedLeaguePlayerAsync(
        Guid orgId, Guid leagueId, Guid membershipId)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var player = new LeaguePlayer
        {
            OrganizationId = orgId,
            LeagueId = leagueId,
            OrganizationMembershipId = membershipId,
            Mmr = 1500,
            Mu = 25m,
            Sigma = 8.333m,
        };
        db.LeaguePlayers.Add(player);
        await db.SaveChangesAsync();
        return player;
    }

    private async Task<MatchClaimRace> SeedMatchClaimRaceAsync(string prefix)
    {
        var org = await CreateOrganization($"Match Race {prefix}", $"match-race-{prefix}");
        var league = await CreateLeague(
            org.Id, $"Match Race League {prefix}", $"match-race-league-{prefix}", teamSize: 1);
        await CreateSeason(org.Id, league.Id);
        var (_, requesterMembership, requesterPlayer) = await SeedTestUser(
            org.Id, league.Id, $"{prefix}-requester", $"{prefix}-requester@test.com");
        var (_, _, ownerPlayer) = await SeedTestUser(
            org.Id, league.Id, $"{prefix}-owner", $"{prefix}-owner@test.com", OrganizationRole.Owner);
        var target = await SeedPlaceholder(org.Id, $"Target {prefix}");
        var claim = await CreateClaimAsync(
            org.Id, target.Id, $"{prefix}-requester");

        return new MatchClaimRace(
            org.Id,
            league.Id,
            requesterMembership.Id,
            requesterPlayer.Id,
            ownerPlayer.Id,
            claim.Id);
    }

    private async Task<DatabaseRowLock> LockRowAsync(string table, Guid id)
    {
        Assert.Contains(table, new[] { "organization_memberships", "membership_claim_requests" });
        var connection = new NpgsqlConnection(PostgresFixture.GetConnectionString());
        await connection.OpenAsync();
        var transaction = await connection.BeginTransactionAsync();
        await using var command = new NpgsqlCommand(
            $"SELECT id FROM {table} WHERE id = @id FOR UPDATE", connection, transaction);
        command.Parameters.AddWithValue("id", id);
        Assert.NotNull(await command.ExecuteScalarAsync());
        return new DatabaseRowLock(connection, transaction);
    }

    private async Task WaitForBlockedMembershipLockAsync()
    {
        await using var connection = new NpgsqlConnection(PostgresFixture.GetConnectionString());
        await connection.OpenAsync();
        var deadline = DateTimeOffset.UtcNow.AddSeconds(10);

        while (DateTimeOffset.UtcNow < deadline)
        {
            await using var command = new NpgsqlCommand("""
                SELECT EXISTS (
                    SELECT 1
                    FROM pg_stat_activity AS activity
                    WHERE activity.datname = current_database()
                      AND activity.wait_event_type = 'Lock'
                      AND cardinality(pg_blocking_pids(activity.pid)) > 0
                      AND activity.query ILIKE '%organization_memberships%'
                      AND activity.query ILIKE '%FOR UPDATE%'
                )
                """, connection);
            if (await command.ExecuteScalarAsync() is true)
                return;

            await Task.Delay(25);
        }

        throw new TimeoutException("No request was observed waiting on an organization membership lock.");
    }

    private sealed class DatabaseRowLock(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction) : IAsyncDisposable
    {
        private bool _released;

        public async Task ReleaseAsync()
        {
            if (_released)
                return;
            await transaction.CommitAsync();
            _released = true;
        }

        public async ValueTask DisposeAsync()
        {
            if (!_released)
                await transaction.RollbackAsync();
            await transaction.DisposeAsync();
            await connection.DisposeAsync();
        }
    }

    private enum CommandGateTiming
    {
        Before,
        After,
    }

    private sealed class DbCommandGate(
        string commandFragment,
        CommandGateTiming timing) : DbCommandInterceptor
    {
        private readonly TaskCompletionSource _reached =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource _release =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _entered;

        public Task WaitUntilReachedAsync() =>
            _reached.Task.WaitAsync(TimeSpan.FromSeconds(10));

        public void Release() => _release.TrySetResult();

        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            await PauseAsync(command, CommandGateTiming.Before, cancellationToken);
            return result;
        }

        public override async ValueTask<int> NonQueryExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            int result,
            CancellationToken cancellationToken = default)
        {
            await PauseAsync(command, CommandGateTiming.After, cancellationToken);
            return result;
        }

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            await PauseAsync(command, CommandGateTiming.Before, cancellationToken);
            return result;
        }

        public override async ValueTask<DbDataReader> ReaderExecutedAsync(
            DbCommand command,
            CommandExecutedEventData eventData,
            DbDataReader result,
            CancellationToken cancellationToken = default)
        {
            await PauseAsync(command, CommandGateTiming.After, cancellationToken);
            return result;
        }

        private async Task PauseAsync(
            DbCommand command,
            CommandGateTiming currentTiming,
            CancellationToken cancellationToken)
        {
            if (timing != currentTiming
                || !command.CommandText.Contains(commandFragment, StringComparison.OrdinalIgnoreCase)
                || Interlocked.Exchange(ref _entered, 1) != 0)
            {
                return;
            }

            _reached.TrySetResult();
            await _release.Task.WaitAsync(cancellationToken);
        }
    }

    private sealed record MatchClaimRace(
        Guid OrgId,
        Guid LeagueId,
        Guid RequesterMembershipId,
        Guid RequesterPlayerId,
        Guid OwnerPlayerId,
        Guid ClaimId);

    private static HttpRequestMessage JsonRequest<T>(HttpMethod method, string uri, T body)
    {
        return new HttpRequestMessage(method, uri) { Content = JsonContent.Create(body) };
    }
}
