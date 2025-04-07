using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;

namespace MMRProject.Api.Mappers;

public static class SeasonMapper
{
    public static SeasonDto ToSeasonDto(this Season season)
    {
        return new SeasonDto
        {
            Id = season.Id,
            CreatedAt = season.CreatedAt
        };
    }
}