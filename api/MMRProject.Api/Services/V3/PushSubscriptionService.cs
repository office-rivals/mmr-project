using Microsoft.EntityFrameworkCore;
using MMRProject.Api.Data;
using MMRProject.Api.Data.Entities.V3;
using MMRProject.Api.DTOs.V3;
using MMRProject.Api.UserContext;

namespace MMRProject.Api.Services.V3;

public interface IPushSubscriptionService
{
    Task UpsertAsync(PushSubscriptionRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(string endpoint, CancellationToken cancellationToken = default);
    Task<bool> HasSubscriptionAsync(CancellationToken cancellationToken = default);
    Task<List<PushSubscription>> ListActiveAsync(string userId, CancellationToken cancellationToken = default);
}

public class PushSubscriptionService(
    ApiDbContext dbContext,
    IUserContextResolver userContextResolver,
    ILogger<PushSubscriptionService> logger) : IPushSubscriptionService
{
    public async Task UpsertAsync(PushSubscriptionRequest request, CancellationToken cancellationToken = default)
    {
        var userId = userContextResolver.GetIdentityUserId();
        var now = DateTimeOffset.UtcNow;

        var existing = await dbContext.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == request.Endpoint, cancellationToken);

        if (existing is null)
        {
            dbContext.PushSubscriptions.Add(new PushSubscription
            {
                UserId = userId,
                Endpoint = request.Endpoint,
                P256DH = request.Keys.P256DH,
                Auth = request.Keys.Auth,
                UserAgent = request.UserAgent,
                LastSeenAt = now,
            });
            logger.LogInformation("Created push subscription for user {UserId}", userId);
        }
        else
        {
            existing.P256DH = request.Keys.P256DH;
            existing.Auth = request.Keys.Auth;
            existing.UserAgent = request.UserAgent;
            existing.LastSeenAt = now;
            existing.DeletedAt = null;
            logger.LogInformation("Refreshed push subscription {SubscriptionId} for user {UserId}", existing.Id, userId);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(string endpoint, CancellationToken cancellationToken = default)
    {
        var userId = userContextResolver.GetIdentityUserId();

        var subscription = await dbContext.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == endpoint, cancellationToken);

        if (subscription is null)
        {
            return;
        }

        // Soft-delete so the dispatcher query filter immediately stops pulling
        // queued deliveries for this endpoint. Hard delete would require a
        // separate purge pass since NotificationDelivery FK is Restrict.
        subscription.DeletedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Deleted push subscription {SubscriptionId} for user {UserId}", subscription.Id, userId);
    }

    public async Task<bool> HasSubscriptionAsync(CancellationToken cancellationToken = default)
    {
        var userId = userContextResolver.GetIdentityUserId();
        return await dbContext.PushSubscriptions.AnyAsync(s => s.UserId == userId, cancellationToken);
    }

    public Task<List<PushSubscription>> ListActiveAsync(string userId, CancellationToken cancellationToken = default)
    {
        return dbContext.PushSubscriptions
            .Where(s => s.UserId == userId && s.DeletedAt == null)
            .ToListAsync(cancellationToken);
    }
}