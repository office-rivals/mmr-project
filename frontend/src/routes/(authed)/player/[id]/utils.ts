import type {
  MatchDetailsV2,
  MatchMMRCalculationDetails,
  MatchTeamV2,
} from '$api';

export const movePlayerToMember1 = (
  match: MatchDetailsV2,
  playerId: number
): MatchDetailsV2 => {
  // Player is already member 1
  if (match.team1.member1 === playerId) {
    return match;
  }

  if (match.team1.member2 === playerId) {
    return {
      ...match,
      team1: flipMembersOfTeam(match.team1),
      mmrCalculations: flipMembersOfTeamInMMRCalculation(
        match.mmrCalculations,
        'team1'
      ),
    };
  }

  if (match.team2.member1 === playerId) {
    return {
      ...match,
      team1: match.team2,
      team2: match.team1,
      mmrCalculations: flipTeamsInMMRCalculation(match.mmrCalculations),
    };
  }

  return {
    ...match,
    team1: flipMembersOfTeam(match.team2),
    team2: match.team1,
    mmrCalculations: flipMembersOfTeamInMMRCalculation(
      flipTeamsInMMRCalculation(match.mmrCalculations),
      'team1'
    ),
  };
};

const flipMembersOfTeam = (team: MatchTeamV2) => {
  return {
    ...team,
    member1: team.member2,
    member2: team.member1,
  };
};

const flipMembersOfTeamInMMRCalculation = (
  mmrCalculations: MatchMMRCalculationDetails | undefined,
  team: 'team1' | 'team2'
): MatchMMRCalculationDetails | undefined => {
  if (mmrCalculations == null) {
    return mmrCalculations;
  }
  return {
    ...mmrCalculations,
    [team]: {
      player1MMRDelta: mmrCalculations[team].player2MMRDelta,
      player2MMRDelta: mmrCalculations[team].player1MMRDelta,
    },
  };
};

const flipTeamsInMMRCalculation = (
  mmrCalculations: MatchMMRCalculationDetails | undefined
): MatchMMRCalculationDetails | undefined => {
  if (mmrCalculations == null) {
    return mmrCalculations;
  }
  return {
    team1: mmrCalculations.team2,
    team2: mmrCalculations.team1,
  };
};
