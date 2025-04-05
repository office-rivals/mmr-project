package custom

import (
	"fmt"
	custom "mmr/backend/mmrCustom"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCustomMMRCalculation(t *testing.T) {

	// Initialize players with their initial MMR and uncertainty
	player1 := &custom.Player{Initials: "p1", MMR: 1500, Uncertainty: 200}
	player2 := &custom.Player{Initials: "p2", MMR: 1500, Uncertainty: 150}
	player3 := &custom.Player{Initials: "p3", MMR: 1500, Uncertainty: 180}
	player4 := &custom.Player{Initials: "p4", MMR: 1500, Uncertainty: 170}

	// Create teams
	team1 := &custom.Team{Players: []*custom.Player{player1, player2}}
	team2 := &custom.Team{Players: []*custom.Player{player3, player4}}

	// Simulate match outcome (team 1 wins)
	custom.UpdateMMR(team1, team2, custom.Team1Wins)

	// Display updated player MMRs
	fmt.Println("Player 1 MMR:", player1.MMR)
	fmt.Println("Player 2 MMR:", player2.MMR)
	fmt.Println("Player 3 MMR:", player3.MMR)
	fmt.Println("Player 4 MMR:", player4.MMR)

	assert.True(t, player1.MMR > player3.MMR && player1.MMR > player4.MMR, "team1 won")
	assert.True(t, player2.MMR > player3.MMR && player2.MMR > player4.MMR, "team1 won")
}

func TestMain(m *testing.M) {

	// Run tests
	exitCode := m.Run()

	// Exit with the appropriate exit code
	os.Exit(exitCode)
}
