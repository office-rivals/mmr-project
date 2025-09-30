using MMRProject.Api.Data.Entities;
using MMRProject.Api.DTOs;

namespace MMRProject.Api.Mappers;

public static class MatchMapper
{
    public static MatchDetailsV2? MapMatchToMatchDetails(Match match)
    {
        if (match.CreatedAt is null)
        {
            return null;
        }
        
        var team1 = MapTeamToMatchTeam(match.TeamOne);
        var team2 = MapTeamToMatchTeam(match.TeamTwo);
        
        if (team1 is null || team2 is null)
        {
            return null;
        }

        return new MatchDetailsV2
        {
            Date = match.CreatedAt.Value,
            Team1 = team1,
            Team2 = team2,
            MMRCalculations = MapMmrCalculationsToMatchMmrCalculationDetails(match.MmrCalculations.FirstOrDefault())
        };
    }

    private static MatchTeamV2? MapTeamToMatchTeam(Team? team)
    {
        if (team?.Score is null || team.PlayerOneId is null || team.PlayerTwoId is null)
        {
            return null;
        }

        return new MatchTeamV2
        {
            Score = (int)team.Score.Value,
            Member1 = team.PlayerOneId.Value,
            Member2 = team.PlayerTwoId.Value
        };
    }
    
    private static MatchMMRCalculationDetails? MapMmrCalculationsToMatchMmrCalculationDetails(MmrCalculation? mmrCalculation)
    {
        if (mmrCalculation is null)
        {
            return null;
        }
        
        if (mmrCalculation.TeamOnePlayerOneMmrDelta is null || mmrCalculation.TeamOnePlayerTwoMmrDelta is null ||
            mmrCalculation.TeamTwoPlayerOneMmrDelta is null || mmrCalculation.TeamTwoPlayerTwoMmrDelta is null)
        {
            return null;
        }

        return new MatchMMRCalculationDetails
        {
            Team1 = new MatchMMRCalculationTeam
            {
                Player1MMRDelta = (int)mmrCalculation.TeamOnePlayerOneMmrDelta.Value,
                Player2MMRDelta = (int)mmrCalculation.TeamOnePlayerTwoMmrDelta.Value
            },
            Team2 = new MatchMMRCalculationTeam
            {
                Player1MMRDelta = (int)mmrCalculation.TeamTwoPlayerOneMmrDelta.Value,
                Player2MMRDelta = (int)mmrCalculation.TeamTwoPlayerTwoMmrDelta.Value
            }
        };
    }
}