package controllers

import (
	"github.com/gin-gonic/gin"
	database "mmr/backend/db"
	"mmr/backend/db/repos"
	view "mmr/backend/models"
	"net/http"
)

type UsersController struct{}

//	@BasePath	/api/v1/users

// SearchUsers godoc
//
//	@Summary		Search users
//	@Description	Searches users by name
//	@Tags 			Users
//	@Param			query	query	string	true	"Name to search for"
//	@Produce		json
//	@Success		200	{object}	[]view.UserDetails
//	@Router			/search [get]
func (uc UsersController) SearchUsers(c *gin.Context) {
	// Initialize user repository
	userRepo := repos.NewUserRepository(database.DB)

	// Parse query from request
	query := c.Query("query")

	// Fetch users by name
	users, err := userRepo.SearchUsers(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	if len(users) == 0 {
		c.JSON(http.StatusOK, []view.UserDetails{})
		return
	}

	var userDetails []view.UserDetails
	for _, user := range users {
		userDetails = append(userDetails, view.UserDetailsViewFromModel(*user))
	}

	// Return users as JSON response
	c.JSON(http.StatusOK, userDetails)
}
