using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record UserDetails
{
    [Required]
    public required long UserId { get; set; }

    [Required]
    public required string Name { get; set; }

    public string? DisplayName { get; set; }
}