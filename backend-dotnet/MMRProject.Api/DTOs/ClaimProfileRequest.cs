using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record ClaimProfileRequest
{
    [Required]
    public required long UserId { get; set; }
}