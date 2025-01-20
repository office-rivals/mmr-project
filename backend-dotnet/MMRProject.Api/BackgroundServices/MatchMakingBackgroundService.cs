using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.BackgroundServices;

public class MatchMakingBackgroundService(
    ILogger<MatchMakingBackgroundService> logger,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
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

        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();

        var pendingMatches = await dbContext.PendingMatches
            .Include(pm => pm.QueuedPlayers)
            .Where(pm => pm.Status == PendingMatchStatus.Pending)
            .ToListAsync(cancellationToken);

        if (pendingMatches.Count == 0)
        {
            return false;
        }

        foreach (var pendingMatch in pendingMatches)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                return false;
            }

            if (pendingMatch.ExpiresAt.AddSeconds(1) > DateTime.UtcNow)
            {
                // We are still waiting for responses
                continue;
            }

            // We are still in pending state after response timeout. Decline the match and allow players to queue again

            var missingAcceptedPlayers =
                pendingMatch.QueuedPlayers.Where(x => x.LastAcceptedMatchId != pendingMatch.Id);
            pendingMatch.Status = PendingMatchStatus.Declined;
            pendingMatch.UpdatedAt = DateTimeOffset.UtcNow;
            dbContext.QueuedPlayers.RemoveRange(missingAcceptedPlayers);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }
}