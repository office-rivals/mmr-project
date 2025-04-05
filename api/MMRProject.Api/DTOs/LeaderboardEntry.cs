using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record LeaderboardEntry
{
    [Required]
    public required long UserId { get; set; }

    [Required]
    public required string Name { get; set; }

    public long? MMR { get; set; }

    [Required]
    public int Wins { get; set; }

    [Required]
    public int Loses { get; set; }

    [Required]
    public int WinningStreak { get; set; }

    [Required]
    public int LosingStreak { get; set; }
}