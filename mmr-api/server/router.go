package server

import (
	"mmr/backend/controllers"
	"mmr/backend/middleware"
	"mmr/backend/telemetry"
	"net/http"

	"github.com/gin-gonic/gin"
	swaggerfiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

func NewRouter() *gin.Engine {
	router := gin.New()
	router.Use(otelgin.Middleware(telemetry.ServiceName))
	router.Use(middleware.AccessLog())
	router.Use(gin.Recovery())

	v1 := router.Group("/api/v1")
	{
		calc := v1.Group("/mmr-calculation", middleware.RequireAdminAuth)
		{
			calculation := new(controllers.CalculationController)
			calc.POST("", calculation.SubmitMMRCalculation)
			calc.POST("/batch", calculation.SubmitMMRCalculationsBatch)
		}
	}

	router.GET("/swagger", func(ctx *gin.Context) {
		ctx.Redirect(http.StatusPermanentRedirect, "/swagger/index.html")
	})
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerfiles.Handler))

	return router

}
