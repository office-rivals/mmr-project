using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record LeaguePlayerResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required Guid OrganizationMembershipId { get; init; }
    public string? DisplayName { get; init; }
    public string? Username { get; init; }
    [Required] public required long Mmr { get; init; }
    [Required] public required decimal Mu { get; init; }
    [Required] public required decimal Sigma { get; init; }
    [Required] public required DateTimeOffset CreatedAt { get; init; }
}

public record JoinLeagueRequest;
