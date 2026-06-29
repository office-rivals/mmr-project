using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MMRProject.Api.Configuration;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.Services.V3;

namespace MMRProject.Api.BackgroundServices;

/// <summary>
/// Polls <see cref="NotificationDelivery"/> rows that are due and hands them
/// to the dispatcher. Failures are rescheduled with exponential backoff; after
/// <see cref="PushOptions.MaxAttempts"/> a delivery is marked <c>Dead</c>.
/// </summary>
public class NotificationDispatchBackgroundService(
    ILogger<NotificationDispatchBackgroundService> logger,
    IOptions<PushOptions> options,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    private static readonly TimeSpan[] BackoffSchedule =
    {
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(6),
    };

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = options.Value.DispatchInterval;
        logger.LogInformation("Push notification dispatch loop started (interval={Interval})", interval);

        using var timer = new PeriodicTimer(interval);

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
                logger.LogError(ex, "Failed to process push notification dispatch tick");
            }
        }
    }

    private async Task DoWorkAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        var dispatcher = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();

        var now = DateTimeOffset.UtcNow;
        var batchSize = options.Value.DispatchBatchSize;

        var due = await dbContext.NotificationDeliveries
            .Where(d => d.Status == NotificationDeliveryStatus.Pending && d.NextAttemptAt <= now)
            .OrderBy(d => d.NextAttemptAt)
            .Take(batchSize)
            .ToListAsync(cancellationToken);

        if (due.Count == 0)
        {
            return;
        }

        logger.LogDebug("Dispatching {Count} push notifications", due.Count);

        foreach (var delivery in due)
        {
            var result = await dispatcher.DispatchAsync(delivery, cancellationToken);

            switch (result.Outcome)
            {
                case DispatchOutcome.Delivered:
                    delivery.Status = NotificationDeliveryStatus.Sent;
                    delivery.SentAt = DateTimeOffset.UtcNow;
                    delivery.LastError = null;
                    break;

                case DispatchOutcome.SubscriptionGone:
                    delivery.Status = NotificationDeliveryStatus.Dead;
                    delivery.LastError = result.Error;
                    break;

                case DispatchOutcome.FatalFailure:
                    delivery.Status = NotificationDeliveryStatus.Dead;
                    delivery.LastError = result.Error;
                    break;

                case DispatchOutcome.RetryableFailure:
                    delivery.AttemptCount++;
                    delivery.LastError = result.Error;
                    if (delivery.AttemptCount >= options.Value.MaxAttempts)
                    {
                        delivery.Status = NotificationDeliveryStatus.Dead;
                        logger.LogWarning(
                            "Giving up on push delivery {DeliveryId} after {Attempts} attempts",
                            delivery.Id, delivery.AttemptCount);
                    }
                    else
                    {
                        var backoff = BackoffSchedule[Math.Min(delivery.AttemptCount - 1, BackoffSchedule.Length - 1)];
                        delivery.NextAttemptAt = DateTimeOffset.UtcNow + backoff;
                    }
                    break;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}