package mmr__test

import (
	"mmr/backend/mmr"
	view "mmr/backend/models"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/intinig/go-openskill/ptr"
	"github.com/intinig/go-openskill/rating"
	"github.com/intinig/go-openskill/types"
)

func TestPreviousSeasonRatingLowerThanDefault(t *testing.T) {
	isPreviousSeasonRating := true
	previousMu := 19.0
	previousSigma := 1.0
	playerRating := view.MMRCalculationPlayerRating{Id: 1, Mu: &previousMu, Sigma: &previousSigma, IsPreviousSeasonRating: &isPreviousSeasonRating}
	newRating := mmr.RatingForPlayer(playerRating)
	defaultRating := mmr.NewDefaultRating()

	assert.Less(t, previousMu, defaultRating.Mu)
	assert.NotEqual(t, defaultRating.Sigma, previousSigma)
	assert.Equal(t, 23.0, newRating.Mu)
	assert.Equal(t, defaultRating.Sigma, newRating.Sigma)
}

func TestPreviousSeasonRatingHigherThanDefault(t *testing.T) {
	isPreviousSeasonRating := true
	previousMu := 31.0
	previousSigma := 1.0
	playerRating := view.MMRCalculationPlayerRating{Id: 1, Mu: &previousMu, Sigma: &previousSigma, IsPreviousSeasonRating: &isPreviousSeasonRating}
	newRating := mmr.RatingForPlayer(playerRating)
	defaultRating := mmr.NewDefaultRating()

	assert.Greater(t, previousMu, defaultRating.Mu)
	assert.NotEqual(t, defaultRating.Sigma, previousSigma)
	assert.Equal(t, 27.0, newRating.Mu)
	assert.Equal(t, defaultRating.Sigma, newRating.Sigma)
}

func TestRatingForPlayer(t *testing.T) {
	isPreviousSeasonRating := false
	mu := 22.0
	sigma := 2.0
	playerRating := view.MMRCalculationPlayerRating{Id: 1, Mu: &mu, Sigma: &sigma, IsPreviousSeasonRating: &isPreviousSeasonRating}
	newRating := mmr.RatingForPlayer(playerRating)

	assert.Equal(t, mu, newRating.Mu)
	assert.Equal(t, sigma, newRating.Sigma)
}

func TestRatingForPlayerPreviousSeasonRatingNil(t *testing.T) {
	mu := 22.0
	sigma := 2.0
	playerRating := view.MMRCalculationPlayerRating{Id: 1, Mu: &mu, Sigma: &sigma, IsPreviousSeasonRating: nil}
	newRating := mmr.RatingForPlayer(playerRating)

	assert.Equal(t, mu, newRating.Mu)
	assert.Equal(t, sigma, newRating.Sigma)
}

func TestGenerateTeams(t *testing.T) {
	// Create players with different skill levels
	mathias := rating.NewWithOptions(&types.OpenSkillOptions{
		Mu:    ptr.Float64(20.0),
		Sigma: ptr.Float64(5.0),
	})
	madsbo := rating.NewWithOptions(&types.OpenSkillOptions{
		Mu:    ptr.Float64(25.0),
		Sigma: ptr.Float64(5.0),
	})
	smed := rating.NewWithOptions(&types.OpenSkillOptions{
		Mu:    ptr.Float64(30.0),
		Sigma: ptr.Float64(5.0),
	})
	bjarke := rating.NewWithOptions(&types.OpenSkillOptions{
		Mu:    ptr.Float64(35.0),
		Sigma: ptr.Float64(5.0),
	})

	// Create players
	player1 := &mmr.PlayerV2{Id: 1, Player: mathias}
	player2 := &mmr.PlayerV2{Id: 2, Player: smed}
	player3 := &mmr.PlayerV2{Id: 3, Player: madsbo}
	player4 := &mmr.PlayerV2{Id: 4, Player: bjarke}

	// Generate balanced teams
	team1, team2 := mmr.GenerateTeams(player1, player2, player3, player4)

	// Get win probability for the generated teams
	probs := rating.PredictWin([]types.Team{
		{team1.Players[0].Player, team1.Players[1].Player},
		{team2.Players[0].Player, team2.Players[1].Player},
	}, &types.OpenSkillOptions{})

	// Check if teams are balanced (win probability should be close to 50%)
	assert.InDelta(t, 0.5, probs[0], 0.15, "Teams should be fairly balanced (win probability close to 50%)")

	// Verify both teams have exactly 2 players
	assert.Equal(t, 2, len(team1.Players), "Team 1 should have 2 players")
	assert.Equal(t, 2, len(team2.Players), "Team 2 should have 2 players")

	// Verify all players are used
	allPlayers := make(map[int64]bool)
	for _, p := range team1.Players {
		allPlayers[p.Id] = true
	}
	for _, p := range team2.Players {
		allPlayers[p.Id] = true
	}
	assert.Equal(t, 4, len(allPlayers), "All players should be assigned to teams")

	// Verify teams are different
	team1Players := make(map[int64]bool)
	for _, p := range team1.Players {
		team1Players[p.Id] = true
	}
	for _, p := range team2.Players {
		assert.False(t, team1Players[p.Id], "Teams should not share players")
	}
}
