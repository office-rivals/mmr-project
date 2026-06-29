using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.Configuration;

public class PushOptions
{
    public const string SectionName = "Push";

    [Required] public VapidOptions Vapid { get; init; } = new();

    /// <summary>
    /// Contact mailto: URL embedded in VAPID auth tokens so push services can
    /// reach an operator if abuse is reported. Optional but recommended.
    /// </summary>
    public string? Subject { get; init; }

    /// <summary>
    /// Polling cadence for the dispatch background service.
    /// </summary>
    public TimeSpan DispatchInterval { get; init; } = TimeSpan.FromSeconds(5);

    /// <summary>
    /// Maximum deliveries pulled per dispatch tick. Caps blast radius if a
    /// backlog develops (e.g. after an extended push-service outage).
    /// </summary>
    public int DispatchBatchSize { get; init; } = 50;

    /// <summary>
    /// After this many failed attempts, a delivery is marked <c>Dead</c> and
    /// stops being retried.
    /// </summary>
    public int MaxAttempts { get; init; } = 5;
}

public class VapidOptions
{
    /// <summary>
    /// Base64url-encoded VAPID public key. Safe to ship to the browser.
    /// </summary>
    [Required] public string PublicKey { get; init; } = string.Empty;

    /// <summary>
    /// Base64url-encoded VAPID private key. Treat as a secret — never commit.
    /// </summary>
    [Required] public string PrivateKey { get; init; } = string.Empty;
}