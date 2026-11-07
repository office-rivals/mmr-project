package mmr

import (
	"github.com/intinig/go-openskill/rating"
	"github.com/intinig/go-openskill/types"
)

// PredictWinV2 returns each team's chance of winning. It uses the library's
// default options, as CalculateNewMMRV2 does.
func PredictWinV2(team1 []PlayerV2, team2 []PlayerV2) (float64, float64) {
	chances := rating.PredictWin([]types.Team{ratingsOf(team1), ratingsOf(team2)}, nil)
	return chances[0], chances[1]
}

func ratingsOf(players []PlayerV2) types.Team {
	ratings := make(types.Team, len(players))
	for i, p := range players {
		ratings[i] = p.Player
	}
	return ratings
}
