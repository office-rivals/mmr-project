using System.ComponentModel.DataAnnotations;

namespace MMRProject.Api.DTOs.V3;

public record TimeDistributionResponse
{
    [Required] public required List<TimeDistributionEntry> Entries { get; init; }
}

public record TimeDistributionEntry
{
    [Required] public required int DayOfWeek { get; init; }
    [Required] public required int HourOfDay { get; init; }
    [Required] public required int Count { get; init; }
}
