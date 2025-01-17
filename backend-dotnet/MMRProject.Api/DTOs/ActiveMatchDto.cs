using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record ActiveMatchDto
{
    [Required]
    public required Guid Id { get; set; }

    [Required]
    public required DateTimeOffset CreatedAt { get; set; }

    [Required]
    public required ActiveMatchTeamDto Team1 { get; set; }

    [Required]
    public required ActiveMatchTeamDto Team2 { get; set; }
}

public record ActiveMatchTeamDto
{
    [Required]
    public required IEnumerable<long> PlayerIds { get; set; }
}