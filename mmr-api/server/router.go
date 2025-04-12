package server

import (
	"mmr/backend/controllers"
	"mmr/backend/middleware"
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerfiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func NewRouter() *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	v1 := router.Group("/api/v1")
	{
		calc := v1.Group("/mmr-calculation", middleware.RequireAdminAuth)
		{
			calculation := new(controllers.CalculationController)
			calc.POST("", calculation.SubmitMMRCalculation)
			calc.POST("/batch", calculation.SubmitMMRCalculationsBatch)
		}

		generateTeams := v1.Group("/generate-teams", middleware.RequireAdminAuth)
		{
			teams := new(controllers.TeamsController)
			generateTeams.POST("", teams.GenerateTeams)
		}
	}

	router.GET("/swagger", func(ctx *gin.Context) {
		ctx.Redirect(http.StatusPermanentRedirect, "/swagger/index.html")
	})
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerfiles.Handler))

	return router
}
