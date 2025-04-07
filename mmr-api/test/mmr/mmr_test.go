package mmr__test

import (
	"github.com/stretchr/testify/assert"
	"mmr/backend/mmr"
	view "mmr/backend/models"
	"testing"
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
