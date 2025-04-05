using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record SeasonDto
{
    [Required]
    public required long Id { get; set; }

    public DateTime? CreatedAt { get; set; }
}