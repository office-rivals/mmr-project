using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record CreateMatchFlagRequest
{
    [Range(1, long.MaxValue)]
    public required long MatchId { get; set; }

    [Required]
    [StringLength(500, MinimumLength = 1)]
    public required string Reason { get; set; }
}
