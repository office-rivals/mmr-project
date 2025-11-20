using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record CreateMatchFlagRequest
{
    [Required]
    [StringLength(500, MinimumLength = 1)]
    public required string Reason { get; set; }
}
