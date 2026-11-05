using System.Net;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.GameInvites;

[Collection("Database")]
public class GameInviteRosterTests(PostgresFixture postgres) : GameInviteTestBase(postgres)
{
    [Fact]
    public async Task AddPlayers_IsAtomic_AndRetryAfterSuccessChangesNothing()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        var creator = await SeedPlayerAsync(ctx, "p1");
        var a = await SeedUnaccountedPlayerAsync(ctx, "a");
        var b = await SeedUnaccountedPlayerAsync(ctx, "b");
        var c = await SeedPlayerAsync(ctx, "c");
        var d = await SeedPlayerAsync(ctx, "d");
        var invite = await CreateInviteAsync(ctx, "p1");

        var added = await AddPlayersAsync(ctx, "p1", invite.Id, a.Id, b.Id);
        Assert.Equal(3, added.Participants.Count);
        Assert.All(added.Participants.Where(p => !p.IsCreator),
            p => Assert.Equal(creator.Id, p.RepresentativeLeaguePlayerId));

        // Only one spot left: adding two players must fail without adding either.
        var overflow = await AddPlayersRawAsync(ctx, "p1", invite.Id, c.Id, d.Id);
        Assert.Equal(HttpStatusCode.Conflict, overflow.StatusCode);
        var afterOverflow = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(3, afterOverflow.Participants.Count);
        Assert.DoesNotContain(afterOverflow.Participants, p => p.LeaguePlayerId == c.Id);

        // Retrying the add that already succeeded is harmless.
        var retry = await AddPlayersRawAsync(ctx, "p1", invite.Id, a.Id, b.Id);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        var afterRetry = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(3, afterRetry.Participants.Count);

