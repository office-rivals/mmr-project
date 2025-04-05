package mmr

// Team is a composition of players that play together. The skill of a team
// (µ and σ) is determined by the skills of the players that form the team.
type Team struct {
	Players []Player
	Score   int16
}

type TeamV2 struct {
	Players []PlayerV2
	Score   int16
}

// Size returns the number of players in the team
func (t *Team) Size() int {
	return len(t.Players)
}
