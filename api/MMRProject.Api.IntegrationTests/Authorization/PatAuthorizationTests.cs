using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.IntegrationTests.Fixtures;

namespace MMRProject.Api.IntegrationTests.Authorization;

[Collection("Database")]
public class PatAuthorizationTests(PostgresFixture postgres) : IntegrationTestBase(postgres)
{
    [Fact]
    public async Task WriteScopedPat_CanCallWriteEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-read-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);

        AuthenticateAsPat("owner-1", "write", org.Id);

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Allowed", Slug = "allowed" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task UnscopedWritePat_CanCallTenantScopedWriteEndpointThroughBearerAuthentication()
    {
        var org = await CreateOrganization("Org", "pat-unscoped-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        var token = await GeneratePatAsync("owner-1");

        using var realAuthFactory = CreateRealAuthenticationFactory();
        using var patClient = realAuthFactory.CreateClient();
        patClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await patClient.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Allowed", Slug = "allowed" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task UnscopedWritePat_CannotAccessOrganizationWithoutMembership()
    {
        var allowedOrg = await CreateOrganization("Allowed Org", "pat-allowed-org");
        var forbiddenOrg = await CreateOrganization("Forbidden Org", "pat-forbidden-org");
        await SeedOrgMember(allowedOrg.Id, "member-1", "member@test.com");
        var token = await GeneratePatAsync("member-1");

        using var realAuthFactory = CreateRealAuthenticationFactory();
        using var patClient = realAuthFactory.CreateClient();
        patClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await patClient.GetAsync($"api/v3/organizations/{forbiddenOrg.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UnscopedWritePat_DoesNotElevateOrganizationRole()
    {
        var org = await CreateOrganization("Org", "pat-member-org");
        await SeedOrgMember(org.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write");

        var response = await Client.PostAsJsonAsync(
            $"api/v3/organizations/{org.Id}/leagues",
            new CreateLeagueRequest { Name = "Forbidden", Slug = "forbidden" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UnsupportedScopePat_CannotCallPatCompatibleEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-unsupported-scope-org");
        await SeedOrgMember(org.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "read");

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UnscopedWritePat_CannotAccessOrganizationAfterMembershipRemoval()
    {
        var org = await CreateOrganization("Org", "pat-removed-org");
        var (_, membership) = await SeedOrgMember(org.Id, "member-1", "member@test.com");
        membership.Status = MembershipStatus.Removed;

        using (var scope = Factory.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<MMRProject.Api.Data.ApiDbContext>();
            dbContext.OrganizationMemberships.Update(membership);
            await dbContext.SaveChangesAsync();
        }

        AuthenticateAsPat("member-1", "write");

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task OrgScopedPat_CannotAccessDifferentOrganization()
    {
        var orgA = await CreateOrganization("Org A", "pat-org-a");
        var orgB = await CreateOrganization("Org B", "pat-org-b");

        var user = await SeedUser("member-1", "member@test.com");
        await SeedExistingUserMembership(orgA.Id, user.Id);
        await SeedExistingUserMembership(orgB.Id, user.Id);

        AuthenticateAsPat("member-1", "write", orgA.Id);

        var response = await Client.GetAsync($"api/v3/organizations/{orgB.Id}/members");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LeagueScopedPat_CannotCallOrganizationWideEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-league-org");
        var league = await CreateLeague(org.Id, "League", "pat-league");
        await SeedOrgMember(org.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write", org.Id, league.Id);

        var response = await Client.GetAsync($"api/v3/organizations/{org.Id}/members");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LeagueScopedPat_CannotAccessSiblingLeague()
    {
        var org = await CreateOrganization("Org", "pat-sibling-org");
        var allowedLeague = await CreateLeague(org.Id, "Allowed League", "pat-allowed-league");
        var forbiddenLeague = await CreateLeague(org.Id, "Forbidden League", "pat-forbidden-league");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);

        AuthenticateAsPat("owner-1", "write", org.Id, allowedLeague.Id);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{forbiddenLeague.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task LeagueScopedPat_IsRestrictedThroughBearerAuthentication()
    {
        var orgA = await CreateOrganization("Org A", "pat-real-scope-org-a");
        var orgB = await CreateOrganization("Org B", "pat-real-scope-org-b");
        var leagueA = await CreateLeague(orgA.Id, "League A", "pat-real-scope-league-a");
        var leagueB = await CreateLeague(orgA.Id, "League B", "pat-real-scope-league-b");
        var user = await SeedUser("owner-1", "owner@test.com");
        await SeedExistingUserMembership(orgA.Id, user.Id, OrganizationRole.Owner);
        await SeedExistingUserMembership(orgB.Id, user.Id, OrganizationRole.Owner);
        var token = await GeneratePatAsync("owner-1", orgA.Id, leagueA.Id);

        using var realAuthFactory = CreateRealAuthenticationFactory();
        using var patClient = realAuthFactory.CreateClient();
        patClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var allowedResponse = await patClient.GetAsync(
            $"api/v3/organizations/{orgA.Id}/leagues/{leagueA.Id}/leaderboard");
        var siblingLeagueResponse = await patClient.GetAsync(
            $"api/v3/organizations/{orgA.Id}/leagues/{leagueB.Id}/leaderboard");
        var otherOrganizationResponse = await patClient.GetAsync($"api/v3/organizations/{orgB.Id}");

        Assert.Equal(HttpStatusCode.OK, allowedResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, siblingLeagueResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, otherOrganizationResponse.StatusCode);
    }

    [Fact]
    public async Task JwtOnlyTokenManagement_RejectsPatAuthentication()
    {
        await SeedUser("member-1", "member@test.com");
        AuthenticateAsPat("member-1", "write");

        var response = await Client.GetAsync("api/v3/me/tokens");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task WriteScopedPat_CanReadTenantScopedEndpoint()
    {
        var org = await CreateOrganization("Org", "pat-read-allowed-org");
        var league = await CreateLeague(org.Id, "League", "pat-read-allowed-league");
        await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write", org.Id, league.Id);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/leaderboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task WriteScopedPat_CanResolveCurrentLeaguePlayer()
    {
        var org = await CreateOrganization("Org", "pat-player-org");
        var league = await CreateLeague(org.Id, "League", "pat-player-league");
        await SeedTestUser(org.Id, league.Id, "member-1", "member@test.com");

        AuthenticateAsPat("member-1", "write", org.Id, league.Id);

        var response = await Client.GetAsync(
            $"api/v3/organizations/{org.Id}/leagues/{league.Id}/players/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task InvalidPat_IsRejectedByBearerAuthentication()
    {
        using var realAuthFactory = CreateRealAuthenticationFactory();
        using var patClient = realAuthFactory.CreateClient();
        patClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "pat_invalid");

        var response = await patClient.GetAsync($"api/v3/organizations/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredPat_IsRejectedByBearerAuthentication()
    {
        var org = await CreateOrganization("Org", "pat-expired-org");
        await SeedOrgMember(org.Id, "owner-1", "owner@test.com", OrganizationRole.Owner);
        var token = await GeneratePatAsync(
            "owner-1", expiresAt: DateTimeOffset.UtcNow.AddMinutes(-1));

        using var realAuthFactory = CreateRealAuthenticationFactory();
        using var patClient = realAuthFactory.CreateClient();
        patClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await patClient.GetAsync($"api/v3/organizations/{org.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<string> GeneratePatAsync(
        string identityUserId,
        Guid? organizationId = null,
        Guid? leagueId = null,
        DateTimeOffset? expiresAt = null)
    {
        AuthenticateAs(identityUserId);
        var response = await Client.PostAsJsonAsync("api/v3/me/tokens", new CreateTokenRequest
        {
            Name = "Integration test token",
            Scope = "write",
            OrganizationId = organizationId,
            LeagueId = leagueId,
            ExpiresAt = expiresAt,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var result = await ReadJsonAsync<CreateTokenResponse>(response);
        Assert.NotNull(result);
        return result.Token;
    }

    private WebApplicationFactory<Program> CreateRealAuthenticationFactory()
    {
        return Factory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services =>
                services.PostConfigure<AuthenticationOptions>(options =>
                {
                    options.DefaultScheme = "MultiAuth";
                    options.DefaultAuthenticateScheme = "MultiAuth";
                    options.DefaultChallengeScheme = "MultiAuth";
                    options.DefaultForbidScheme = "MultiAuth";
                })));
    }
}
