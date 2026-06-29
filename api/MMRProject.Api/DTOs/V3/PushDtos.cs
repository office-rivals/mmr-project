using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record PushSubscriptionKeys
{
    [Required] public required string P256DH { get; init; }
    [Required] public required string Auth { get; init; }
}

public record PushSubscriptionRequest
{
    [Required] public required string Endpoint { get; init; }
    [Required] public required PushSubscriptionKeys Keys { get; init; }
    public string? UserAgent { get; init; }
}

public record PushSubscriptionStatusResponse
{
    [Required] public required bool Subscribed { get; init; }
    public string? Permission { get; init; }
}