using MMRProject.Api.Services;

namespace MMRProject.Api.BackgroundServices;

public class MatchMakingBackgroundService(ILogger<MatchMakingBackgroundService> logger, IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Running match making background service");

            var frequentUpdates = await DoWorkAsync(stoppingToken);
            
            var delay = frequentUpdates ? TimeSpan.FromSeconds(1) : TimeSpan.FromSeconds(20);
            await Task.Delay(delay, stoppingToken);
        }
    }

    private async Task<bool> DoWorkAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        
        var matchMakingService = scope.ServiceProvider.GetRequiredService<IMatchMakingService>();
        
        var hasPendingMatches = await matchMakingService.VerifyStateOfPendingMatchesAsync(cancellationToken);
        return hasPendingMatches;
    }
}