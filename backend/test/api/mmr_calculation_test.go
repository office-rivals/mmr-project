package api_test

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"net/http"
	"net/http/httptest"
	"testing"

	"mmr/backend/controllers"
	view "mmr/backend/models"

	"github.com/stretchr/testify/assert"
)

// setupRouter initializes the Gin router in test mode and returns it
func setupRouter() *gin.Engine {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)

	// Create a new Gin router
	return gin.New() // Just return the new router without registering routes
}

// postRequest is a helper function to create a POST request
func postRequest(router *gin.Engine, url string, requestBody interface{}) *httptest.ResponseRecorder {
	body, err := json.Marshal(requestBody)
	if err != nil {
		return nil // Return nil on failure to marshal
	}

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")

	// Create a response recorder to capture the response
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	return rr
}

// TestSubmitMMRCalculationNewPlayers tests the MMR calculation endpoint with unique players
func TestSubmitMMRCalculationNewPlayers(t *testing.T) {
	router := setupRouter()

	// Register the MMR calculation endpoint
	calculationController := controllers.CalculationController{}
	router.POST("/v1/mmr-calculation", calculationController.SubmitMMRCalculation)

	// Prepare a request with unique players
	team1Score := 100
	team2Score := 200
	requestBody := view.MMRCalculationRequest{
		Team1: view.MMRCalculationTeam{
			Score: &team1Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 1, Mu: nil, Sigma: nil},
				{Id: 2, Mu: nil, Sigma: nil},
			},
		},
		Team2: view.MMRCalculationTeam{
			Score: &team2Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 3, Mu: nil, Sigma: nil},
				{Id: 4, Mu: nil, Sigma: nil},
			},
		},
	}

	rr := postRequest(router, "/v1/mmr-calculation", requestBody)

	// Check the status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check the response body
	var response view.MMRCalculationResponse
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	// Perform assertions on the response
	assert.Equal(t, 100, *response.Team1.Score)
	assert.Equal(t, 200, *response.Team2.Score)
	assert.Equal(t, 2, len(response.Team1.Players))
	assert.Equal(t, 2, len(response.Team2.Players))

	// Check Mu and Sigma values for Team 1
	assert.Equal(t, 23.923062762073393, response.Team1.Players[0].Mu)
	assert.Equal(t, 4.928838065802311, response.Team1.Players[0].Sigma)

	assert.Equal(t, 23.923062762073393, response.Team1.Players[1].Mu)
	assert.Equal(t, 4.928838065802311, response.Team1.Players[1].Sigma)

	// Check Mu and Sigma values for Team 2
	assert.Equal(t, 26.076937237926607, response.Team2.Players[0].Mu)
	assert.Equal(t, 4.928838065802311, response.Team2.Players[0].Sigma)

	assert.Equal(t, 26.076937237926607, response.Team2.Players[1].Mu)
	assert.Equal(t, 4.928838065802311, response.Team2.Players[1].Sigma)
}

// TestSubmitMMRCalculationWithRealMuAndSigma tests the MMR calculation with real Mu and Sigma values
func TestSubmitMMRCalculationWithRealMuAndSigma(t *testing.T) {
	router := setupRouter()

	// Register the MMR calculation endpoint
	calculationController := controllers.CalculationController{}
	router.POST("/v1/mmr-calculation", calculationController.SubmitMMRCalculation)

	// Prepare a request with real Mu and Sigma values
	team1Score := 100
	team2Score := 200
	requestBody := view.MMRCalculationRequest{
		Team1: view.MMRCalculationTeam{
			Score: &team1Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 1, Mu: float64Ptr(30.0), Sigma: float64Ptr(7.0)},
				{Id: 2, Mu: float64Ptr(28.0), Sigma: float64Ptr(6.5)},
			},
		},
		Team2: view.MMRCalculationTeam{
			Score: &team2Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 3, Mu: float64Ptr(27.0), Sigma: float64Ptr(8.0)},
				{Id: 4, Mu: float64Ptr(29.0), Sigma: float64Ptr(7.5)},
			},
		},
	}

	rr := postRequest(router, "/v1/mmr-calculation", requestBody)

	// Check the status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check the response body
	var response view.MMRCalculationResponse
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	// Perform assertions on the response
	assert.Equal(t, 100, *response.Team1.Score)
	assert.Equal(t, 200, *response.Team2.Score)
	assert.Equal(t, 2, len(response.Team1.Players))
	assert.Equal(t, 2, len(response.Team2.Players))

	// Check Mu and Sigma values for Team 1
	assert.Equal(t, 28.339272992632903, response.Team1.Players[0].Mu)
	assert.Equal(t, 6.893615138593818, response.Team1.Players[0].Sigma)

	assert.Equal(t, 26.568046610994696, response.Team1.Players[1].Mu)
	assert.Equal(t, 6.414912671305059, response.Team1.Players[1].Sigma)

	// Check Mu and Sigma values for Team 2
	assert.Equal(t, 29.16911282594886, response.Team2.Players[0].Mu)
	assert.Equal(t, 7.816994122798585, response.Team2.Players[0].Sigma)

	assert.Equal(t, 30.906446819681616, response.Team2.Players[1].Mu)
	assert.Equal(t, 7.349420941427839, response.Team2.Players[1].Sigma)
}

