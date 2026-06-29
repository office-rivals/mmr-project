namespace MMRProject.Api.Services.V3;

/// <summary>
/// Payload that the browser service worker consumes via
/// <c>self.registration.showNotification(title, { ... })</c>. Keep the JSON
/// representation below 4 KB (the Web Push payload limit).
/// </summary>
public record NotificationPayload(
    string Title,
    string Body,
    string Url,
    string Tag);

public interface INotificationQueue
{
    Task EnqueueForUserAsync(string userId, NotificationPayload payload, CancellationToken cancellationToken = default);
}