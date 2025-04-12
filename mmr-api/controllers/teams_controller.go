package controllers

import (
	"mmr/backend/mmr"
	"net/http"

	view "mmr/backend/models"

	"github.com/gin-gonic/gin"
)

type TeamsController struct{}

// GenerateTeams godoc
//
//	@Summary		Generate teams from a list of players
//	@Description	Generate teams from a list of players
//	@Tags 			Teams
//	@Accept			json
//	@Produce		json
//	@Param			request	body		view.GenerateTeamsRequest	true	"Generate Teams Request"
//	@Success		200		{object}	view.GenerateTeamsResponse	"Generated Teams"
//	@Router			/v1/generate-teams [post]
func (m TeamsController) GenerateTeams(c *gin.Context) {
	var req view.GenerateTeamsRequest
	err := c.ShouldBindJSON(&req)

	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure all players are present in the request
	if len(req.Players) != 4 {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Exactly 4 players are required"})
		return
	}

	// Convert view players to mmr players
	mmrPlayers := make([]*mmr.PlayerV2, 4)
	for i, p := range req.Players {
		rating := mmr.RatingForPlayer(p)
		mmrPlayers[i] = &mmr.PlayerV2{
			Id:     p.Id,
			Player: rating,
		}
	}

	// Generate teams using the MMR calculation logic
	team1, team2 := mmr.GenerateTeams(mmrPlayers[0], mmrPlayers[1], mmrPlayers[2], mmrPlayers[3])

	// Convert mmr teams to response format
	response := view.GenerateTeamsResponse{
		Team1: toTeamV2Response(team1),
		Team2: toTeamV2Response(team2),
	}

	c.JSON(http.StatusOK, response)
}

// toTeamV2Response converts a mmr.TeamV2 to view.TeamV2Response
func toTeamV2Response(team mmr.TeamV2) view.TeamV2Response {
	players := make([]view.PlayerV2Response, len(team.Players))
	for i, p := range team.Players {
		players[i] = view.PlayerV2Response{
			Id:    p.Id,
			Mu:    p.Player.Mu,
			Sigma: p.Player.Sigma,
		}
	}
	return view.TeamV2Response{
		Players: players,
	}
}
