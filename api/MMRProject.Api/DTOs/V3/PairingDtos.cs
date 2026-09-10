using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record PairingCodeResponse
{
    [Required] public required IReadOnlyList<PairingColor> Colors { get; init; }
    [Required] public required DateTimeOffset ExpiresAt { get; init; }
}

public record RfidTagResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string RfidUid { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record PairingSubmitRequest
{
    [Required] public required string RfidUid { get; init; }
    [Required] public required IReadOnlyList<PairingColor> Colors { get; init; }
}

public record PairingSubmitResponse
{
    [Required] public required bool Success { get; init; }
}
