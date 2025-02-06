using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;

namespace MMRProject.Api.Mappers;

public static class ActiveMatchMapper
{
    public static ActiveMatchDto ToActiveMatchDto(this ActiveMatch activeMatch)
    {
        return new ActiveMatchDto
        {
            Id = activeMatch.Id,
            CreatedAt = activeMatch.CreatedAt,
            Team1 = new ActiveMatchTeamDto
            {
                PlayerIds = new List<long>
                {
                    activeMatch.TeamOneUserOneId,
                    activeMatch.TeamOneUserTwoId
                }
            },
            Team2 = new ActiveMatchTeamDto
            {
                PlayerIds = new List<long>
                {
                    activeMatch.TeamTwoUserOneId,
                    activeMatch.TeamTwoUserTwoId
                }
            }
        };
    }
}