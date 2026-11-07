package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"mmr/backend/controllers"
	"mmr/backend/mmr"
	view "mmr/backend/models"
	"mmr/backend/server"
)

func setupPredictionRouter() *gin.Engine {
	router := setupRouter()
	calculationController := controllers.CalculationController{}
	router.POST("/v1/mmr-calculation", calculationController.SubmitMMRCalculation)
	router.POST("/v1/mmr-calculation/predict", calculationController.PredictMatch)
	return router
}

func predict(t *testing.T, router *gin.Engine, request view.MMRPredictionRequest) view.MMRPredictionResponse {
	t.Helper()
	rr := postRequest(router, "/v1/mmr-calculation/predict", request)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

	var response view.MMRPredictionResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &response))
	return response
}

func calculate(t *testing.T, router *gin.Engine, request view.MMRCalculationRequest) map[int64]int {
	t.Helper()
	rr := postRequest(router, "/v1/mmr-calculation", request)
	require.Equal(t, http.StatusOK, rr.Code, rr.Body.String())

	var response view.MMRCalculationResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &response))
	mmrById := map[int64]int{}
	for _, p := range append(response.Team1.Players, response.Team2.Players...) {
		mmrById[p.Id] = p.MMR
	}
	return mmrById
}

func boolPtr(b bool) *bool { return &b }

// A regular player, one carrying last season's rating and one with no rating
// yet on each side, so every way of building a rating is exercised.
func mixedPredictionRequest() view.MMRPredictionRequest {
	return view.MMRPredictionRequest{
		Team1: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{
			{Id: 1, Mu: float64Ptr(31.2), Sigma: float64Ptr(2.1), IsPreviousSeasonRating: boolPtr(false)},
			{Id: 2, Mu: float64Ptr(34.0), Sigma: float64Ptr(1.8), IsPreviousSeasonRating: boolPtr(true)},
			{Id: 3},
		}},
		Team2: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{
			{Id: 4, Mu: float64Ptr(26.4), Sigma: float64Ptr(3.9), IsPreviousSeasonRating: boolPtr(false)},
			{Id: 5, Mu: float64Ptr(19.5), Sigma: float64Ptr(2.5), IsPreviousSeasonRating: boolPtr(true)},
			{Id: 6, Mu: float64Ptr(25.0), Sigma: float64Ptr(8.333), IsPreviousSeasonRating: boolPtr(true)},
		}},
	}
}

func withScores(request view.MMRPredictionRequest, team1Score int, team2Score int) view.MMRCalculationRequest {
	return view.MMRCalculationRequest{
		Team1: view.MMRCalculationTeam{Score: &team1Score, Players: request.Team1.Players},
		Team2: view.MMRCalculationTeam{Score: &team2Score, Players: request.Team2.Players},
	}
}

// The prediction must match what submitting either result would do, whatever
// the winning margin.
func TestPredictMatchAgreesWithCalculation(t *testing.T) {
	router := setupPredictionRouter()
	request := mixedPredictionRequest()

	prediction := predict(t, router, request)

	for _, scores := range [][2]int{{10, 0}, {10, 9}, {1, 0}} {
		team1Wins := calculate(t, router, withScores(request, scores[0], scores[1]))
		team2Wins := calculate(t, router, withScores(request, scores[1], scores[0]))

		for _, p := range prediction.Team1.Players {
			assert.Equal(t, team1Wins[p.Id], p.MMRIfWin, "player %d if team 1 wins %v", p.Id, scores)
			assert.Equal(t, team2Wins[p.Id], p.MMRIfLose, "player %d if team 2 wins %v", p.Id, scores)
		}
		for _, p := range prediction.Team2.Players {
			assert.Equal(t, team2Wins[p.Id], p.MMRIfWin, "player %d if team 2 wins %v", p.Id, scores)
			assert.Equal(t, team1Wins[p.Id], p.MMRIfLose, "player %d if team 1 wins %v", p.Id, scores)
		}
	}
}

