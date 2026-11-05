using System.Net;
using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.GameInvites;

[Collection("Database")]
public class GameInviteLifecycleTests(PostgresFixture postgres) : GameInviteTestBase(postgres)
{
    [Fact]
    public async Task FinalAcceptance_AfterLeagueFormatChange_DoesNotCreateInvalidMatch()
    {
        var r = await StandardAcceptanceRosterAsync();
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.P2);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A);
        await QueryAsync(db => db.Leagues.Where(l => l.Id == r.Ctx.LeagueId)
            .ExecuteUpdateAsync(s => s.SetProperty(l => l.TeamSize, 1)));

        var response = await RespondRawAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3, accept: true);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(await GetActiveMatchesAsync(r.Ctx, "p1"));
        Assert.Equal(HttpStatusCode.OK, (await CancelRawAsync(r.Ctx, "p1", r.Invite.Id)).StatusCode);
        Assert.Null((await GetCurrentInviteAsync(r.Ctx, "p1")).Invite);
    }

    [Fact]
    public async Task FinalAcceptance_AfterRepresentedPlayerMembershipRemoval_DoesNotCreateInvalidMatch()
    {
        var r = await StandardAcceptanceRosterAsync();
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.P2);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A);
        var membershipId = await QueryAsync(db => db.LeaguePlayers.Where(p => p.Id == r.A)
            .Select(p => p.OrganizationMembershipId).SingleAsync());
        await QueryAsync(db => db.OrganizationMemberships.Where(m => m.Id == membershipId)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.Status, MembershipStatus.Removed)));

        var response = await RespondRawAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3, accept: true);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(await GetActiveMatchesAsync(r.Ctx, "p1"));
        Assert.Equal(HttpStatusCode.OK, (await CancelRawAsync(r.Ctx, "p1", r.Invite.Id)).StatusCode);
    }

    [Fact]
    public async Task AllAccepted_StartsActiveMatch_AndReleasesTheRoster()
    {
        var r = await StandardAcceptanceRosterAsync();

        var started = await AcceptEveryoneAsync(r);

        Assert.Equal(GameInviteStatus.Started, started.Status);
        Assert.NotNull(started.PendingMatchId);
        Assert.Empty(started.Participants);

        var active = await GetActiveMatchesAsync(r.Ctx, "p1");
        var match = Assert.Single(active);
        Assert.Equal(2, match.Teams.Count);
        Assert.All(match.Teams, t => Assert.Equal(2, t.Players.Count));
        Assert.Equal(
            new[] { r.P1, r.P2, r.A, r.P3 }.OrderBy(x => x),
            match.Teams.SelectMany(t => t.Players).Select(p => p.LeaguePlayerId).OrderBy(x => x));

        // The invite is no longer a live commitment, and the queue view reports the active match instead.
        Assert.Null((await GetCurrentInviteAsync(r.Ctx, "p1")).Invite);
        var queue = await GetQueueStatusAsync(r.Ctx, "p3");
        Assert.NotNull(queue.ActiveMatch);

        // The invite cannot start another game.
        var afterStart = await RespondRawAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3, accept: true);
        Assert.Equal(HttpStatusCode.Conflict, afterStart.StatusCode);
    }

    [Fact]
    public async Task InviteMatch_ResultSubmittedThroughExistingFlow_RatesPlayers_AndReleasesThem()
    {
        var r = await StandardAcceptanceRosterAsync();
        await AcceptEveryoneAsync(r);
        var activeMatchId = (await GetActiveMatchesAsync(r.Ctx, "p1")).Single().Id;

        AuthenticateAs("p1");
        var submit = await Client.PostAsJsonAsync(
            $"{r.Ctx.ActiveMatchesUrl}/{activeMatchId}/submit",
            new SubmitActiveMatchResultRequest
            {
                Teams =
                [
                    new ActiveMatchTeamScoreRequest { TeamIndex = 0, Score = 10 },
                    new ActiveMatchTeamScoreRequest { TeamIndex = 1, Score = 5 },
                ],
            });

        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
        var match = await ReadJsonAsync<MatchResponse>(submit);
        Assert.Equal(MatchSource.Matchmaking, match!.Source);

        // Ratings went through the shared rating path for every player in the match.
        var mus = await QueryAsync(db => db.LeaguePlayers
            .Where(lp => lp.LeagueId == r.Ctx.LeagueId)
            .Select(lp => lp.Mu)
            .ToListAsync());
        Assert.Equal(4, mus.Count);
        Assert.All(mus, mu => Assert.NotEqual(25m, mu));

        // The active match is gone, the invite keeps its history without the removed match, and everyone is free again.
        Assert.Empty(await GetActiveMatchesAsync(r.Ctx, "p1"));
        var invite = await QueryAsync(db => db.GameInvites.AsNoTracking().SingleAsync(i => i.Id == r.Invite.Id));
        Assert.Equal(GameInviteStatus.Started, invite.Status);
        Assert.Null(invite.PendingMatchId);
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(r.Ctx, "p1")).StatusCode);
    }

    [Fact]
    public async Task InviteMatch_CancelledActiveMatch_ReleasesPlayers()
    {
        var r = await StandardAcceptanceRosterAsync();
        await AcceptEveryoneAsync(r);
        var activeMatchId = (await GetActiveMatchesAsync(r.Ctx, "p3")).Single().Id;

        AuthenticateAs("p3");
        var cancel = await Client.DeleteAsync($"{r.Ctx.ActiveMatchesUrl}/{activeMatchId}");

        Assert.True(cancel.IsSuccessStatusCode, await cancel.Content.ReadAsStringAsync());
        Assert.Empty(await GetActiveMatchesAsync(r.Ctx, "p3"));
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(r.Ctx, "p3")).StatusCode);
    }

    [Fact]
    public async Task Decline_ByRepresentative_ReopensWithAcceptedPlayers_KeepingLinkAndExpiry()
    {
        var r = await StandardAcceptanceRosterAsync();
        var p4 = await SeedPlayerAsync(r.Ctx, "p4");
        var p5 = await SeedPlayerAsync(r.Ctx, "p5");
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await RespondAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3);

        // p2 declines for their managed player "a"; p2 has not answered for themselves, so both leave.
        var reopened = await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A, accept: false);

        Assert.Equal(GameInviteStatus.Waiting, reopened.Status);
        Assert.Null(reopened.RoundId);
        Assert.Equal(r.Invite.ShareCode, reopened.ShareCode);
        Assert.Equal(r.Invite.ExpiresAt, reopened.ExpiresAt);
        Assert.Equal(new[] { r.P1, r.P3 }.OrderBy(x => x), reopened.Participants.Select(p => p.LeaguePlayerId).OrderBy(x => x));
        Assert.All(reopened.Participants, p => Assert.Equal(AcceptanceStatus.Pending, p.AcceptanceStatus));
        Assert.Empty(reopened.Teams);

        // Replacements trigger a fresh shuffle and a new acceptance round.
        await JoinByLinkAsync("p4", r.Invite.ShareCode);
        var refilled = await JoinByLinkAsync("p5", r.Invite.ShareCode);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, refilled.Status);
        Assert.NotNull(refilled.RoundId);
        Assert.NotEqual(r.RoundId, refilled.RoundId);
        Assert.Contains(refilled.Participants, p => p.LeaguePlayerId == p4.Id);
        Assert.Contains(refilled.Participants, p => p.LeaguePlayerId == p5.Id);
    }

    [Fact]
    public async Task Decline_ByRepresentative_TransfersAcceptedManagedPlayerToCreator()
    {
        var r = await StandardAcceptanceRosterAsync();
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A);

        // p2 declines for themselves after their managed player already accepted.
        var reopened = await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.P2, accept: false);

        Assert.Equal(GameInviteStatus.Waiting, reopened.Status);
        Assert.DoesNotContain(reopened.Participants, p => p.LeaguePlayerId == r.P2);
        var managed = reopened.Participants.Single(p => p.LeaguePlayerId == r.A);
        Assert.Equal(r.P1, managed.RepresentativeLeaguePlayerId);
        Assert.Equal(AcceptanceStatus.Pending, managed.AcceptanceStatus);
    }

    [Fact]
    public async Task Timeout_RepresentativeTimesOut_TransfersAcceptedManagedPlayerToCreator()
    {
        var r = await StandardAcceptanceRosterAsync();
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        // p2 answers for the managed player but never answers for themselves.
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A);
        await RespondAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3);
        await SetInviteTimersAsync(r.Invite.Id, acceptanceExpiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        await ReconcileGameInvitesAsync();

        var reopened = await GetInviteAsync(r.Ctx, "p1", r.Invite.Id);
        Assert.Equal(GameInviteStatus.Waiting, reopened.Status);
        Assert.DoesNotContain(reopened.Participants, p => p.LeaguePlayerId == r.P2);
        var managed = reopened.Participants.Single(p => p.LeaguePlayerId == r.A);
        Assert.Equal(r.P1, managed.RepresentativeLeaguePlayerId);
        Assert.Equal(AcceptanceStatus.Pending, managed.AcceptanceStatus);
    }

    [Fact]
    public async Task Decline_ByCreator_CancelsInvite_AndReleasesPlayers()
    {
        var r = await StandardAcceptanceRosterAsync();

        var declined = await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1, accept: false);

        Assert.Equal(GameInviteStatus.Ended, declined.Status);
        Assert.Equal(GameInviteEndReason.CreatorDeclined, declined.EndReason);
        Assert.Empty(declined.Participants);
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(r.Ctx, "p3")).StatusCode);
    }

    [Fact]
    public async Task Timeout_CreatorStillPending_CancelsInvite()
    {
        var r = await StandardAcceptanceRosterAsync();
        await SetInviteTimersAsync(r.Invite.Id, acceptanceExpiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        await ReconcileGameInvitesAsync();

        var ended = await GetInviteAsync(r.Ctx, "p1", r.Invite.Id);
        Assert.Equal(GameInviteStatus.Ended, ended.Status);
        Assert.Equal(GameInviteEndReason.CreatorTimedOut, ended.EndReason);
    }

    [Fact]
    public async Task Timeout_NonCreator_ReopensWithAcceptedPlayers()
    {
        var r = await StandardAcceptanceRosterAsync();
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await RespondAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3);
        await SetInviteTimersAsync(r.Invite.Id, acceptanceExpiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        var processed = await ReconcileGameInvitesAsync();

        Assert.True(processed >= 1);
        var reopened = await GetInviteAsync(r.Ctx, "p1", r.Invite.Id);
        Assert.Equal(GameInviteStatus.Waiting, reopened.Status);
        Assert.Equal(new[] { r.P1, r.P3 }.OrderBy(x => x), reopened.Participants.Select(p => p.LeaguePlayerId).OrderBy(x => x));
    }

    [Fact]
    public async Task AcceptAfterDeadline_IsRejected_AndInviteReopensEvenThoughRequestFailed()
    {
        var r = await StandardAcceptanceRosterAsync();
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await SetInviteTimersAsync(r.Invite.Id, acceptanceExpiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        // No background run: the request itself must enforce the deadline.
        var late = await RespondRawAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3, accept: true);
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);

        // The timeout itself was committed even though the late response was refused. Checked on the stored row,
        // before any read has a chance to settle it.
        var row = await QueryAsync(db => db.GameInvites.AsNoTracking().SingleAsync(i => i.Id == r.Invite.Id));
        Assert.Equal(GameInviteStatus.Waiting, row.Status);

        var state = await GetInviteAsync(r.Ctx, "p1", r.Invite.Id);
        Assert.Equal(GameInviteStatus.Waiting, state.Status);
        Assert.Equal(new[] { r.P1 }, state.Participants.Select(p => p.LeaguePlayerId));
    }

    [Fact]
    public async Task WaitingExpiry_EndsOnRead_AndRejectsLaterJoins()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var invite = await CreateInviteAsync(ctx, "p1");
        await SetInviteTimersAsync(invite.Id, expiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        var expired = await GetInviteAsync(ctx, "p1", invite.Id);

        Assert.Equal(GameInviteStatus.Ended, expired.Status);
        Assert.Equal(GameInviteEndReason.Expired, expired.EndReason);
        Assert.Empty(expired.Participants);

        var lateJoin = await JoinByLinkRawAsync("p2", invite.ShareCode);
        Assert.Equal(HttpStatusCode.Conflict, lateJoin.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(ctx, "p1")).StatusCode);
    }

    [Fact]
    public async Task WaitingExpiry_ReleasesCommitments_EvenWithoutAnyRequest()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await SetInviteTimersAsync(invite.Id, expiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        var settled = await ReconcileGameInvitesAsync();

        Assert.True(settled >= 1);
        var row = await QueryAsync(db => db.GameInvites.AsNoTracking().SingleAsync(i => i.Id == invite.Id));
        Assert.Equal(GameInviteStatus.Ended, row.Status);
        Assert.Equal(HttpStatusCode.OK, (await JoinQueueRawAsync(ctx, "p2")).StatusCode);
    }

    [Fact]
    public async Task AcceptanceStartedBeforeExpiry_CompletesAfterOriginalExpiry()
    {
        var r = await StandardAcceptanceRosterAsync();
        await SetInviteTimersAsync(r.Invite.Id, expiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        await AcceptEveryoneAsync(r);

        var active = await GetActiveMatchesAsync(r.Ctx, "p1");
        Assert.Single(active);
    }

    [Fact]
    public async Task FailureAfterOriginalExpiry_ExpiresInsteadOfReopening()
    {
        var r = await StandardAcceptanceRosterAsync();
        await SetInviteTimersAsync(r.Invite.Id, expiresAt: DateTimeOffset.UtcNow.AddSeconds(-1));

        var declined = await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A, accept: false);

        Assert.Equal(GameInviteStatus.Ended, declined.Status);
        Assert.Equal(GameInviteEndReason.Expired, declined.EndReason);
        Assert.Empty(declined.Participants);
    }

    [Fact]
    public async Task StaleRound_IsRejected_AfterTheRoundHasEnded()
    {
        var r = await StandardAcceptanceRosterAsync();
        await SeedPlayerAsync(r.Ctx, "p4");
        await SeedPlayerAsync(r.Ctx, "p5");
        await SeedPlayerAsync(r.Ctx, "p6");
        var oldRound = r.RoundId;

        // p2 declines for themselves; the round fails and the invite reopens with only accepted players.
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, oldRound, r.P2, accept: false);

        await JoinByLinkAsync("p4", r.Invite.ShareCode);
        await JoinByLinkAsync("p5", r.Invite.ShareCode);
        var newRound = (await JoinByLinkAsync("p6", r.Invite.ShareCode)).RoundId!.Value;
        Assert.NotEqual(oldRound, newRound);

        var stale = await RespondRawAsync(r.Ctx, "p1", r.Invite.Id, oldRound, r.P1, accept: true);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);

        var current = await RespondAsync(r.Ctx, "p1", r.Invite.Id, newRound, r.P1, accept: true);
        Assert.Equal(AcceptanceStatus.Accepted, current.Participants.Single(p => p.LeaguePlayerId == r.P1).AcceptanceStatus);
    }

    /// <summary>Every participant accepts, including the representative answering for "a". Returns the final state.</summary>
    private async Task<GameInviteResponse> AcceptEveryoneAsync(StandardRoster r)
    {
        await RespondAsync(r.Ctx, "p1", r.Invite.Id, r.RoundId, r.P1);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.P2);
        await RespondAsync(r.Ctx, "p2", r.Invite.Id, r.RoundId, r.A);
        return await RespondAsync(r.Ctx, "p3", r.Invite.Id, r.RoundId, r.P3);
    }
}
