using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record UpdateMatchFlagReasonRequest
{
    [Required]
    [StringLength(500, MinimumLength = 1)]
    public required string Reason { get; set; }
}