func TestPredictMatchStartsFromTheRatingTheCalculationUses(t *testing.T) {
	router := setupPredictionRouter()
	request := mixedPredictionRequest()

	prediction := predict(t, router, request)

	players := append(prediction.Team1.Players, prediction.Team2.Players...)
	inputs := append(request.Team1.Players, request.Team2.Players...)
	for i, p := range players {
		input := inputs[i]
		var start float64
		switch {
		case input.Mu == nil:
			start = mmr.RankingDisplayValue(mmr.NewDefaultRating().Mu, mmr.NewDefaultRating().Sigma)
		default:
			r := mmr.RatingForPlayer(input)
			start = mmr.RankingDisplayValue(r.Mu, r.Sigma)
		}
		assert.Equal(t, input.Id, p.Id)
		assert.Equal(t, int(start), p.MMR, "player %d", p.Id)
		assert.Greater(t, p.MMRIfWin, p.MMR, "player %d gains on a win", p.Id)
		assert.Less(t, p.MMRIfLose, p.MMR, "player %d drops on a loss", p.Id)
	}

	// Last season's rating is reset, not carried over as is.
	reset := mmr.RatingForPlayer(request.Team1.Players[1])
	raw := mmr.RankingDisplayValue(*request.Team1.Players[1].Mu, *request.Team1.Players[1].Sigma)
	assert.Equal(t, int(mmr.RankingDisplayValue(reset.Mu, reset.Sigma)), prediction.Team1.Players[1].MMR)
	assert.NotEqual(t, int(raw), prediction.Team1.Players[1].MMR)
}

func TestPredictMatchWinChance(t *testing.T) {
	router := setupPredictionRouter()

	prediction := predict(t, router, mixedPredictionRequest())

	assert.InDelta(t, 1.0, prediction.Team1.WinChance+prediction.Team2.WinChance, 1e-9)
	assert.Greater(t, prediction.Team1.WinChance, 0.5, "the stronger team is favoured")

	even := predict(t, router, view.MMRPredictionRequest{
		Team1: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{{Id: 1}, {Id: 2}}},
		Team2: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{{Id: 3}, {Id: 4}}},
	})
	assert.InDelta(t, 0.5, even.Team1.WinChance, 1e-9)
	assert.InDelta(t, 0.5, even.Team2.WinChance, 1e-9)
}

func TestPredictMatchHandlesEveryTeamSize(t *testing.T) {
	router := setupPredictionRouter()

	for size := 1; size <= 4; size++ {
		request := view.MMRPredictionRequest{}
		for i := 0; i < size; i++ {
			request.Team1.Players = append(request.Team1.Players, view.MMRCalculationPlayerRating{Id: int64(i + 1)})
			request.Team2.Players = append(request.Team2.Players, view.MMRCalculationPlayerRating{Id: int64(size + i + 1)})
		}

		prediction := predict(t, router, request)

		assert.Len(t, prediction.Team1.Players, size)
		assert.Len(t, prediction.Team2.Players, size)
	}
}

func TestPredictMatchRejectsInvalidTeams(t *testing.T) {
	router := setupPredictionRouter()
	player := func(id int64) view.MMRCalculationPlayerRating { return view.MMRCalculationPlayerRating{Id: id} }

	cases := map[string]view.MMRPredictionRequest{
		"mismatched sizes": {
			Team1: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{player(1)}},
			Team2: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{player(2), player(3)}},
		},
		"empty team": {
			Team1: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{}},
			Team2: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{player(2)}},
		},
		"duplicate player": {
			Team1: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{player(1)}},
			Team2: view.MMRPredictionTeam{Players: []view.MMRCalculationPlayerRating{player(1)}},
		},
	}

	for name, request := range cases {
		rr := postRequest(router, "/v1/mmr-calculation/predict", request)
		assert.Equal(t, http.StatusBadRequest, rr.Code, name)
	}
}

func TestPredictMatchRouteRequiresApiKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("ADMIN_SECRET", "test-secret")
	router := server.NewRouter()
	body, err := json.Marshal(mixedPredictionRequest())
	require.NoError(t, err)

	send := func(apiKey string) int {
		req, _ := http.NewRequest("POST", "/api/v1/mmr-calculation/predict", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		if apiKey != "" {
			req.Header.Set("X-API-KEY", apiKey)
		}
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		return rr.Code
	}

	assert.Equal(t, http.StatusUnauthorized, send(""))
	assert.Equal(t, http.StatusOK, send("test-secret"))
}
