using MMRProject.Api.Services.V3;

namespace MMRProject.Api.BackgroundServices;

/// <summary>
/// Rates linked table matches whose auto-submit time has come (<c>Hardware:AutoSubmitDelaySeconds</c> after
/// the winning goal). Checks every second, so the board's countdown and the submit agree.
/// </summary>
public class TableAutoSubmitBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<TableAutoSubmitBackgroundService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ITableMatchService>().SubmitDueMatchesAsync();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Auto-submitting table matches failed");
            }
        }
    }
}
