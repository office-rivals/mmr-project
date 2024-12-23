namespace MMRProject.Api.DTOs;

public record TimeStatisticsEntry
{
    public required int DayOfWeek { get; set; }
    public required int HourOfDay { get; set; }
    public required int Count { get; set; }
}