// TestSubmitMMRCalculationsBatch tests that MMR calculations use updated player data
func TestSubmitMMRCalculationsBatchUseUpdatedPlayerData(t *testing.T) {
	router := setupRouter()

	// Register the MMR calculation endpoint
	calculationController := controllers.CalculationController{}
	router.POST("/v1/mmr-calculation/batch", calculationController.SubmitMMRCalculationsBatch)

	// Prepare a request with unique players
	team1Score := 100
	team2Score := 200
	requestBody := []view.MMRCalculationRequest{
		{
			Team1: view.MMRCalculationTeam{
				Score: &team1Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 1, Mu: nil, Sigma: nil},
					{Id: 2, Mu: nil, Sigma: nil},
				},
			},
			Team2: view.MMRCalculationTeam{
				Score: &team2Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 3, Mu: nil, Sigma: nil},
					{Id: 4, Mu: nil, Sigma: nil},
				},
			},
		},
		{
			Team1: view.MMRCalculationTeam{
				Score: &team1Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 1, Mu: nil, Sigma: nil},
					{Id: 3, Mu: nil, Sigma: nil},
				},
			},
			Team2: view.MMRCalculationTeam{
				Score: &team2Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 4, Mu: nil, Sigma: nil},
					{Id: 5, Mu: nil, Sigma: nil},
				},
			},
		},
	}

	rr := postRequest(router, "/v1/mmr-calculation/batch", requestBody)

	// Check the status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check the response body
	var response []view.MMRCalculationResponse
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	// Perform assertions on the response
	assert.Equal(t, 2, len(response))

	// Check the first response
	assert.Equal(t, 100, *response[0].Team1.Score)
	assert.Equal(t, 200, *response[0].Team2.Score)
	assert.Equal(t, 2, len(response[0].Team1.Players))
	assert.Equal(t, 2, len(response[0].Team2.Players))

	// Check Mu and Sigma values for Team 1
	assert.Equal(t, 23.923062762073393, response[0].Team1.Players[0].Mu)
	assert.Equal(t, 4.928838065802311, response[0].Team1.Players[0].Sigma)

	assert.Equal(t, 23.923062762073393, response[0].Team1.Players[1].Mu)
	assert.Equal(t, 4.928838065802311, response[0].Team1.Players[1].Sigma)

	// Check Mu and Sigma values for Team 2
	assert.Equal(t, 26.076937237926607, response[0].Team2.Players[0].Mu)
	assert.Equal(t, 4.928838065802311, response[0].Team2.Players[0].Sigma)

	assert.Equal(t, 26.076937237926607, response[0].Team2.Players[1].Mu)
	assert.Equal(t, 4.928838065802311, response[0].Team2.Players[1].Sigma)

	// Check the second response
	assert.Equal(t, 100, *response[1].Team1.Score)
	assert.Equal(t, 200, *response[1].Team2.Score)
	assert.Equal(t, 2, len(response[1].Team1.Players))
	assert.Equal(t, 2, len(response[1].Team2.Players))

	// Check Mu and Sigma values for Team 1
	assert.Equal(t, 22.91752024126155, response[1].Team1.Players[0].Mu)
	assert.Equal(t, 4.860184786338031, response[1].Team1.Players[0].Sigma)

	assert.Equal(t, 25.071394717114764, response[1].Team1.Players[1].Mu)
	assert.Equal(t, 4.860184786338031, response[1].Team1.Players[1].Sigma)

	// Check Mu and Sigma values for Team 2
	assert.Equal(t, 27.08247975873845, response[1].Team2.Players[0].Mu)
	assert.Equal(t, 4.859683867958447, response[1].Team2.Players[0].Sigma)

	assert.InEpsilon(t, 26.034787917175375, response[1].Team2.Players[1].Mu, 0.000000000000001)
	assert.Equal(t, 4.9277920840021645, response[1].Team2.Players[1].Sigma)
}

