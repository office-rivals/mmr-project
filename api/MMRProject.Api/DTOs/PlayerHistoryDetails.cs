using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record PlayerHistoryDetails
{
    [Required]
    public required long UserId { get; set; }

    [Required]
    public required string Name { get; set; }

    [Required]
    public required DateTimeOffset Date { get; set; }

    [Required]
    public required long MMR { get; set; }
}