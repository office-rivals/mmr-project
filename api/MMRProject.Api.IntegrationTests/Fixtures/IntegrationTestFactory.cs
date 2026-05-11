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
    private readonly List<MMRCalculationRequest> _requests = [];
    private readonly List<int> _batchSizes = [];
    private int _singleCallCount;
    private int _batchCallCount;

    public bool ThrowOnCalculate { get; set; }

    /// When set, batch calls return this many responses regardless of request count.
    /// Used to exercise the count-mismatch failure path.
    public int? BatchResponseCountOverride { get; set; }

    public IReadOnlyList<MMRCalculationRequest> Requests => _requests;

    public int SingleCallCount => _singleCallCount;
    public int BatchCallCount => _batchCallCount;
    public IReadOnlyList<int> BatchSizes => _batchSizes;

    public void ResetRequests() => _requests.Clear();

    public void ResetCallCounters()
    {
        _singleCallCount = 0;
        _batchCallCount = 0;
        _batchSizes.Clear();
    }

    public Task<MMRCalculationResponse> CalculateMMRAsync(MMRCalculationRequest request)
    {
        _singleCallCount++;

        if (ThrowOnCalculate)
            throw new InvalidOperationException("MMR calculation failed");

        _requests.Add(request);
        return Task.FromResult(BuildResponse(request));
    }

    public Task<List<MMRCalculationResponse>> CalculateMMRBatchAsync(List<MMRCalculationRequest> requests)
    {
        _batchCallCount++;
        _batchSizes.Add(requests.Count);

        _requests.AddRange(requests);

        // Mirror the real mmr-api batch endpoint's carry-forward semantic: a
        // player's first appearance uses the request mu/sigma; subsequent
        // appearances inherit the previous match's output for the same Id.
        var carry = new Dictionary<long, (decimal Mu, decimal Sigma)>();
        var responses = requests.Select(req => BuildBatchResponse(req, carry)).ToList();

        if (BatchResponseCountOverride is { } cap)
        {
            responses = responses.Take(cap).ToList();
        }
        return Task.FromResult(responses);
    }

    private static MMRCalculationResponse BuildBatchResponse(
        MMRCalculationRequest request,
        Dictionary<long, (decimal Mu, decimal Sigma)> carry)
    {
        MMRCalculationPlayerRating WithCarry(MMRCalculationPlayerRating p) =>
            carry.TryGetValue(p.Id, out var s)
                ? new MMRCalculationPlayerRating { Id = p.Id, Mu = s.Mu, Sigma = s.Sigma }
                : p;

        var carriedRequest = new MMRCalculationRequest
        {
            Team1 = new MMRCalculationTeam
            {
                Score = request.Team1.Score,
                Players = request.Team1.Players.Select(WithCarry).ToList(),
            },
            Team2 = new MMRCalculationTeam
            {
                Score = request.Team2.Score,
                Players = request.Team2.Players.Select(WithCarry).ToList(),
            },
        };

        var response = BuildResponse(carriedRequest);
        foreach (var pr in response.Team1.Players.Concat(response.Team2.Players))
        {
            carry[pr.Id] = (pr.Mu, pr.Sigma);
        }
        return response;
    }

    // Deterministic placeholder response. Tests should assert on the inputs the
    // service passed (captured in Requests) and on what the service did with the
    // response (delta=0 for first-of-season, etc.), NOT on the response shape —
    // that's the real calculator's contract, not this stub's.
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
                Players = request.Team1.Players.Select(p => BuildPlayerResult(p, team1Delta)),
            },
            Team2 = new MMRCalculationTeamResult
            {
                Score = request.Team2.Score,
                Players = request.Team2.Players.Select(p => BuildPlayerResult(p, team2Delta)),
            },
        };
    }

    private static MMRCalculationPlayerResult BuildPlayerResult(MMRCalculationPlayerRating p, int matchDelta)
    {
        var inputMu = p.Mu ?? 25m;
        var inputSigma = p.Sigma ?? 8.333m;
        var newMu = inputMu + (matchDelta / 100m);
        var newSigma = Math.Max(inputSigma - 0.1m, 0.1m);
        return new MMRCalculationPlayerResult
        {
            Id = p.Id,
            Mu = newMu,
            Sigma = newSigma,
            MMR = (int)(1000 + Math.Round((newMu - 25m) * 100m)),
        };
    }
}
