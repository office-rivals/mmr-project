using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs;

public record TimeStatisticsEntry
{
    [Required]
    public required int DayOfWeek { get; set; }

    [Required]
    public required int HourOfDay { get; set; }

    [Required]
    public required int Count { get; set; }
}