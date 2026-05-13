package mmr

import (
	"github.com/intinig/go-openskill/ptr"
	"github.com/intinig/go-openskill/rating"
	"github.com/intinig/go-openskill/types"
	view "mmr/backend/models"
)

func CreateNewPlayer(initials string, playerRating types.Rating) Player {
	return Player{
		Initials: initials,
		Player:   playerRating,
	}
}

func CalculateNewMMR(team1 *Team, team2 *Team) (Team, Team) {

	ratingResults := rating.Rate([]types.Team{
		{team1.Players[0].Player, team1.Players[1].Player},
		{team2.Players[0].Player, team2.Players[1].Player},
	}, &types.OpenSkillOptions{
		Score: []int{int(team1.Score), int(team2.Score)}, // it uses these scores to determine the winner
	})

	team1.Players[0].Player = ratingResults[0][0]
	team1.Players[1].Player = ratingResults[0][1]
	team2.Players[0].Player = ratingResults[1][0]
	team2.Players[1].Player = ratingResults[1][1]

	return *team1, *team2
}

func CalculateNewMMRV2(team1 *TeamV2, team2 *TeamV2) (TeamV2, TeamV2) {
	team1Ratings := make(types.Team, len(team1.Players))
	for i, p := range team1.Players {
		team1Ratings[i] = p.Player
	}
	team2Ratings := make(types.Team, len(team2.Players))
	for i, p := range team2.Players {
		team2Ratings[i] = p.Player
	}

	ratingResults := rating.Rate([]types.Team{team1Ratings, team2Ratings}, &types.OpenSkillOptions{
		Score: []int{int(team1.Score), int(team2.Score)}, // it uses these scores to determine the winner
	})

	for i := range team1.Players {
		team1.Players[i].Player = ratingResults[0][i]
	}
	for i := range team2.Players {
		team2.Players[i].Player = ratingResults[1][i]
	}

	return *team1, *team2
}

func NewDefaultRating() types.Rating {
	// Use the New function to get a Rating with default options
	// TODO: Allow multiple options via "algorithm" field in the request
	return rating.NewWithOptions(&types.OpenSkillOptions{Sigma: ptr.Float64(5)})
}

func RatingForPlayer(playerRating view.MMRCalculationPlayerRating) types.Rating {
	if playerRating.IsPreviousSeasonRating != nil && *playerRating.IsPreviousSeasonRating {
		// Use the previous season's rating as basis for the new rating
		defaultRating := NewDefaultRating()

		if playerRating.Mu != nil {
			muDiff := *playerRating.Mu - defaultRating.Mu
			addedMu := muDiff / 3
			defaultRating.Mu += addedMu
		}

		return defaultRating
	}

	// Create Rating with provided Mu and Sigma
	return rating.NewWithOptions(
		&types.OpenSkillOptions{
			Mu:    playerRating.Mu,
			Sigma: playerRating.Sigma,
		},
	)
}
