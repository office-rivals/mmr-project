using System.ComponentModel.DataAnnotations;
using MMRProject.Api.Data.Entities;

namespace MMRProject.Api.DTOs;

public record UpdateMatchFlagRequest
{
    [Required]
    public required MatchFlagStatus Status { get; set; }

    [StringLength(500)]
    public string? Note { get; set; }
}
