package mmr

import (
	"github.com/intinig/go-openskill/rating"
	"github.com/intinig/go-openskill/types"
)

func RankingDisplayValue(mu float64, sigma float64) float64 {
	return rating.Ordinal(rating.NewWithOptions(&types.OpenSkillOptions{Mu: &mu, Sigma: &sigma})) * 75
}
