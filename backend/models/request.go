package view

type MMRCalculationRequest struct {
	Team1 MMRCalculationTeam `json:"team1" binding:"required"`
	Team2 MMRCalculationTeam `json:"team2" binding:"required"`
}

type MMRCalculationTeam struct {
	Score   *int                         `json:"score" binding:"required"`
	Players []MMRCalculationPlayerRating `json:"players" binding:"required"`
}

type MMRCalculationPlayerRating struct {
	Id    int64    `json:"id" binding:"required"`
	Mu    *float64 `json:"mu"`    // Use pointers to represent nullable values
	Sigma *float64 `json:"sigma"` // Use pointers to represent nullable values
}
