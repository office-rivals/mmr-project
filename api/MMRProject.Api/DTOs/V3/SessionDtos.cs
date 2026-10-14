using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities.V3;

namespace MMRProject.Api.DTOs.V3;

public record MeResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string IdentityUserId { get; init; }
    [Required] public required string Email { get; init; }
    public string? Username { get; init; }
    public string? DisplayName { get; init; }
    [Required] public required List<MeOrganizationResponse> Organizations { get; init; }
}

public record MeOrganizationResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    [Required] public required OrganizationRole Role { get; init; }
    [Required] public required List<MeLeagueResponse> Leagues { get; init; }
}

public record MeLeagueResponse
{
    [Required] public required Guid Id { get; init; }
    [Required] public required string Name { get; init; }
    [Required] public required string Slug { get; init; }
    [Required] public required int TeamSize { get; init; }
    public int? WinningScore { get; init; }
    [Required] public required Guid LeaguePlayerId { get; init; }
}

// Counts that drive "needs attention" badges in the nav. Extensible: future
// badge kinds (pending invites, queue alerts, ...) become sibling properties.
public record BadgesResponse
{
    [Required] public required OpenMatchFlagSummary OpenMatchFlags { get; init; }
}

public record OpenMatchFlagSummary
{
    [Required] public required int Total { get; init; }

    // Keyed by organization id / league id (Guids serialize to their string
    // form), so the client can look counts up against any nav element.
    [Required] public required Dictionary<Guid, int> ByOrganization { get; init; }
    [Required] public required Dictionary<Guid, int> ByLeague { get; init; }
}
