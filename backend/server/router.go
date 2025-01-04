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
		//mg := v1.Group("/mmr", middleware.RequireAuth)
		//{
		//	match := new(controllers.MatchController)
		//	mg.GET("/matches", match.GetMatches)
		//}
		//p := v1.Group("/profile", middleware.RequireAuth)
		//{
		//	profile := new(controllers.ProfileController)
		//	p.GET("", profile.GetProfile)
		//	p.POST("/claim", profile.ClaimUser)
		//}
		//s := v1.Group("/stats", middleware.RequireAuth)
		//{
		//	stats := new(controllers.StatsController)
		//	s.GET("/leaderboard", stats.GetLeaderboard)
		//	s.GET("/player-history", stats.GetPlayerHistory)
		//	s.GET("/time-distribution", stats.GetTimeStatistics)
		//}
		//u := v1.Group("/users")
		//{
		//	users := new(controllers.UsersController)
		//	u.GET("", users.ListUsers)
		//	u.POST("", users.CreateUser)
		//	u.GET("/search", users.SearchUsers)
		//	u.GET("/:id", users.GetUser)
		//}
		//a := v1.Group("/admin", middleware.RequireAdminAuth)
		//{
		//	admin := new(controllers.AdminController)
		//	a.POST("/recalculate", admin.RecalculateMatches)
		//}
		calc := v1.Group("/mmr-calculation", middleware.RequireAdminAuth)
		{
			calculation := new(controllers.CalculationController)
			calc.POST("", calculation.SubmitMMRCalculation)
			calc.POST("/batch", calculation.SubmitMMRCalculationsBatch)
		}
	}

	//v2 := router.Group("/api/v2")
	//{
	//	mg := v2.Group("/mmr", middleware.RequireAuth)
	//	{
	//		match := new(controllers.MatchController)
	//		mg.GET("/matches", match.GetMatchesV2)
	//		mg.POST("/matches", match.SubmitMatchV2)
	//	}
	//}

	router.GET("/swagger", func(ctx *gin.Context) {
		ctx.Redirect(http.StatusPermanentRedirect, "/swagger/index.html")
	})
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerfiles.Handler))

	return router

}
