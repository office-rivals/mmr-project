package mmr

import (
	"github.com/intinig/go-openskill/rating"
	"github.com/intinig/go-openskill/types"
)

// teamPair represents a possible combination of two teams
type teamPair struct {
	team1 TeamV2
	team2 TeamV2
}

func generateTeamCombinations(p1, p2, p3, p4 *PlayerV2) []teamPair {
	return []teamPair{
		{ // 1,2 vs 3,4
			TeamV2{Players: []PlayerV2{*p1, *p2}},
			TeamV2{Players: []PlayerV2{*p3, *p4}},
		},
		{ // 1,3 vs 2,4
			TeamV2{Players: []PlayerV2{*p1, *p3}},
			TeamV2{Players: []PlayerV2{*p2, *p4}},
		},
		{ // 1,4 vs 2,3
			TeamV2{Players: []PlayerV2{*p1, *p4}},
			TeamV2{Players: []PlayerV2{*p2, *p3}},
		},
	}
}

func calculateWinProbability(team1, team2 TeamV2) float64 {
	probs := rating.PredictWin([]types.Team{
		{team1.Players[0].Player, team1.Players[1].Player},
		{team2.Players[0].Player, team2.Players[1].Player},
	}, &types.OpenSkillOptions{})
	return probs[0]
}

// GenerateTeams creates the most balanced teams possible from 4 players.
// It tries all possible team combinations and returns the one where both teams
// have the closest to 50% chance of winning.
func GenerateTeams(player1 *PlayerV2, player2 *PlayerV2, player3 *PlayerV2, player4 *PlayerV2) (TeamV2, TeamV2) {
	combinations := generateTeamCombinations(player1, player2, player3, player4)

	mostBalancedTeams := combinations[0] // Default to first combination
	smallestDiff := 1.0                  // Maximum possible difference from 50%

	// Find the most balanced teams (closest to 50% win probability)
	for _, combo := range combinations {
		winProb := calculateWinProbability(combo.team1, combo.team2)
		diff := abs(winProb - 0.5)

		if diff < smallestDiff {
			smallestDiff = diff
			mostBalancedTeams = combo
		}
	}

	return mostBalancedTeams.team1, mostBalancedTeams.team2
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
