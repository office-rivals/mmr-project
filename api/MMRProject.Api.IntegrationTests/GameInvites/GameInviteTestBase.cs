using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.IntegrationTests.GameInvites;

public abstract class GameInviteTestBase(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    protected sealed record LeagueContext(Guid OrganizationId, Guid LeagueId)
    {
        public string InvitesUrl => $"api/v3/organizations/{OrganizationId}/leagues/{LeagueId}/game-invites";
        public string QueueUrl => $"api/v3/organizations/{OrganizationId}/leagues/{LeagueId}/queue";
        public string ActiveMatchesUrl => $"api/v3/organizations/{OrganizationId}/leagues/{LeagueId}/active-matches";
    }

    protected async Task<LeagueContext> CreateLeagueWithSeasonAsync(int teamSize = 2)
    {
        var org = await CreateOrganization();
        var league = await CreateLeague(org.Id, teamSize: teamSize);
        await CreateSeason(org.Id, league.Id);
        return new LeagueContext(org.Id, league.Id);
    }

    /// <summary>A league player with a signed-in account. The identity string doubles as the player's name.</summary>
    protected async Task<LeaguePlayer> SeedPlayerAsync(
        LeagueContext ctx,
        string identity,
        OrganizationRole role = OrganizationRole.Member)
    {
        var (_, _, leaguePlayer) = await SeedTestUser(
            ctx.OrganizationId,
            ctx.LeagueId,
            identity,
            $"{identity}@test.com",
            role,
            displayName: identity);
        return leaguePlayer;
    }

    /// <summary>An existing league player who has no linked sign-in account.</summary>
    protected async Task<LeaguePlayer> SeedUnaccountedPlayerAsync(LeagueContext ctx, string displayName)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var membership = new OrganizationMembership
        {
            OrganizationId = ctx.OrganizationId,
            InviteEmail = $"{displayName}@test.com",
            DisplayName = displayName,
            Role = OrganizationRole.Member,
            Status = MembershipStatus.Active,
        };
        dbContext.OrganizationMemberships.Add(membership);
        await dbContext.SaveChangesAsync();

        var leaguePlayer = new LeaguePlayer
        {
            OrganizationId = ctx.OrganizationId,
            LeagueId = ctx.LeagueId,
            OrganizationMembershipId = membership.Id,
            Mmr = 1000,
            Mu = 25m,
            Sigma = 8.333m,
        };
        dbContext.LeaguePlayers.Add(leaguePlayer);
        await dbContext.SaveChangesAsync();

        return leaguePlayer;
    }

    // ----- HTTP helpers ----------------------------------------------------

    protected async Task<GameInviteResponse> CreateInviteAsync(LeagueContext ctx, string identity)
    {
        AuthenticateAs(identity);
        var response = await Client.PostAsync(ctx.InvitesUrl, null);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<GameInviteResponse>(response))!;
    }

    protected async Task<HttpResponseMessage> CreateInviteRawAsync(LeagueContext ctx, string identity)
    {
        AuthenticateAs(identity);
        return await Client.PostAsync(ctx.InvitesUrl, null);
    }

    protected async Task<HttpResponseMessage> JoinByLinkRawAsync(string identity, string shareCode)
    {
        AuthenticateAs(identity);
        return await Client.PostAsync($"api/v3/game-invites/{shareCode}/join", null);
    }

    protected async Task<GameInviteResponse> JoinByLinkAsync(string identity, string shareCode)
    {
        var response = await JoinByLinkRawAsync(identity, shareCode);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<GameInviteResponse>(response))!;
    }

    protected async Task<GameInviteLinkResponse> GetByLinkAsync(string identity, string shareCode)
    {
        AuthenticateAs(identity);
        var response = await Client.GetAsync($"api/v3/game-invites/{shareCode}");
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<GameInviteLinkResponse>(response))!;
    }

    protected async Task<GameInviteResponse> GetInviteAsync(LeagueContext ctx, string identity, Guid inviteId)
    {
        AuthenticateAs(identity);
        var response = await Client.GetAsync($"{ctx.InvitesUrl}/{inviteId}");
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<GameInviteResponse>(response))!;
    }

    protected async Task<CurrentGameInviteResponse> GetCurrentInviteAsync(LeagueContext ctx, string identity)
    {
        AuthenticateAs(identity);
        var response = await Client.GetAsync(ctx.InvitesUrl);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<CurrentGameInviteResponse>(response))!;
    }

    protected async Task<HttpResponseMessage> AddPlayersRawAsync(
        LeagueContext ctx,
        string identity,
        Guid inviteId,
        params Guid[] leaguePlayerIds)
    {
        AuthenticateAs(identity);
        return await Client.PostAsJsonAsync(
            $"{ctx.InvitesUrl}/{inviteId}/players",
            new AddGameInvitePlayersRequest { LeaguePlayerIds = leaguePlayerIds.ToList() });
    }

    protected async Task<GameInviteResponse> AddPlayersAsync(
        LeagueContext ctx,
        string identity,
        Guid inviteId,
        params Guid[] leaguePlayerIds)
    {
        var response = await AddPlayersRawAsync(ctx, identity, inviteId, leaguePlayerIds);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<GameInviteResponse>(response))!;
    }

    protected async Task<HttpResponseMessage> RespondRawAsync(
        LeagueContext ctx,
        string identity,
        Guid inviteId,
        Guid roundId,
        Guid leaguePlayerId,
        bool accept)
    {
        AuthenticateAs(identity);
        var verb = accept ? "accept" : "decline";
        return await Client.PostAsync(
            $"{ctx.InvitesUrl}/{inviteId}/rounds/{roundId}/players/{leaguePlayerId}/{verb}",
            null);
    }

    protected async Task<GameInviteResponse> RespondAsync(
        LeagueContext ctx,
        string identity,
        Guid inviteId,
        Guid roundId,
        Guid leaguePlayerId,
        bool accept = true)
    {
        var response = await RespondRawAsync(ctx, identity, inviteId, roundId, leaguePlayerId, accept);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<GameInviteResponse>(response))!;
    }

    protected async Task<HttpResponseMessage> RemovePlayerRawAsync(
        LeagueContext ctx,
        string identity,
        Guid inviteId,
        Guid leaguePlayerId)
    {
        AuthenticateAs(identity);
        return await Client.DeleteAsync($"{ctx.InvitesUrl}/{inviteId}/players/{leaguePlayerId}");
    }

    protected async Task<HttpResponseMessage> LeaveRawAsync(
        LeagueContext ctx,
        string identity,
        Guid inviteId,
        bool removeManagedPlayers = false)
    {
        AuthenticateAs(identity);
        return await Client.PostAsync(
            $"{ctx.InvitesUrl}/{inviteId}/leave?removeManagedPlayers={removeManagedPlayers.ToString().ToLowerInvariant()}",
            null);
    }

    protected async Task<HttpResponseMessage> CancelRawAsync(LeagueContext ctx, string identity, Guid inviteId)
    {
        AuthenticateAs(identity);
        return await Client.PostAsync($"{ctx.InvitesUrl}/{inviteId}/cancel", null);
    }

    protected async Task<HttpResponseMessage> TakeControlRawAsync(LeagueContext ctx, string identity, Guid inviteId)
    {
        AuthenticateAs(identity);
        return await Client.PostAsync($"{ctx.InvitesUrl}/{inviteId}/take-control", null);
    }

    protected async Task<HttpResponseMessage> JoinQueueRawAsync(LeagueContext ctx, string identity)
    {
        AuthenticateAs(identity);
        return await Client.PostAsync(ctx.QueueUrl, null);
    }

    protected async Task<QueueStatusResponse> GetQueueStatusAsync(LeagueContext ctx, string identity)
    {
        AuthenticateAs(identity);
        var response = await Client.GetAsync(ctx.QueueUrl);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<QueueStatusResponse>(response))!;
    }

    /// <summary>Walks the roster into an acceptance step: creator plus every listed player joins through the link.</summary>
    protected async Task<GameInviteResponse> FillRosterThroughLinkAsync(
        LeagueContext ctx,
        string creator,
        IEnumerable<string> joiners)
    {
        var invite = await CreateInviteAsync(ctx, creator);
        foreach (var joiner in joiners)
        {
            invite = await JoinByLinkAsync(joiner, invite.ShareCode);
        }

        return invite;
    }

    /// <summary>
    /// A 2v2 league with a roster in acceptance: creator p1, p2 with their managed player "a"
    /// (no account, represented by p2), and p3. Teams are already drawn.
    /// </summary>
    protected sealed record StandardRoster(
        LeagueContext Ctx,
        GameInviteResponse Invite,
        Guid P1,
        Guid P2,
        Guid P3,
        Guid A)
    {
        public Guid RoundId => Invite.RoundId!.Value;
    }

    protected async Task<StandardRoster> StandardAcceptanceRosterAsync()
    {
        var ctx = await CreateLeagueWithSeasonAsync(teamSize: 2);
        var p1 = await SeedPlayerAsync(ctx, "p1");
        var p2 = await SeedPlayerAsync(ctx, "p2");
        var p3 = await SeedPlayerAsync(ctx, "p3");
        var a = await SeedUnaccountedPlayerAsync(ctx, "a");

        var invite = await CreateInviteAsync(ctx, "p1");
        await JoinByLinkAsync("p2", invite.ShareCode);
        await AddPlayersAsync(ctx, "p2", invite.Id, a.Id);
        var full = await JoinByLinkAsync("p3", invite.ShareCode);

        return new StandardRoster(ctx, full, p1.Id, p2.Id, p3.Id, a.Id);
    }

    protected async Task<List<ActiveMatchResponse>> GetActiveMatchesAsync(LeagueContext ctx, string identity)
    {
        AuthenticateAs(identity);
        var response = await Client.GetAsync(ctx.ActiveMatchesUrl);
        response.EnsureSuccessStatusCode();
        return (await ReadJsonAsync<List<ActiveMatchResponse>>(response))!;
    }

    // ----- Database and clock helpers -------------------------------------

    protected async Task<T> QueryAsync<T>(Func<ApiDbContext, Task<T>> query)
    {
        using var scope = Factory.Services.CreateScope();
        return await query(scope.ServiceProvider.GetRequiredService<ApiDbContext>());
    }

    /// <summary>Moves an invite's timers into the past (or future) to exercise deadline rules without waiting.</summary>
    protected async Task SetInviteTimersAsync(
        Guid inviteId,
        DateTimeOffset? expiresAt = null,
        DateTimeOffset? acceptanceExpiresAt = null)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var invite = await dbContext.GameInvites.SingleAsync(i => i.Id == inviteId);
        if (expiresAt is { } expires)
        {
            invite.ExpiresAt = expires;
        }

        if (acceptanceExpiresAt is { } acceptanceExpires)
        {
            invite.AcceptanceExpiresAt = acceptanceExpires;
        }

        await dbContext.SaveChangesAsync();
    }

    protected async Task<int> ReconcileGameInvitesAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var gameInvites = scope.ServiceProvider.GetRequiredService<IGameInviteService>();
        return await gameInvites.ReconcileDueInvitesAsync();
    }

    // ----- Concurrency helpers ---------------------------------------------

    /// <summary>
    /// Runs <paramref name="action"/> on its own task with the given identity, bypassing the
    /// shared HTTP test-auth so that several users can act at the same time.
    /// </summary>
    protected static Task<T> RunAsUserAsync<T>(
        IServiceProvider rootServices,
        string identity,
        Func<IServiceProvider, Task<T>> action)
    {
        return Task.Run(async () =>
        {
            using var scope = rootServices.CreateScope();
            var accessor = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
            accessor.HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, identity) },
                    "TestScheme")),
            };

            return await action(scope.ServiceProvider);
        });
    }

    protected static Task RunAsUserAsync(
        IServiceProvider rootServices,
        string identity,
        Func<IServiceProvider, Task> action) =>
        RunAsUserAsync<object?>(rootServices, identity, async sp =>
        {
            await action(sp);
            return null;
        });

    /// <summary>Returns the exception an attempt threw, or null when it succeeded.</summary>
    protected static async Task<Exception?> AttemptAsync(Func<Task> action)
    {
        try
        {
            await action();
            return null;
        }
        catch (Exception ex)
        {
            return ex;
        }
    }

    protected IServiceProvider RootServices => Factory.Services;

    protected static void AssertInviteConflict(HttpStatusCode status) =>
        Assert.Equal(HttpStatusCode.Conflict, status);
}
