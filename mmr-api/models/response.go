package view

type MMRCalculationResponse struct {
	Team1 MMRTeamResult `json:"team1" binding:"required"`
	Team2 MMRTeamResult `json:"team2" binding:"required"`
}

type MMRTeamResult struct {
	Score   *int              `json:"score" binding:"required"`
	Players []PlayerMMRResult `json:"players" binding:"required"`
}

type PlayerMMRResult struct {
	Id    int64   `json:"id" binding:"required"`
	Mu    float64 `json:"mu" binding:"required"`    // Required in the response
	Sigma float64 `json:"sigma" binding:"required"` // Required in the response
	MMR   int     `json:"mmr" binding:"required"`   // New field in the response
}

type GenerateTeamsResponse struct {
	Team1 TeamV2Response `json:"team1" binding:"required"`
	Team2 TeamV2Response `json:"team2" binding:"required"`
}

type TeamV2Response struct {
	Players []PlayerV2Response `json:"players" binding:"required"`
}

type PlayerV2Response struct {
	Id    int64   `json:"id" binding:"required"`
	Mu    float64 `json:"mu" binding:"required"`
	Sigma float64 `json:"sigma" binding:"required"`
}
