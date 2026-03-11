using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.BackgroundServices;

public class V3MatchMakingBackgroundService(
    ILogger<V3MatchMakingBackgroundService> logger,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("Running v3 match making background service");

            var frequentUpdates = await DoWorkAsync(stoppingToken);

            var delay = frequentUpdates ? TimeSpan.FromSeconds(1) : TimeSpan.FromSeconds(20);
            await Task.Delay(delay, stoppingToken);
        }
    }

    private async Task<bool> DoWorkAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();

        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var expiredMatches = await dbContext.V3PendingMatches
            .Include(pm => pm.Acceptances)
            .Where(pm => pm.Status == AcceptanceStatus.Pending)
            .Where(pm => pm.ExpiresAt.AddSeconds(1) < DateTimeOffset.UtcNow)
            .ToListAsync(cancellationToken);

        if (expiredMatches.Count == 0)
        {
            return false;
        }

        foreach (var pendingMatch in expiredMatches)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                return false;
            }

            pendingMatch.Status = AcceptanceStatus.Declined;

            var nonAcceptedPlayerIds = pendingMatch.Acceptances
                .Where(a => a.Status != AcceptanceStatus.Accepted)
                .Select(a => a.LeaguePlayerId)
                .ToList();

            var queueEntriesToRemove = await dbContext.QueueEntries
                .Where(q => q.LeagueId == pendingMatch.LeagueId && nonAcceptedPlayerIds.Contains(q.LeaguePlayerId))
                .ToListAsync(cancellationToken);

            dbContext.QueueEntries.RemoveRange(queueEntriesToRemove);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}