// TestSubmitMMRCalculationsBatchIgnoreLaterPlayerMuAndSigma tests that MMR calculations ignore later player Mu and Sigma values
func TestSubmitMMRCalculationsBatchIgnoreLaterPlayerMuAndSigma(t *testing.T) {
	router := setupRouter()

	// Register the MMR calculation endpoint
	calculationController := controllers.CalculationController{}
	router.POST("/v1/mmr-calculation/batch", calculationController.SubmitMMRCalculationsBatch)

	// Prepare a request with unique players
	team1Score := 100
	team2Score := 200
	requestBody := []view.MMRCalculationRequest{
		{
			Team1: view.MMRCalculationTeam{
				Score: &team1Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 1, Mu: float64Ptr(23.035814496704035), Sigma: float64Ptr(8.17755635771097)},
					{Id: 3, Mu: float64Ptr(26.964185503295965), Sigma: float64Ptr(8.17755635771097)},
				},
			},
			Team2: view.MMRCalculationTeam{
				Score: &team2Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 4, Mu: float64Ptr(26.964185503295965), Sigma: float64Ptr(8.17755635771097)},
					{Id: 5, Mu: nil, Sigma: nil},
				},
			},
		},
		{
			Team1: view.MMRCalculationTeam{
				Score: &team1Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 1, Mu: float64Ptr(23.035814496704035), Sigma: float64Ptr(8.17755635771097)},
					{Id: 3, Mu: float64Ptr(23.035814496704035), Sigma: float64Ptr(8.17755635771097)},
				},
			},
			Team2: view.MMRCalculationTeam{
				Score: &team2Score,
				Players: []view.MMRCalculationPlayerRating{
					{Id: 4, Mu: float64Ptr(26.964185503295965), Sigma: float64Ptr(8.17755635771097)},
					{Id: 5, Mu: float64Ptr(26.964185503295965), Sigma: float64Ptr(8.17755635771097)},
				},
			},
		},
	}

	rr := postRequest(router, "/v1/mmr-calculation/batch", requestBody)

	// Check the status code
	assert.Equal(t, http.StatusOK, rr.Code)

	// Check the response body
	var response []view.MMRCalculationResponse
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	if err != nil {
		t.Fatalf("Failed to unmarshal response body: %v", err)
	}

	// Perform assertions on the response
	assert.Equal(t, 2, len(response))

	// Check the first response
	assert.Equal(t, 100, *response[0].Team1.Score)
	assert.Equal(t, 200, *response[0].Team2.Score)
	assert.Equal(t, 2, len(response[0].Team1.Players))
	assert.Equal(t, 2, len(response[0].Team2.Players))

	// Check Mu and Sigma values for Team 1
	assert.Equal(t, 21.089518767858735, response[0].Team1.Players[0].Mu)
	assert.Equal(t, 7.987856132049211, response[0].Team1.Players[0].Sigma)

	assert.Equal(t, 25.017889774450666, response[0].Team1.Players[1].Mu)
	assert.Equal(t, 7.987856132049211, response[0].Team1.Players[1].Sigma)

	// Check Mu and Sigma values for Team 2
	assert.Equal(t, 28.910481232141265, response[0].Team2.Players[0].Mu)
	assert.Equal(t, 8.0206495537677, response[0].Team2.Players[0].Sigma)

	assert.Equal(t, 25.727615172476014, response[0].Team2.Players[1].Mu)
	assert.Equal(t, 4.9643511518777474, response[0].Team2.Players[1].Sigma)

	// Check the second response
	assert.Equal(t, 100, *response[1].Team1.Score)
	assert.Equal(t, 200, *response[1].Team2.Score)
	assert.Equal(t, 2, len(response[1].Team1.Players))
	assert.Equal(t, 2, len(response[1].Team2.Players))

	// Check Mu and Sigma values for Team 1
	assert.Equal(t, 19.60583732187948, response[1].Team1.Players[0].Mu)
	assert.InEpsilon(t, 7.817871209619984, response[1].Team1.Players[0].Sigma, 0.000000000000001)

	assert.Equal(t, 23.53420832847141, response[1].Team1.Players[1].Mu)
	assert.InEpsilon(t, 7.817871209619984, response[1].Team1.Players[1].Sigma, 0.000000000000001)

	// Check Mu and Sigma values for Team 2
	assert.Equal(t, 30.40636992494211, response[1].Team2.Players[0].Mu)
	assert.Equal(t, 7.877201744950751, response[1].Team2.Players[0].Sigma)

	assert.InEpsilon(t, 26.30068188745282, response[1].Team2.Players[1].Mu, 0.000000000000001)
	assert.Equal(t, 4.9305264691344615, response[1].Team2.Players[1].Sigma)
}

