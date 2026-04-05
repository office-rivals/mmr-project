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
    private readonly StubMMRCalculationApiClient _stubMmrCalculationApiClient = new();
    private bool _migrated;

    public TestClaimsProvider ClaimsProvider => _claimsProvider;
    public StubMMRCalculationApiClient StubMmrCalculationApiClient => _stubMmrCalculationApiClient;

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

            services.AddSingleton(_stubMmrCalculationApiClient);
            services.AddSingleton<IMMRCalculationApiClient>(_stubMmrCalculationApiClient);
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
    public bool ThrowOnCalculate { get; set; }

    public Task<MMRCalculationResponse> CalculateMMRAsync(MMRCalculationRequest request)
    {
        if (ThrowOnCalculate)
            throw new InvalidOperationException("MMR calculation failed");

        return Task.FromResult(BuildResponse(request));
    }

    public Task<List<MMRCalculationResponse>> CalculateMMRBatchAsync(List<MMRCalculationRequest> requests)
    {
        return Task.FromResult(requests.Select(BuildResponse).ToList());
    }

    private static MMRCalculationResponse BuildResponse(MMRCalculationRequest request)
    {
        var team1Delta = request.Team1.Score == request.Team2.Score
            ? 0
            : request.Team1.Score > request.Team2.Score
                ? 25
                : -25;
        var team2Delta = -team1Delta;

        return new MMRCalculationResponse
        {
            Team1 = new MMRCalculationTeamResult
            {
                Score = request.Team1.Score,
                Players = request.Team1.Players.Select(p => new MMRCalculationPlayerResult
                {
                    Id = p.Id,
                    Mu = (p.Mu ?? 25m) + (team1Delta / 100m),
                    Sigma = Math.Max((p.Sigma ?? 8.333m) - 0.1m, 0.1m),
                    MMR = (int)(1000 + Math.Round((((p.Mu ?? 25m) + (team1Delta / 100m)) - 25m) * 100m))
                })
            },
            Team2 = new MMRCalculationTeamResult
            {
                Score = request.Team2.Score,
                Players = request.Team2.Players.Select(p => new MMRCalculationPlayerResult
                {
                    Id = p.Id,
                    Mu = (p.Mu ?? 25m) + (team2Delta / 100m),
                    Sigma = Math.Max((p.Sigma ?? 8.333m) - 0.1m, 0.1m),
                    MMR = (int)(1000 + Math.Round((((p.Mu ?? 25m) + (team2Delta / 100m)) - 25m) * 100m))
                })
            }
        };
    }
}
