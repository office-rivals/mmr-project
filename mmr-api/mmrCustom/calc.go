package mmrCustom

import (
	"math"
)

// MatchOutcome represents the outcome of a match.
type MatchOutcome int

const (
	Team1Wins MatchOutcome = iota
	Team2Wins
)

// CalculateTeamMMR calculates the MMR of a team by summing the MMR of its players.
func CalculateTeamMMR(team *Team) float64 {
	var totalMMR float64
	for _, player := range team.Players {
		totalMMR += player.MMR
	}
	return totalMMR
}

// UpdateMMR updates the MMR of each player based on the match outcome and the predicted outcome.
func UpdateMMR(team1, team2 *Team, outcome MatchOutcome) {
	team1MMR := CalculateTeamMMR(team1)
	team2MMR := CalculateTeamMMR(team2)

	// Calculate predicted outcome based on MMR difference
	team1Expected := 1 / (1 + math.Pow(10, (team2MMR-team1MMR)/400))
	team2Expected := 1 / (1 + math.Pow(10, (team1MMR-team2MMR)/400))

	const K = 32 // Adjustment factor for MMR update

	// Update player MMRs based on outcome
	var team1Result, team2Result float64
	switch outcome {
	case Team1Wins:
		team1Result = 1.0
		team2Result = 0.0
	case Team2Wins:
		team1Result = 0.0
		team2Result = 1.0
	}

	// TODO: Update player uncertainty

	for _, player := range team1.Players {
		player.MMR += K * (team1Result - team1Expected)
	}

	for _, player := range team2.Players {
		player.MMR += K * (team2Result - team2Expected)
	}
}