// TestSerializationPrecision tests that serialization and deserialization preserves Mu and Sigma values.
func TestSerializationPrecision(t *testing.T) {
	// Prepare a sample MMRCalculationRequest with Mu and Sigma as nil
	team1Score := 100
	team2Score := 200
	originalRequest := view.MMRCalculationRequest{
		Team1: view.MMRCalculationTeam{
			Score: &team1Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 1, Mu: nil, Sigma: nil},
				{Id: 2, Mu: nil, Sigma: nil},
			},
		},
		Team2: view.MMRCalculationTeam{
			Score: &team2Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 3, Mu: nil, Sigma: nil},
				{Id: 4, Mu: nil, Sigma: nil},
			},
		},
	}

	// Serialize the original request to JSON
	data, err := json.Marshal(originalRequest)
	assert.NoError(t, err)

	// Deserialize the JSON back into a new request object
	var newRequest view.MMRCalculationRequest
	err = json.Unmarshal(data, &newRequest)
	assert.NoError(t, err)

	// Check if the original request and new request are equal
	assert.Equal(t, *originalRequest.Team1.Score, *newRequest.Team1.Score)
	assert.Equal(t, *originalRequest.Team2.Score, *newRequest.Team2.Score)

	for i := range originalRequest.Team1.Players {
		assert.Equal(t, originalRequest.Team1.Players[i].Id, newRequest.Team1.Players[i].Id)
		assert.Nil(t, newRequest.Team1.Players[i].Mu)
		assert.Nil(t, newRequest.Team1.Players[i].Sigma)
	}

	for i := range originalRequest.Team2.Players {
		assert.Equal(t, originalRequest.Team2.Players[i].Id, newRequest.Team2.Players[i].Id)
		assert.Nil(t, newRequest.Team2.Players[i].Mu)
		assert.Nil(t, newRequest.Team2.Players[i].Sigma)
	}

	// Now prepare a sample with real Mu and Sigma values
	realMu := 24.510947050344704
	realSigma := 1.9410748715281192

	team1Score = 100
	team2Score = 200
	originalRequestWithValues := view.MMRCalculationRequest{
		Team1: view.MMRCalculationTeam{
			Score: &team1Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 1, Mu: &realMu, Sigma: &realSigma},
				{Id: 2, Mu: &realMu, Sigma: &realSigma},
			},
		},
		Team2: view.MMRCalculationTeam{
			Score: &team2Score,
			Players: []view.MMRCalculationPlayerRating{
				{Id: 3, Mu: &realMu, Sigma: &realSigma},
				{Id: 4, Mu: &realMu, Sigma: &realSigma},
			},
		},
	}

	// Serialize the original request to JSON
	dataWithValues, err := json.Marshal(originalRequestWithValues)
	assert.NoError(t, err)

	// Deserialize the JSON back into a new request object
	var newRequestWithValues view.MMRCalculationRequest
	err = json.Unmarshal(dataWithValues, &newRequestWithValues)
	assert.NoError(t, err)

	// Check if the original request and new request are equal
	assert.Equal(t, *originalRequestWithValues.Team1.Score, *newRequestWithValues.Team1.Score)
	assert.Equal(t, *originalRequestWithValues.Team2.Score, *newRequestWithValues.Team2.Score)

	for i := range originalRequestWithValues.Team1.Players {
		assert.Equal(t, originalRequestWithValues.Team1.Players[i].Id, newRequestWithValues.Team1.Players[i].Id)
		assert.Equal(t, *originalRequestWithValues.Team1.Players[i].Mu, *newRequestWithValues.Team1.Players[i].Mu)
		assert.Equal(t, *originalRequestWithValues.Team1.Players[i].Sigma, *newRequestWithValues.Team1.Players[i].Sigma)
	}

	for i := range originalRequestWithValues.Team2.Players {
		assert.Equal(t, originalRequestWithValues.Team2.Players[i].Id, newRequestWithValues.Team2.Players[i].Id)
		assert.Equal(t, *originalRequestWithValues.Team2.Players[i].Mu, *newRequestWithValues.Team2.Players[i].Mu)
		assert.Equal(t, *originalRequestWithValues.Team2.Players[i].Sigma, *newRequestWithValues.Team2.Players[i].Sigma)
	}
}

// Helper function to create a pointer to a float64 value
func float64Ptr(f float64) *float64 {
	return &f
}
