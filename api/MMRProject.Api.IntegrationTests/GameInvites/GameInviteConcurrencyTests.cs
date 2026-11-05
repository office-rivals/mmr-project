using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.Exceptions;
using MMRProject.Api.IntegrationTests.Fixtures;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.GameInvites;

/// <summary>
/// Races real concurrent requests against the services, each on its own scope and identity.
/// Serial HTTP tests cannot exercise the league commitment lock, so these assert the invariants directly.
/// </summary>
[Collection("Database")]
public class GameInviteConcurrencyTests(PostgresFixture postgres) : GameInviteTestBase(postgres)
{
    [Fact]
    public async Task FinalSpot_ConcurrentJoins_FillExactlyTheRemainingSpots()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        await SeedPlayerAsync(ctx, "p1");
        await SeedPlayerAsync(ctx, "p2");
        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);

        var joiners = Enumerable.Range(3, 6).Select(i => $"p{i}").ToList();
        foreach (var joiner in joiners)
        {
            await SeedPlayerAsync(ctx, joiner);
        }

        var attempts = joiners.Select(joiner => AttemptAsync(() => RunAsUserAsync(
            RootServices,
            joiner,
            sp => sp.GetRequiredService<IGameInviteService>().JoinByShareCodeAsync(invite.ShareCode))));
        var outcomes = await Task.WhenAll(attempts);

        Assert.Equal(2, outcomes.Count(e => e is null));
        Assert.All(outcomes.Where(e => e is not null), e => Assert.IsType<ConflictException>(e));

        var state = await GetInviteAsync(ctx, "p1", invite.Id);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, state.Status);
        Assert.Equal(4, state.Participants.Count);
        Assert.Equal(4, state.Teams.Sum(t => t.Players.Count));
        Assert.Equal(4, state.Participants.Select(p => p.LeaguePlayerId).Distinct().Count());
    }

    [Fact]
    public async Task ConcurrentQueueJoins_FromOnePlayer_CreateOneEntryWithoutErrors()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        var player = await SeedPlayerAsync(ctx, "p1");

        var attempts = Enumerable.Range(0, 6).Select(_ => AttemptAsync(() => RunAsUserAsync(
            RootServices,
            "p1",
            sp => sp.GetRequiredService<IV3MatchMakingService>()
                .AddPlayerToQueueAsync(ctx.OrganizationId, ctx.LeagueId))));
        var outcomes = await Task.WhenAll(attempts);

        Assert.All(outcomes, e => Assert.Null(e));
        var entries = await QueryAsync(db => db.QueueEntries.CountAsync(q =>
            q.LeagueId == ctx.LeagueId && q.LeaguePlayerId == player.Id));
        Assert.Equal(1, entries);
    }

    [Fact]
    public async Task QueueJoinRacesInviteJoin_ForSamePlayer_CommitsExactlyOnce()
    {
        var ctx = await CreateLeagueWithSeasonAsync();
        for (var i = 0; i < 4; i++)
        {
            var creator = $"creator{i}";
            var target = $"target{i}";
            await SeedPlayerAsync(ctx, creator);
            var player = await SeedPlayerAsync(ctx, target);
            var invite = await CreateInviteAsync(ctx, creator);

            var queue = AttemptAsync(() => RunAsUserAsync(
                RootServices,
                target,
                sp => sp.GetRequiredService<IV3MatchMakingService>()
                    .AddPlayerToQueueAsync(ctx.OrganizationId, ctx.LeagueId)));
            var join = AttemptAsync(() => RunAsUserAsync(
                RootServices,
                target,
                sp => sp.GetRequiredService<IGameInviteService>().JoinByShareCodeAsync(invite.ShareCode)));
            var (queueError, joinError) = (await queue, await join);

            Assert.True((queueError is null) != (joinError is null),
                $"Exactly one commitment must win; queue={queueError?.Message}, join={joinError?.Message}");

            var commitments = await QueryAsync(async db =>
            {
                var queued = await db.QueueEntries.CountAsync(q =>
                    q.LeagueId == ctx.LeagueId && q.LeaguePlayerId == player.Id);
                var invited = await db.GameInviteParticipants.CountAsync(p =>
                    p.LeagueId == ctx.LeagueId && p.LeaguePlayerId == player.Id);
                return queued + invited;
            });
            Assert.Equal(1, commitments);
        }
    }

    [Fact]
    public async Task TwoGroupsAddingTheSamePlayer_Concurrently_OnlyOneSucceeds()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        await SeedPlayerAsync(ctx, "creatorA");
        await SeedPlayerAsync(ctx, "creatorB");
        var contested = await SeedUnaccountedPlayerAsync(ctx, "contested");
        var inviteA = await CreateInviteAsync(ctx, "creatorA");
        var inviteB = await CreateInviteAsync(ctx, "creatorB");

        var addA = AttemptAsync(() => RunAsUserAsync(
            RootServices,
            "creatorA",
            sp => sp.GetRequiredService<IGameInviteService>()
                .AddPlayersAsync(ctx.OrganizationId, ctx.LeagueId, inviteA.Id, [contested.Id])));
        var addB = AttemptAsync(() => RunAsUserAsync(
            RootServices,
            "creatorB",
            sp => sp.GetRequiredService<IGameInviteService>()
                .AddPlayersAsync(ctx.OrganizationId, ctx.LeagueId, inviteB.Id, [contested.Id])));
        var (errorA, errorB) = (await addA, await addB);

        Assert.True((errorA is null) != (errorB is null));
        Assert.IsType<ConflictException>(errorA ?? errorB);

        var rosters = await QueryAsync(db => db.GameInviteParticipants
            .CountAsync(p => p.LeagueId == ctx.LeagueId && p.LeaguePlayerId == contested.Id));
        Assert.Equal(1, rosters);
    }

    [Fact]
    public async Task PendingMatch_BlocksInviteJoin_EvenAfterPlayerLeavesQueue()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        for (var i = 1; i <= 4; i++)
        {
            await SeedPlayerAsync(ctx, $"p{i}");
            await JoinQueueRawAsync(ctx, $"p{i}");
        }

        await RunMatchMakingCycleAsync();

        // The queue entry is removed while the pending match still holds the player.
        AuthenticateAs("p1");
        var leave = await Client.DeleteAsync(ctx.QueueUrl);
        Assert.Equal(HttpStatusCode.NoContent, leave.StatusCode);

        var creatorInvite = await CreateInviteRawAsync(ctx, "p1");
        Assert.Equal(HttpStatusCode.Conflict, creatorInvite.StatusCode);
    }

    [Fact]
    public async Task ConcurrentFinalAcceptances_StartExactlyOneMatch()
    {
        var r = await StandardAcceptanceRosterAsync();

        var responses = new[]
        {
            ("p1", r.P1),
            ("p2", r.P2),
            ("p2", r.A),
            ("p3", r.P3),
        }.Select(item => AttemptAsync(() => RunAsUserAsync(
            RootServices,
            item.Item1,
            sp => sp.GetRequiredService<IGameInviteService>()
                .RespondAsync(r.Ctx.OrganizationId, r.Ctx.LeagueId, r.Invite.Id, r.RoundId, item.Item2, accept: true))));
        var outcomes = await Task.WhenAll(responses);

        Assert.All(outcomes, e => Assert.Null(e));
        var activeMatches = await QueryAsync(db => db.V3ActiveMatches.CountAsync(am => am.LeagueId == r.Ctx.LeagueId));
        var invite = await QueryAsync(db => db.GameInvites.AsNoTracking().SingleAsync(i => i.Id == r.Invite.Id));
        Assert.Equal(1, activeMatches);
        Assert.Equal(GameInviteStatus.Started, invite.Status);
    }

    [Fact]
    public async Task IndependentGroups_ReopenAndStartWithoutBlockingEachOther()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        foreach (var name in new[] { "a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4" })
        {
            await SeedPlayerAsync(ctx, name);
        }

        var groupA = await FillRosterThroughLinkAsync(ctx, "a1", ["a2", "a3", "a4"]);
        var groupB = await FillRosterThroughLinkAsync(ctx, "b1", ["b2", "b3", "b4"]);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, groupA.Status);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, groupB.Status);
        var roundB = groupB.RoundId!.Value;

        var aId = await LeaguePlayerIdAsync(ctx, "a2");
        var bIds = new List<(string Identity, Guid Id)>();
        foreach (var name in new[] { "b1", "b2", "b3", "b4" })
        {
            bIds.Add((name, await LeaguePlayerIdAsync(ctx, name)));
        }

        // Group A's failure and group B's final acceptance run at the same time.
        var decline = RunAsUserAsync(RootServices, "a2", sp => sp.GetRequiredService<IGameInviteService>()
            .RespondAsync(ctx.OrganizationId, ctx.LeagueId, groupA.Id, groupA.RoundId!.Value, aId, accept: false));
        var acceptances = bIds.Select(b => RunAsUserAsync(RootServices, b.Identity, sp => sp.GetRequiredService<IGameInviteService>()
            .RespondAsync(ctx.OrganizationId, ctx.LeagueId, groupB.Id, roundB, b.Id, accept: true)));
        await Task.WhenAll(acceptances.Append(decline));

        var reopenedA = await GetInviteAsync(ctx, "a1", groupA.Id);
        var startedB = await GetInviteAsync(ctx, "b1", groupB.Id);
        Assert.Equal(GameInviteStatus.Waiting, reopenedA.Status);
        Assert.Single(reopenedA.Participants);
        Assert.Equal(GameInviteStatus.Started, startedB.Status);
        Assert.Single(await GetActiveMatchesAsync(ctx, "a1"));

        // Refilling group A starts a second concurrent game in the same league.
        await SeedPlayerAsync(ctx, "a5");
        await SeedPlayerAsync(ctx, "a6");
        await SeedPlayerAsync(ctx, "a7");
        await JoinByLinkAsync("a5", groupA.ShareCode);
        await JoinByLinkAsync("a6", groupA.ShareCode);
        var fullA = await JoinByLinkAsync("a7", groupA.ShareCode);
        Assert.Equal(GameInviteStatus.AwaitingAcceptance, fullA.Status);

        foreach (var participant in fullA.Participants)
        {
            var identity = await IdentityOfAsync(ctx, participant.LeaguePlayerId);
            await RespondAsync(ctx, identity, fullA.Id, fullA.RoundId!.Value, participant.LeaguePlayerId);
        }

        Assert.Equal(2, (await GetActiveMatchesAsync(ctx, "a1")).Count);
    }

    private async Task<Guid> LeaguePlayerIdAsync(LeagueContext ctx, string identity) =>
        await QueryAsync(db => db.LeaguePlayers
            .Where(lp => lp.LeagueId == ctx.LeagueId && lp.OrganizationMembership.User!.IdentityUserId == identity)
            .Select(lp => lp.Id)
            .SingleAsync());

    private async Task<string> IdentityOfAsync(LeagueContext ctx, Guid leaguePlayerId) =>
        await QueryAsync(db => db.LeaguePlayers
            .Where(lp => lp.Id == leaguePlayerId && lp.LeagueId == ctx.LeagueId)
            .Select(lp => lp.OrganizationMembership.User!.IdentityUserId)
            .SingleAsync());
}
