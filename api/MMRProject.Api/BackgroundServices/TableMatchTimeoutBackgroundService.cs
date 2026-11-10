using MMRProject.Api.Services.V3;

namespace MMRProject.Api.BackgroundServices;

/// <summary>
/// Closes table matches nobody has touched for the live-match timeout (a missed "sleep" status), and deletes
/// expired card link requests.
/// </summary>
public class TableMatchTimeoutBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<TableMatchTimeoutBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var closed = await scope.ServiceProvider.GetRequiredService<ITableMatchService>()
                    .CloseStaleMatchesAsync();
                if (closed > 0)
                {
                    logger.LogInformation("Closed {Count} idle table matches", closed);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Closing idle table matches failed");
            }
        }
    }
}
