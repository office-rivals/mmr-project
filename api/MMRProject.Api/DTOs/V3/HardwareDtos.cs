using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record HardwareHeartbeatRequest
{
    [Required]
    [StringLength(64, MinimumLength = 1)]
    public required string HardwareId { get; init; }

    [Required]
    public Guid LeagueId { get; init; }

    [Required]
    [StringLength(45, MinimumLength = 1)]
    public required string LocalIpAddress { get; init; }
}

public record HardwareResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string HardwareId { get; init; }
    [Required] public required Guid OrganizationId { get; init; }
    [Required] public required Guid LeagueId { get; init; }
    [Required] public required string LocalIpAddress { get; init; }
    [Required] public required DateTimeOffset LastSeenAt { get; init; }
    [Required] public required bool IsOnline { get; init; }
}
