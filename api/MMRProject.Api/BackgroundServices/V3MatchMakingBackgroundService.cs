using MMRProject.Api.Services.V3;

namespace MMRProject.Api.BackgroundServices;

public class V3MatchMakingBackgroundService(
    ILogger<V3MatchMakingBackgroundService> logger,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                // Each step is isolated so a failure in one does not stop the other.
                await RunStepAsync("process pending matches", ProcessPendingMatchesAsync, stoppingToken);
                await RunStepAsync("settle game invites", SettleGameInvitesAsync, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Shutting down.
        }
    }

    private async Task RunStepAsync(
        string description,
        Func<CancellationToken, Task> step,
        CancellationToken stoppingToken)
    {
        try
        {
            await step(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to {Description} in v3 matchmaking background work", description);
        }
    }

    private async Task ProcessPendingMatchesAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        var coordinator = scope.ServiceProvider.GetRequiredService<IV3PendingMatchCoordinator>();
        await coordinator.ProcessOnceAsync(cancellationToken);
    }

    private async Task SettleGameInvitesAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        var gameInvites = scope.ServiceProvider.GetRequiredService<IGameInviteService>();
        await gameInvites.ReconcileDueInvitesAsync(cancellationToken);
    }
}
