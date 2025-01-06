package controllers

import (
	"fmt"
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

	ensurePlayers(c, req)

	team1, team2 := m.calculateMatch(c, req, nil)
	response := m.GenerateResponse(req, team1, team2)

	// Respond with the updated team data
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
		team1, team2 := m.calculateMatch(c, r, playerMap)
		response := m.GenerateResponse(r, team1, team2)
		responses[i] = response
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

func (m CalculationController) GenerateResponse(r view.MMRCalculationRequest, team1 mmr.TeamV2, team2 mmr.TeamV2) view.MMRCalculationResponse {
	response := view.MMRCalculationResponse{
		Team1: m.createTeamResult(*r.Team1.Score, team1),
		Team2: m.createTeamResult(*r.Team2.Score, team2),
	}
	return response
}

type PlayerMMRResultMap map[int64]types.Rating

func (m CalculationController) calculateMatch(c *gin.Context, req view.MMRCalculationRequest, playerMap PlayerMMRResultMap) (mmr.TeamV2, mmr.TeamV2) {
	ensurePlayers(c, req)

	// Create players for Team 1
	player1 := m.createPlayer(req.Team1.Players[0], playerMap)
	player2 := m.createPlayer(req.Team1.Players[1], playerMap)

	team1 := mmr.TeamV2{
		Players: []mmr.PlayerV2{player1, player2},
		Score:   int16(*req.Team1.Score),
	}

	// Create players for Team 2
	player3 := m.createPlayer(req.Team2.Players[0], playerMap)
	player4 := m.createPlayer(req.Team2.Players[1], playerMap)

	team2 := mmr.TeamV2{
		Players: []mmr.PlayerV2{player3, player4},
		Score:   int16(*req.Team2.Score),
	}

	// Calculate new MMR
	return mmr.CalculateNewMMRV2(&team1, &team2)
}

// Checks if the player IDs from both teams are unique and that there are exactly 4 unique players.
// If any validation fails, it responds with an appropriate error message and aborts the request.
func ensurePlayers(c *gin.Context, req view.MMRCalculationRequest) {
	// Check for duplicates using a map
	playerMap := make(map[int64]struct{})

	// Add all player IDs from Team 1 and Team 2
	// Ensure there are no duplicates
	for _, player := range req.Team1.Players {
		if _, exists := playerMap[player.Id]; exists {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Player ID %d is duplicated", player.Id)})
			return
		}
		playerMap[player.Id] = struct{}{}
	}

	// Add all player IDs from Team 2
	for _, player := range req.Team2.Players {
		if _, exists := playerMap[player.Id]; exists {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Player ID %d is duplicated", player.Id)})
			return
		}
		playerMap[player.Id] = struct{}{}
	}

	// Ensure there are exactly 4 unique players
	if len(playerMap) != 4 {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "There must be exactly 4 unique players across both teams"})
		return
	}
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
			MMR:   int(mmr.RankingDisplayValue(player.Player.Mu, player.Player.Sigma)),
		}
	}

	return view.MMRTeamResult{
		Score:   &score,
		Players: playersResults,
	}
}
