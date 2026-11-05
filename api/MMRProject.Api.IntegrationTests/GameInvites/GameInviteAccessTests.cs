using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.GameInvites;

[Collection("Database")]
public class GameInviteAccessTests(PostgresFixture postgres) : GameInviteTestBase(postgres)
{
    [Fact]
    public async Task CreateInvite_CreatorOccupiesSpot_AndShareLinkResolvesForMembers()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        await SeedPlayerAsync(ctx, "p1");

        var invite = await CreateInviteAsync(ctx, "p1");

        Assert.Equal(GameInviteStatus.Waiting, invite.Status);
        Assert.Equal(4, invite.Capacity);
        Assert.Equal(12, invite.ShareCode.Length);
        Assert.Single(invite.Participants);
        Assert.True(invite.Participants[0].IsCreator);
        Assert.Equal(AcceptanceStatus.Pending, invite.Participants[0].AcceptanceStatus);
        Assert.Empty(invite.Teams);
        Assert.InRange(invite.ExpiresAt, invite.CreatedAt.AddMinutes(29), invite.CreatedAt.AddMinutes(31));

        var link = await GetByLinkAsync("p1", invite.ShareCode);
        Assert.Equal(GameInviteEligibility.Eligible, link.Eligibility);
        Assert.Equal(invite.Id, link.Invite!.Id);
    }

    [Fact]
    public async Task ShareLink_HidesRoster_FromOrgMemberWithoutLeaguePlayer()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedOrgMember(ctx.OrganizationId, identityUserId: "outsider", email: "outsider@test.com");
        var invite = await CreateInviteAsync(ctx, "p1");

        var link = await GetByLinkAsync("outsider", invite.ShareCode);

        Assert.Equal(GameInviteEligibility.NotLeagueMember, link.Eligibility);
        Assert.Null(link.Invite);
    }

    [Fact]
    public async Task ShareLink_HidesRoster_FromOrgOwnerWithoutLeaguePlayer_AndDeniesInviteById()
    {
        // Organization role bypasses the league access policy, but roster visibility is a league-membership rule.
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedOrgMember(ctx.OrganizationId, identityUserId: "owner", email: "owner@test.com",
            role: OrganizationRole.Owner);
        var invite = await CreateInviteAsync(ctx, "p1");

        var link = await GetByLinkAsync("owner", invite.ShareCode);
        Assert.Equal(GameInviteEligibility.NotLeagueMember, link.Eligibility);
        Assert.Null(link.Invite);

        AuthenticateAs("owner");
        var byId = await Client.GetAsync($"{ctx.InvitesUrl}/{invite.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, byId.StatusCode);
    }

    [Fact]
    public async Task ShareLink_ReportsNotOrganizationMember_AndJoinIsForbidden()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        var invite = await CreateInviteAsync(ctx, "p1");

        // Signed in, but no membership in the organization at all.
        await SeedUser(identityUserId: "stranger", email: "stranger@test.com");

        var link = await GetByLinkAsync("stranger", invite.ShareCode);
        Assert.Equal(GameInviteEligibility.NotOrganizationMember, link.Eligibility);
        Assert.Null(link.Invite);

        var join = await JoinByLinkRawAsync("stranger", invite.ShareCode);
        Assert.Equal(HttpStatusCode.Forbidden, join.StatusCode);
    }

    [Fact]
    public async Task Join_ByOrgMemberWithoutLeaguePlayer_IsForbidden_AndRosterUnchanged()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedOrgMember(ctx.OrganizationId, identityUserId: "member", email: "member@test.com");
        var invite = await CreateInviteAsync(ctx, "p1");

        var join = await JoinByLinkRawAsync("member", invite.ShareCode);

        Assert.Equal(HttpStatusCode.Forbidden, join.StatusCode);
        var current = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Single(current.Participants);
    }

    [Fact]
    public async Task Join_IsIdempotent_AndFillingRosterStartsAcceptanceWithTeams()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        var creator = await SeedPlayerAsync(ctx, "p1");
        var p2 = await SeedPlayerAsync(ctx, "p2");
        var p3 = await SeedPlayerAsync(ctx, "p3");
        var p4 = await SeedPlayerAsync(ctx, "p4");
        var invite = await CreateInviteAsync(ctx, "p1");

        var afterFirst = await JoinByLinkAsync("p2", invite.ShareCode);
        Assert.Equal(2, afterFirst.Participants.Count);

        // A retried join (lost response) must not add a second spot.
        var retried = await JoinByLinkAsync("p2", invite.ShareCode);
        Assert.Equal(2, retried.Participants.Count);
        Assert.Equal(GameInviteStatus.Waiting, retried.Status);

        await JoinByLinkAsync("p3", invite.ShareCode);
        var full = await JoinByLinkAsync("p4", invite.ShareCode);

        Assert.Equal(GameInviteStatus.AwaitingAcceptance, full.Status);
        Assert.NotNull(full.RoundId);
        Assert.All(full.Participants, p => Assert.Equal(AcceptanceStatus.Pending, p.AcceptanceStatus));

        var now = DateTimeOffset.UtcNow;
        Assert.InRange(full.AcceptanceExpiresAt!.Value, now.AddSeconds(25), now.AddSeconds(35));

        Assert.Equal(2, full.Teams.Count);
        Assert.All(full.Teams, t => Assert.Equal(2, t.Players.Count));
        var teamPlayerIds = full.Teams.SelectMany(t => t.Players.Select(p => p.LeaguePlayerId)).OrderBy(x => x).ToList();
        var expectedIds = new[] { creator.Id, p2.Id, p3.Id, p4.Id }.OrderBy(x => x).ToList();
        Assert.Equal(expectedIds, teamPlayerIds);
    }

    [Fact]
    public async Task Commitment_QueuedPlayer_CannotCreateOrJoinInvite_UntilTheyLeaveQueue()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");

        AuthenticateAs("p1");
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(ctx, "p1")).StatusCode);

        var createWhileQueued = await CreateInviteRawAsync(ctx, "p1");
        Assert.Equal(HttpStatusCode.Conflict, createWhileQueued.StatusCode);

        var invite = await CreateInviteAsync(ctx, "p2");
        var joinWhileQueued = await JoinByLinkRawAsync("p1", invite.ShareCode);
        Assert.Equal(HttpStatusCode.Conflict, joinWhileQueued.StatusCode);

        AuthenticateAs("p1");
        var leave = await Client.DeleteAsync(ctx.QueueUrl);
        Assert.Equal(HttpStatusCode.NoContent, leave.StatusCode);

        var joinAfterLeaving = await JoinByLinkAsync("p1", invite.ShareCode);
        Assert.Equal(2, joinAfterLeaving.Participants.Count);
    }

    [Fact]
    public async Task Commitment_InviteParticipant_CannotJoinQueue_OrAnotherInvite()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        await SeedPlayerAsync(ctx, "p3");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);

        AuthenticateAs("p2");
        var queue = await JoinQueueRawAsync(ctx, "p2");
        Assert.Equal(HttpStatusCode.BadRequest, queue.StatusCode);

        var secondInvite = await CreateInviteRawAsync(ctx, "p2");
        Assert.Equal(HttpStatusCode.Conflict, secondInvite.StatusCode);

        var currentInvite = await GetCurrentInviteAsync(ctx, "p2");
        Assert.Equal(invite.Id, currentInvite.Invite!.Id);
    }

    [Fact]
    public async Task CurrentInvite_IsNullForPlayersWithoutAnInvite()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");

        var current = await GetCurrentInviteAsync(ctx, "p1");

        Assert.Null(current.Invite);
    }

    [Fact]
    public async Task Join_ThroughLinkWithUnknownCode_ReturnsNotFound()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");

        var response = await JoinByLinkRawAsync("p1", "NOTACODE1234");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