        var filled = await AddPlayersAsync(ctx, "p1", invite.Id, c.Id);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, filled.Status);
        Assert.Equal(4, filled.Participants.Count);
    }

    [Fact]
    public async Task AddPlayers_RejectsPlayersCommittedElsewhere_AndNonParticipants()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 3);
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var queued = await SeedPlayerAsync(ctx, "queued");
        var busy = await SeedPlayerAsync(ctx, "busy");
        var bystander = await SeedPlayerAsync(ctx, "bystander");
        var target = await SeedUnaccountedPlayerAsync(ctx, "target");

        var invite = await CreateInviteAsync(ctx, "p1");
        var otherInvite = await CreateInviteAsync(ctx, "p2");

        // One player sits in another invite and one in the queue.
        await JoinByLinkAsync("busy", otherInvite.ShareCode);
        await JoinQueueRawAsync(ctx, "queued");

        var inOtherInvite = await AddPlayersRawAsync(ctx, "p1", invite.Id, busy.Id);
        Assert.Equal(HttpStatusCode.Conflict, inOtherInvite.StatusCode);

        var inQueue = await AddPlayersRawAsync(ctx, "p1", invite.Id, queued.Id);
        Assert.Equal(HttpStatusCode.Conflict, inQueue.StatusCode);

        // A league player who is not in the invite cannot add anyone to it.
        var nonParticipant = await AddPlayersRawAsync(ctx, "bystander", invite.Id, target.Id);
        Assert.Equal(HttpStatusCode.Forbidden, nonParticipant.StatusCode);

        // Rejected adds leave the roster exactly as it was.
        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Single(state.Participants);
        Assert.DoesNotContain(state.Participants, p => p.LeaguePlayerId == target.Id);
    }

    [Fact]
    public async Task Removal_CreatorRemovesAnyone_ParticipantRemovesOnlyPlayersTheyAdded()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 3);
        var creator = await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var p3 = await SeedPlayerAsync(ctx, "p3");
        var managed = await SeedUnaccountedPlayerAsync(ctx, "managed");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await JoinByLinkAsync("p3", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, managed.Id);

        // p3 neither added the managed player nor is the creator.
        var unrelatedRemoval = await RemovePlayerRawAsync(ctx, "p3", invite.Id, managed.Id);
        Assert.Equal(HttpStatusCode.Forbidden, unrelatedRemoval.StatusCode);

        // The representative may remove the player they added.
        var representativeRemoval = await RemovePlayerRawAsync(ctx, "p2", invite.Id, managed.Id);
        Assert.Equal(HttpStatusCode.OK, representativeRemoval.StatusCode);

        // The creator may remove anyone except themselves.
        var creatorRemoval = await RemovePlayerRawAsync(ctx, "p1", invite.Id, p3.Id);
        Assert.Equal(HttpStatusCode.OK, creatorRemoval.StatusCode);

        var creatorSelf = await RemovePlayerRawAsync(ctx, "p1", invite.Id, creator.Id);
        Assert.Equal(HttpStatusCode.BadRequest, creatorSelf.StatusCode);

        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(2, state.Participants.Count);
        Assert.DoesNotContain(state.Participants, p => p.LeaguePlayerId == managed.Id);
        Assert.DoesNotContain(state.Participants, p => p.LeaguePlayerId == p3.Id);
    }

    [Fact]
    public async Task Leave_Alone_TransfersRemainingManagedPlayersToCreator()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 3);
        var creator = await SeedPlayerAsync(ctx, "p1");
        var p2 = await SeedPlayerAsync(ctx, "p2");
        var a = await SeedUnaccountedPlayerAsync(ctx, "a");
        var b = await SeedUnaccountedPlayerAsync(ctx, "b");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id, b.Id);

        var leave = await LeaveRawAsync(ctx, "p2", invite.Id, removeManagedPlayers: false);

        Assert.Equal(HttpStatusCode.OK, leave.StatusCode);
        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.DoesNotContain(state.Participants, p => p.LeaguePlayerId == p2.Id);
        Assert.Equal(new[] { a.Id, b.Id }.OrderBy(x => x),
            state.Participants.Where(p => !p.IsCreator).Select(p => p.LeaguePlayerId).OrderBy(x => x));
        Assert.All(state.Participants.Where(p => !p.IsCreator),
            p => Assert.Equal(creator.Id, p.RepresentativeLeaguePlayerId));

        var current = await GetCurrentInviteAsync(ctx, "p2");
        Assert.Null(current.Invite);
    }

    [Fact]
    public async Task Leave_WithManagedPlayers_RemovesThem()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 3);
        await SeedPlayerAsync(ctx, "p1");
        var p2 = await SeedPlayerAsync(ctx, "p2");
        var a = await SeedUnaccountedPlayerAsync(ctx, "a");
        var b = await SeedUnaccountedPlayerAsync(ctx, "b");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id, b.Id);

        var leave = await LeaveRawAsync(ctx, "p2", invite.Id, removeManagedPlayers: true);

        Assert.Equal(HttpStatusCode.OK, leave.StatusCode);
        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Single(state.Participants);
        Assert.Equal(invite.CreatedByLeaguePlayerId, state.Participants[0].LeaguePlayerId);
        Assert.DoesNotContain(state.Participants, p => p.LeaguePlayerId == p2.Id);
    }

    [Fact]
    public async Task Leave_WithManagedPlayers_KeepsPlayersWhoTookControlOfTheirSpot()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 3);
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var a = await SeedPlayerAsync(ctx, "a");
        var b = await SeedUnaccountedPlayerAsync(ctx, "b");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id, b.Id);

        // "a" takes control of their own spot, so it is no longer tied to p2.
        var takeControl = await TakeControlRawAsync(ctx, "a", invite.Id);
        Assert.Equal(HttpStatusCode.OK, takeControl.StatusCode);

        var leave = await LeaveRawAsync(ctx, "p2", invite.Id, removeManagedPlayers: true);
        Assert.Equal(HttpStatusCode.OK, leave.StatusCode);

        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(new[] { invite.CreatedByLeaguePlayerId, a.Id }.OrderBy(x => x),
            state.Participants.Select(p => p.LeaguePlayerId).OrderBy(x => x));
        Assert.Equal(a.Id, state.Participants.Single(p => p.LeaguePlayerId == a.Id).RepresentativeLeaguePlayerId);
        Assert.DoesNotContain(state.Participants, p => p.LeaguePlayerId == b.Id);
    }

    [Fact]
    public async Task CreatorLeave_CancelsInvite_AndReleasesEveryone()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);

        var leave = await LeaveRawAsync(ctx, "p1", invite.Id);
        Assert.Equal(HttpStatusCode.OK, leave.StatusCode);

        var ended = await GetInviteAsync(ctx, "p2", invite.Id);
        Assert.Equal(GameInviteStatus.Ended, ended.Status);
        Assert.Equal(GameInviteEndReason.CreatorLeft, ended.EndReason);
        Assert.Empty(ended.Participants);

        Assert.Null((await GetCurrentInviteAsync(ctx, "p2")).Invite);
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(ctx, "p2")).StatusCode);
    }

    [Fact]
    public async Task Cancel_IsCreatorOnly_AndReleasesCommitments()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);

        var notCreator = await CancelRawAsync(ctx, "p2", invite.Id);
        Assert.Equal(HttpStatusCode.Forbidden, notCreator.StatusCode);

        var cancel = await CancelRawAsync(ctx, "p1", invite.Id);
        Assert.Equal(HttpStatusCode.OK, cancel.StatusCode);

        var ended = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(GameInviteEndReason.CreatorCancelled, ended.EndReason);
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(ctx, "p2")).StatusCode);
    }

    [Fact]
    public async Task TakeControl_RevokesRepresentative_BeforeAcceptance()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 3);
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var a = await SeedPlayerAsync(ctx, "a");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id);

        var takeControl = await TakeControlRawAsync(ctx, "a", invite.Id);
        Assert.Equal(HttpStatusCode.OK, takeControl.StatusCode);

        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(a.Id, state.Participants.Single(p => p.LeaguePlayerId == a.Id).RepresentativeLeaguePlayerId);

        // The former representative loses the right to remove that player.
        var oldRepRemoval = await RemovePlayerRawAsync(ctx, "p2", invite.Id, a.Id);
        Assert.Equal(HttpStatusCode.Forbidden, oldRepRemoval.StatusCode);
    }

    [Fact]
    public async Task TakeControl_DuringAcceptance_PreservesResponse_AndRevokesOldRepresentative()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        await SeedPlayerAsync(ctx, "p3");
        var a = await SeedPlayerAsync(ctx, "a");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id);
        var full = await JoinByLinkAsync("p3", invite.ShareCode);
        var roundId = full.RoundId!.Value;

        // The representative answers for a while, then a takes control of their own spot.
        var repAccepts = await RespondAsync(ctx, "p2", invite.Id, roundId, a.Id);
        Assert.Equal(AcceptanceStatus.Accepted, repAccepts.Participants.Single(p => p.LeaguePlayerId == a.Id).AcceptanceStatus);

        var takeControl = await TakeControlRawAsync(ctx, "a", invite.Id);
        Assert.Equal(HttpStatusCode.OK, takeControl.StatusCode);

        var afterTakeover = await GetInviteAsync(ctx, "p1", invite.Id);
        var aSpot = afterTakeover.Participants.Single(p => p.LeaguePlayerId == a.Id);
        Assert.Equal(a.Id, aSpot.RepresentativeLeaguePlayerId);
        Assert.Equal(AcceptanceStatus.Accepted, aSpot.AcceptanceStatus);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, afterTakeover.Status);

        // A later response from the old representative is refused.
        var stale = await RespondRawAsync(ctx, "p2", invite.Id, roundId, a.Id, accept: false);
        Assert.Equal(HttpStatusCode.Forbidden, stale.StatusCode);
    }

    [Fact]
    public async Task Respond_ForPlayerYouDoNotManage_IsForbidden()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        await SeedPlayerAsync(ctx, "p3");
        var a = await SeedUnaccountedPlayerAsync(ctx, "a");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id);
        var full = await JoinByLinkAsync("p3", invite.ShareCode);

        var response = await RespondRawAsync(ctx, "p3", invite.Id, full.RoundId!.Value, a.Id, accept: true);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
