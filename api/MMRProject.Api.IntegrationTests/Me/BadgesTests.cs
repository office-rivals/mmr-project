using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Me;

[Collection("Database")]
public class BadgesTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    private async Task<(Organization Org, League League, LeaguePlayer P1, LeaguePlayer P2, LeaguePlayer P3,
        LeaguePlayer P4)> SetupOrgWithPlayers(
        string prefix, string orgSlug, OrganizationRole p1Role = OrganizationRole.Owner)
    {
        var org = await CreateOrganization($"Org {prefix}", orgSlug);
        var league = await CreateLeague(org.Id, $"League {prefix}", $"league-{prefix}");
        await CreateSeason(org.Id, league.Id);

        var (_, _, p1) = await SeedTestUser(org.Id, league.Id, $"{prefix}1", $"{prefix}1@test.com", p1Role);
        var (_, _, p2) = await SeedTestUser(org.Id, league.Id, $"{prefix}2", $"{prefix}2@test.com");
        var (_, _, p3) = await SeedTestUser(org.Id, league.Id, $"{prefix}3", $"{prefix}3@test.com");
        var (_, _, p4) = await SeedTestUser(org.Id, league.Id, $"{prefix}4", $"{prefix}4@test.com");

        return (org, league, p1, p2, p3, p4);
    }

    private async Task<Guid> SubmitMatchAndFlag(Guid orgId, Guid leagueId, Guid p1, Guid p2, Guid p3, Guid p4,
        string flaggerIdentity)
    {
        var matchResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/matches",
            new SubmitMatchRequest
            {
                Teams =
                [
                    new SubmitMatchTeamRequest { Players = [p1, p2], Score = 10 },
                    new SubmitMatchTeamRequest { Players = [p3, p4], Score = 5 }
                ]
            });
        matchResponse.EnsureSuccessStatusCode();
        var match = (await ReadJsonAsync<MatchResponse>(matchResponse))!;

        AuthenticateAs(flaggerIdentity);
        var flagResponse = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{orgId}/leagues/{leagueId}/match-flags",
            new CreateMatchFlagRequest { MatchId = match.Id, Reason = "Wrong score" });
        flagResponse.EnsureSuccessStatusCode();

        return match.Id;
    }

    private async Task<BadgesResponse> GetBadges()
    {
        var response = await Client.GetAsync("api/v3/me/badges");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync<BadgesResponse>(response))!;
    }

    // ---- Core behaviour -------------------------------------------------

    [Fact]
    public async Task Badges_ModeratorSeesOpenFlagCountsForTheirOrg()
    {
        var (org, league, p1, p2, p3, p4) = await SetupOrgWithPlayers("a", "org-a", OrganizationRole.Moderator);
        AuthenticateAs("a2");
        await SubmitMatchAndFlag(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id, "a2");

        AuthenticateAs("a1");
        var badges = await GetBadges();

        Assert.Equal(1, badges.OpenMatchFlags.Total);
        Assert.Equal(1, badges.OpenMatchFlags.ByOrganization[org.Id]);
        Assert.Equal(1, badges.OpenMatchFlags.ByLeague[league.Id]);
    }

    [Fact]
    public async Task Badges_MemberGetsNoCounts()
    {
        // p1 is a plain Member — must not learn how many flags the org has.
        var (org, league, p1, p2, p3, p4) = await SetupOrgWithPlayers("b", "org-b", OrganizationRole.Member);
        AuthenticateAs("b2");
        await SubmitMatchAndFlag(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id, "b2");

        AuthenticateAs("b1");
        var badges = await GetBadges();

        Assert.Equal(0, badges.OpenMatchFlags.Total);
        Assert.Empty(badges.OpenMatchFlags.ByOrganization);
        Assert.Empty(badges.OpenMatchFlags.ByLeague);
    }

    [Fact]
    public async Task Badges_DoNotLeakAcrossOrganizations()
    {
        var (orgA, leagueA, a1, a2, a3, a4) = await SetupOrgWithPlayers("c", "org-c");
        var (orgB, leagueB, b1, b2, b3, b4) = await SetupOrgWithPlayers("d", "org-d");

        AuthenticateAs("c1");
        await SubmitMatchAndFlag(orgA.Id, leagueA.Id, a1.Id, a2.Id, a3.Id, a4.Id, "c2");
        AuthenticateAs("d1");
        await SubmitMatchAndFlag(orgB.Id, leagueB.Id, b1.Id, b2.Id, b3.Id, b4.Id, "d2");

        // c1 owns only org C.
        AuthenticateAs("c1");
        var badges = await GetBadges();

        Assert.Equal(1, badges.OpenMatchFlags.Total);
        Assert.True(badges.OpenMatchFlags.ByOrganization.ContainsKey(orgA.Id));
        Assert.False(badges.OpenMatchFlags.ByOrganization.ContainsKey(orgB.Id));
        Assert.False(badges.OpenMatchFlags.ByLeague.ContainsKey(leagueB.Id));
    }

    [Fact]
    public async Task Badges_OnlyOpenFlagsAreCounted_ResolvingDecrements()
    {
        var (org, league, p1, p2, p3, p4) = await SetupOrgWithPlayers("e", "org-e");
        AuthenticateAs("e1");
        await SubmitMatchAndFlag(org.Id, league.Id, p1.Id, p2.Id, p3.Id, p4.Id, "e2");

        AuthenticateAs("e1");
        Assert.Equal(1, (await GetBadges()).OpenMatchFlags.Total);

        var flags = await Client.GetFromJsonAsync<List<MatchFlagResponse>>(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/admin/match-flags", JsonOptions);
        var resolve = await Client.PatchAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/admin/match-flags/{flags![0].Id}/resolve",
            new ResolveMatchFlagRequest { Status = MatchFlagStatus.Resolved });
        resolve.EnsureSuccessStatusCode();

        Assert.Equal(0, (await GetBadges()).OpenMatchFlags.Total);
    }

    // Unlike GetMeAsync, this endpoint does not call EnsureUserAsync or
    // AutoClaimInvitesAsync — it only reads. Callers must therefore fetch the
    // profile first, or a user whose row and invites have not been created yet
    // will be told they have nothing to handle.
    [Fact]
    public async Task Badges_DoNotProvisionTheUser()
    {
        AuthenticateAs("never-seen", email: "never-seen@test.com");

        var badges = await GetBadges();
        Assert.Equal(0, badges.OpenMatchFlags.Total);

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var exists = await db.V3Users.AnyAsync(u => u.IdentityUserId == "never-seen");

        Assert.False(exists);
    }

    [Fact]
    public async Task Badges_TolerateFlagWithMismatchedOrgAndLeague()
    {
        var (orgA, leagueA, a1, a2, a3, a4) = await SetupOrgWithPlayers("f", "org-f");
        var orgB = await CreateOrganization("Org G", "org-g");

        AuthenticateAs("f1");
        var matchId = await SubmitMatchAndFlag(orgA.Id, leagueA.Id, a1.Id, a2.Id, a3.Id, a4.Id, "f2");

        // Force the corrupt state the finding requires: a second flag row on the
        // SAME league but attributed to a DIFFERENT organization. Done directly in
        // the DB because the API validates org+league together.
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
            // Make f1 an owner of org B too, so both orgs are in scope for the query.
            var user = await db.V3Users.FirstAsync(u => u.IdentityUserId == "f1");
            db.OrganizationMemberships.Add(new OrganizationMembership
            {
                OrganizationId = orgB.Id,
                UserId = user.Id,
                Role = OrganizationRole.Owner,
                Status = MembershipStatus.Active,
                DisplayName = "F One"
            });
            await db.SaveChangesAsync();

            var membershipB = await db.OrganizationMemberships
                .FirstAsync(m => m.OrganizationId == orgB.Id && m.UserId == user.Id);

            db.Set<V3MatchFlag>().Add(new V3MatchFlag
            {
                OrganizationId = orgB.Id,     // <-- mismatched: league belongs to org A
                LeagueId = leagueA.Id,
                MatchId = matchId,
                FlaggedByMembershipId = membershipB.Id,
                Reason = "corrupt row",
                Status = MatchFlagStatus.Open,
                UpdatedAt = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        AuthenticateAs("f1");
        var response = await Client.GetAsync("api/v3/me/badges");

        // Rows are keyed by (org, league), so one league under two orgs used to
        // throw out of ToDictionary and 500. Only reachable via inconsistent data
        // — the API validates org+league together on write — but the summary now
        // groups before keying, so it sums instead of failing.
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var badges = (await ReadJsonAsync<BadgesResponse>(response))!;
        Assert.Equal(2, badges.OpenMatchFlags.Total);
        Assert.Equal(2, badges.OpenMatchFlags.ByLeague[leagueA.Id]);
    }
}
