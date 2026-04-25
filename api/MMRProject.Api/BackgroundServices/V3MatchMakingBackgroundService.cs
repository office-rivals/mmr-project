using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

using MMRProject.Api.Services.V3;

namespace MMRProject.Api.BackgroundServices;

public class V3MatchMakingBackgroundService(
    ILogger<V3MatchMakingBackgroundService> logger,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await DoWorkAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to process v3 matchmaking background work");
            }
        }
    }

    private async Task DoWorkAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        var coordinator = scope.ServiceProvider.GetRequiredService<IV3PendingMatchCoordinator>();
        await coordinator.ProcessOnceAsync(cancellationToken);
    }
}
