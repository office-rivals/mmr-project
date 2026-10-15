package controllers

import (
	"fmt"
	"log/slog"
	"mmr/backend/mmr"
	view "mmr/backend/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/intinig/go-openskill/types"
)

type CalculationController struct{}

// SubmitMMRCalculation godoc
//
//	@Summary		Submit an MMR calculation request
//	@Description	Submit two teams' details for MMR calculation
//	@Tags 			Calculation
//	@Accept			json
//	@Produce		json
//	@Param			request	body		view.MMRCalculationRequest	true	"MMR Calculation Request"
//	@Success		200		{object}	view.MMRCalculationResponse	"MMR calculation result"
//	@Router			/v1/mmr-calculation [post]
func (m CalculationController) SubmitMMRCalculation(c *gin.Context) {
	var req view.MMRCalculationRequest
	err := c.ShouldBindJSON(&req)

	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	team1, team2, err := m.calculateMatch(req, nil)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	response := m.GenerateResponse(req, team1, team2)

	slog.InfoContext(c.Request.Context(), "mmr calculation",
		"request", req,
		"response", response,
	)

	c.JSON(http.StatusOK, response)
}

// SubmitMMRCalculationsBatch godoc
//
//	@Summary		Submit multiple MMR calculation requests
//	@Description	Submit multiple MMR calculation requests
//	@Tags 			Calculation
//	@Accept			json
//	@Produce		json
//	@Param			request	body		[]view.MMRCalculationRequest	true	"MMR Calculation Requests"
//	@Success		200		{object}	[]view.MMRCalculationResponse	"MMR calculation results"
//	@Router			/v1/mmr-calculation/batch [post]
func (m CalculationController) SubmitMMRCalculationsBatch(c *gin.Context) {
	var req []view.MMRCalculationRequest
	err := c.ShouldBindJSON(&req)

	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	responses := make([]view.MMRCalculationResponse, len(req))
	playerMap := make(PlayerMMRResultMap)
	for i, r := range req {
		team1, team2, err := m.calculateMatch(r, playerMap)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error(), "batchIndex": i})
			return
		}
		response := m.GenerateResponse(r, team1, team2)
		responses[i] = response

		slog.InfoContext(c.Request.Context(), "mmr calculation",
			"batch.index", i,
			"request", r,
			"response", response,
		)

		for _, player := range team1.Players {
			playerMap[player.Id] = player.Player
		}
		for _, player := range team2.Players {
			playerMap[player.Id] = player.Player
		}
	}

	// Respond with the updated team data
	c.JSON(http.StatusOK, responses)
}

// PredictMatch godoc
//
//	@Summary		Predict an MMR calculation before the match is played
//	@Description	Returns each team's chance of winning and each player's MMR if their team wins or loses, rated exactly as a submitted result would be
//	@Tags 			Calculation
//	@Accept			json
//	@Produce		json
//	@Param			request	body		view.MMRPredictionRequest	true	"MMR Prediction Request"
//	@Success		200		{object}	view.MMRPredictionResponse	"MMR prediction result"
//	@Router			/v1/mmr-calculation/predict [post]
func (m CalculationController) PredictMatch(c *gin.Context) {
	var req view.MMRPredictionRequest
	err := c.ShouldBindJSON(&req)

	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := m.predictMatch(req)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	slog.InfoContext(c.Request.Context(), "mmr prediction",
		"request", req,
		"response", response,
	)

	c.JSON(http.StatusOK, response)
}

func (m CalculationController) predictMatch(req view.MMRPredictionRequest) (view.MMRPredictionResponse, error) {
	if err := ensureTeams(req.Team1.Players, req.Team2.Players); err != nil {
		return view.MMRPredictionResponse{}, err
	}

	team1 := m.buildTeamPlayers(req.Team1.Players, nil)
	team2 := m.buildTeamPlayers(req.Team2.Players, nil)
	team1Chance, team2Chance := mmr.PredictWinV2(team1, team2)

	team1Won, team2Lost, err := m.calculateOutcome(req, true)
	if err != nil {
		return view.MMRPredictionResponse{}, err
	}
	team1Lost, team2Won, err := m.calculateOutcome(req, false)
	if err != nil {
		return view.MMRPredictionResponse{}, err
	}

	return view.MMRPredictionResponse{
		Team1: createTeamPrediction(team1Chance, team1, team1Won, team1Lost),
		Team2: createTeamPrediction(team2Chance, team2, team2Won, team2Lost),
	}, nil
}

// calculateOutcome runs the calculation a submitted result runs. OpenSkill uses
// the scores only to rank the teams, so 1–0 stands in for any winning score.
func (m CalculationController) calculateOutcome(req view.MMRPredictionRequest, team1Wins bool) (mmr.TeamV2, mmr.TeamV2, error) {
	team1Score, team2Score := 0, 1
	if team1Wins {
		team1Score, team2Score = 1, 0
	}
	return m.calculateMatch(view.MMRCalculationRequest{
		Team1: view.MMRCalculationTeam{Score: &team1Score, Players: req.Team1.Players},
		Team2: view.MMRCalculationTeam{Score: &team2Score, Players: req.Team2.Players},
	}, nil)
}

