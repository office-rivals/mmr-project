using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MMRProject.Api.BackgroundServices;
using MMRProject.Api.Data;
using MMRProject.Api.MMRCalculationApi;
using MMRProject.Api.MMRCalculationApi.Models;

namespace MMRProject.Api.IntegrationTests.Fixtures;

public class IntegrationTestFactory : WebApplicationFactory<Program>
{
    private readonly PostgresFixture _postgresFixture;
    private readonly TestClaimsProvider _claimsProvider = new();
    private bool _migrated;

    public TestClaimsProvider ClaimsProvider => _claimsProvider;

    public IntegrationTestFactory(PostgresFixture postgresFixture)
    {
        _postgresFixture = postgresFixture;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("Migration:Enabled", "false");
        builder.UseSetting("Authorization:Issuer", "https://test-issuer.example.com");
        builder.UseSetting("ASPNETCORE_URLS", "http://+:80");

        builder.ConfigureTestServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApiDbContext>));
            if (descriptor != null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContextPool<ApiDbContext>(opt =>
                opt.UseNpgsql(
                    _postgresFixture.GetConnectionString(),
                    o => o.SetPostgresVersion(13, 0)
                )
            );

            var bgServices = services
                .Where(d => d.ServiceType == typeof(IHostedService) &&
                            d.ImplementationType == typeof(V3MatchMakingBackgroundService))
                .ToList();
            foreach (var svc in bgServices)
            {
                services.Remove(svc);
            }

            services.AddAuthentication("TestScheme")
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", _ => { });
            services.AddSingleton(_claimsProvider);

            services.AddSingleton<IMMRCalculationApiClient, StubMMRCalculationApiClient>();
        });
    }

    public async Task EnsureMigratedAsync()
    {
        if (_migrated) return;

        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        await dbContext.Database.MigrateAsync();
        _migrated = true;
    }
}

public class StubMMRCalculationApiClient : IMMRCalculationApiClient
{
    public Task<MMRCalculationResponse> CalculateMMRAsync(MMRCalculationRequest request)
    {
        return Task.FromResult(BuildResponse(request));
    }

    public Task<List<MMRCalculationResponse>> CalculateMMRBatchAsync(List<MMRCalculationRequest> requests)
    {
        return Task.FromResult(requests.Select(BuildResponse).ToList());
    }

    private static MMRCalculationResponse BuildResponse(MMRCalculationRequest request)
    {
        return new MMRCalculationResponse
        {
            Team1 = new MMRCalculationTeamResult
            {
                Score = request.Team1.Score,
                Players = request.Team1.Players.Select(p => new MMRCalculationPlayerResult
                {
                    Id = p.Id,
                    Mu = p.Mu ?? 25m,
                    Sigma = p.Sigma ?? 8.333m,
                    MMR = 1000
                })
            },
            Team2 = new MMRCalculationTeamResult
            {
                Score = request.Team2.Score,
                Players = request.Team2.Players.Select(p => new MMRCalculationPlayerResult
                {
                    Id = p.Id,
                    Mu = p.Mu ?? 25m,
                    Sigma = p.Sigma ?? 8.333m,
                    MMR = 1000
                })
            }
        };
    }
}
