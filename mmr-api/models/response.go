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

type MMRPredictionResponse struct {
	Team1 MMRTeamPrediction `json:"team1" binding:"required"`
	Team2 MMRTeamPrediction `json:"team2" binding:"required"`
}

type MMRTeamPrediction struct {
	// Probability from 0 to 1; the two teams' chances sum to 1.
	WinChance float64               `json:"winChance" binding:"required"`
	Players   []PlayerMMRPrediction `json:"players" binding:"required"`
}

type PlayerMMRPrediction struct {
	Id int64 `json:"id" binding:"required"`
	// The MMR the player goes into the match with, after any season reset.
	MMR       int `json:"mmr" binding:"required"`
	MMRIfWin  int `json:"mmrIfWin" binding:"required"`
	MMRIfLose int `json:"mmrIfLose" binding:"required"`
}