func createTeamPrediction(winChance float64, before []mmr.PlayerV2, won mmr.TeamV2, lost mmr.TeamV2) view.MMRTeamPrediction {
	players := make([]view.PlayerMMRPrediction, len(before))
	for i, player := range before {
		players[i] = view.PlayerMMRPrediction{
			Id:        player.Id,
			MMR:       displayMMR(player.Player),
			MMRIfWin:  displayMMR(won.Players[i].Player),
			MMRIfLose: displayMMR(lost.Players[i].Player),
		}
	}
	return view.MMRTeamPrediction{WinChance: winChance, Players: players}
}

func displayMMR(r types.Rating) int {
	return int(mmr.RankingDisplayValue(r.Mu, r.Sigma))
}

func (m CalculationController) GenerateResponse(r view.MMRCalculationRequest, team1 mmr.TeamV2, team2 mmr.TeamV2) view.MMRCalculationResponse {
	response := view.MMRCalculationResponse{
		Team1: m.createTeamResult(*r.Team1.Score, team1),
		Team2: m.createTeamResult(*r.Team2.Score, team2),
	}
	return response
}

type PlayerMMRResultMap map[int64]types.Rating

func (m CalculationController) calculateMatch(req view.MMRCalculationRequest, playerMap PlayerMMRResultMap) (mmr.TeamV2, mmr.TeamV2, error) {
	if err := ensurePlayers(req); err != nil {
		return mmr.TeamV2{}, mmr.TeamV2{}, err
	}

	team1 := mmr.TeamV2{
		Players: m.buildTeamPlayers(req.Team1.Players, playerMap),
		Score:   int16(*req.Team1.Score),
	}
	team2 := mmr.TeamV2{
		Players: m.buildTeamPlayers(req.Team2.Players, playerMap),
		Score:   int16(*req.Team2.Score),
	}

	t1, t2 := mmr.CalculateNewMMRV2(&team1, &team2)
	return t1, t2, nil
}

func (m CalculationController) buildTeamPlayers(ratings []view.MMRCalculationPlayerRating, playerMap PlayerMMRResultMap) []mmr.PlayerV2 {
	players := make([]mmr.PlayerV2, len(ratings))
	for i, r := range ratings {
		players[i] = m.createPlayer(r, playerMap)
	}
	return players
}

func ensurePlayers(req view.MMRCalculationRequest) error {
	return ensureTeams(req.Team1.Players, req.Team2.Players)
}

func ensureTeams(team1 []view.MMRCalculationPlayerRating, team2 []view.MMRCalculationPlayerRating) error {
	if len(team1) == 0 || len(team2) == 0 {
		return fmt.Errorf("each team must have at least one player")
	}
	if len(team1) != len(team2) {
		return fmt.Errorf("both teams must have the same number of players")
	}

	playerMap := make(map[int64]struct{})
	for _, team := range [][]view.MMRCalculationPlayerRating{team1, team2} {
		for _, player := range team {
			if _, exists := playerMap[player.Id]; exists {
				return fmt.Errorf("player ID %d is duplicated", player.Id)
			}
			playerMap[player.Id] = struct{}{}
		}
	}

	return nil
}

// Creates a player instance from the given MMRCalculationPlayerRating
func (m CalculationController) createPlayer(playerRating view.MMRCalculationPlayerRating, playerMap PlayerMMRResultMap) mmr.PlayerV2 {
	if player, exists := playerMap[playerRating.Id]; exists {
		return mmr.PlayerV2{
			Id:     playerRating.Id,
			Player: player,
		}
	}

	var internalRating types.Rating

	// Check if Mu and Sigma are provided; use defaults if they are nil
	if playerRating.Mu != nil && playerRating.Sigma != nil {
		internalRating = mmr.RatingForPlayer(playerRating)
	} else {
		internalRating = mmr.NewDefaultRating()
	}

	return mmr.PlayerV2{
		Id:     playerRating.Id,
		Player: internalRating,
	}
}

// createTeamResult constructs the MMRTeamResult from score and calculated team data
func (m CalculationController) createTeamResult(score int, team mmr.TeamV2) view.MMRTeamResult {
	playersResults := make([]view.PlayerMMRResult, len(team.Players))

	for i, player := range team.Players {
		// Directly use the Mu, Sigma values from the team players
		playersResults[i] = view.PlayerMMRResult{
			Id:    player.Id, // Using Initials as the unique identifier
			Mu:    player.Player.Mu,
			Sigma: player.Player.Sigma,
			MMR:   displayMMR(player.Player),
		}
	}

	return view.MMRTeamResult{
		Score:   &score,
		Players: playersResults,
	}
}
