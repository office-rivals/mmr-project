using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.IntegrationTests.Fixtures;
using Npgsql;
using Respawn;
using Respawn.Graph;
using Xunit;

namespace MMRProject.Api.IntegrationTests;

[Collection("Database")]
public abstract class IntegrationTestBase : IAsyncLifetime
{
    private readonly PostgresFixture _postgresFixture;
    private Respawner _respawner = null!;

    protected static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    protected IntegrationTestFactory Factory { get; }
    protected HttpClient Client { get; private set; } = null!;

    protected IntegrationTestBase(PostgresFixture postgresFixture)
    {
        _postgresFixture = postgresFixture;
        Factory = new IntegrationTestFactory(postgresFixture);
    }

    public async Task InitializeAsync()
    {
        await Factory.EnsureMigratedAsync();
        Client = Factory.CreateClient();

        await using var connection = new NpgsqlConnection(_postgresFixture.GetConnectionString());
        await connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            TablesToIgnore = [new Table("__EFMigrationsHistory")],
        });

        await ResetDatabaseAsync();
    }

    public async Task DisposeAsync()
    {
        Client.Dispose();
        await Factory.DisposeAsync();
    }

    protected async Task ResetDatabaseAsync()
    {
        await using var connection = new NpgsqlConnection(_postgresFixture.GetConnectionString());
        await connection.OpenAsync();
        await _respawner.ResetAsync(connection);
    }

    protected async Task<Organization> CreateOrganization(string name = "Test Org", string slug = "test-org")
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var org = new Organization { Name = name, Slug = slug };
        dbContext.Organizations.Add(org);
        await dbContext.SaveChangesAsync();

        return org;
    }

    protected async Task<League> CreateLeague(Guid organizationId, string name = "Test League",
        string slug = "test-league", int queueSize = 4)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var league = new League
        {
            OrganizationId = organizationId,
            Name = name,
            Slug = slug,
            QueueSize = queueSize,
        };
        dbContext.Leagues.Add(league);
        await dbContext.SaveChangesAsync();

        return league;
    }

    protected async Task<(User User, OrganizationMembership Membership, LeaguePlayer LeaguePlayer)> SeedTestUser(
        Guid organizationId,
        Guid leagueId,
        string identityUserId = "test-user-id",
        string email = "test@example.com",
        OrganizationRole role = OrganizationRole.Member,
        string? displayName = null,
        string? username = null)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var user = new User
        {
            IdentityUserId = identityUserId,
            Email = email,
            DisplayName = displayName,
            Username = username,
        };
        dbContext.V3Users.Add(user);
        await dbContext.SaveChangesAsync();

        var membership = new OrganizationMembership
        {
            OrganizationId = organizationId,
            UserId = user.Id,
            Role = role,
            Status = MembershipStatus.Active,
        };
        dbContext.OrganizationMemberships.Add(membership);
        await dbContext.SaveChangesAsync();

        var leaguePlayer = new LeaguePlayer
        {
            OrganizationId = organizationId,
            LeagueId = leagueId,
            OrganizationMembershipId = membership.Id,
            Mmr = 1000,
            Mu = 25m,
            Sigma = 8.333m,
        };
        dbContext.LeaguePlayers.Add(leaguePlayer);
        await dbContext.SaveChangesAsync();

        return (user, membership, leaguePlayer);
    }

    protected async Task<(User User, OrganizationMembership Membership)> SeedOrgMember(
        Guid organizationId,
        string identityUserId = "test-user-id",
        string email = "test@example.com",
        OrganizationRole role = OrganizationRole.Member)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var user = new User
        {
            IdentityUserId = identityUserId,
            Email = email,
        };
        dbContext.V3Users.Add(user);
        await dbContext.SaveChangesAsync();

        var membership = new OrganizationMembership
        {
            OrganizationId = organizationId,
            UserId = user.Id,
            Role = role,
            Status = MembershipStatus.Active,
        };
        dbContext.OrganizationMemberships.Add(membership);
        await dbContext.SaveChangesAsync();

        return (user, membership);
    }

    protected async Task<OrganizationMembership> SeedExistingUserMembership(
        Guid organizationId,
        Guid userId,
        OrganizationRole role = OrganizationRole.Member)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var membership = new OrganizationMembership
        {
            OrganizationId = organizationId,
            UserId = userId,
            Role = role,
            Status = MembershipStatus.Active,
        };
        dbContext.OrganizationMemberships.Add(membership);
        await dbContext.SaveChangesAsync();

        return membership;
    }

    protected async Task<User> SeedUser(
        string identityUserId = "test-user-id",
        string email = "test@example.com")
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var user = new User
        {
            IdentityUserId = identityUserId,
            Email = email,
        };
        dbContext.V3Users.Add(user);
        await dbContext.SaveChangesAsync();

        return user;
    }

    protected void AuthenticateAs(string identityUserId, OrganizationRole? orgRole = null, string? email = null)
    {
        Factory.ClaimsProvider.SetUser(identityUserId, email ?? $"{identityUserId}@test.com");
        if (orgRole.HasValue)
        {
            Factory.ClaimsProvider.AddClaim("org_role", orgRole.Value.ToString());
        }
    }

    protected void AuthenticateAsPat(
        string identityUserId,
        string scope,
        Guid? organizationId = null,
        Guid? leagueId = null,
        string? email = null)
    {
        Factory.ClaimsProvider.SetUser(identityUserId, email ?? $"{identityUserId}@test.com");
        Factory.ClaimsProvider.AddClaim("auth_method", "pat");
        Factory.ClaimsProvider.AddClaim("pat_id", Guid.NewGuid().ToString());
        Factory.ClaimsProvider.AddClaim("pat_scope", scope);

        if (organizationId.HasValue)
        {
            Factory.ClaimsProvider.AddClaim("pat_org_id", organizationId.Value.ToString());
        }

        if (leagueId.HasValue)
        {
            Factory.ClaimsProvider.AddClaim("pat_league_id", leagueId.Value.ToString());
        }
    }

    protected static async Task<T?> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions);
    }

    protected async Task<V3Season> CreateSeason(Guid organizationId, Guid leagueId,
        DateTimeOffset? startsAt = null)
    {
        using var scope = Factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var season = new V3Season
        {
            OrganizationId = organizationId,
            LeagueId = leagueId,
            StartsAt = startsAt ?? DateTimeOffset.UtcNow,
        };
        dbContext.V3Seasons.Add(season);
        await dbContext.SaveChangesAsync();

        return season;
    }
}
