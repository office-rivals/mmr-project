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
	// Skip tracing for the health probe; frequent liveness/readiness polls would
	// otherwise flood the trace backend (the access log skips it too).
	router.Use(otelgin.Middleware(telemetry.ServiceName, otelgin.WithGinFilter(func(c *gin.Context) bool {
		return c.Request.URL.Path != "/health"
	})))
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

	router.GET("/health", func(ctx *gin.Context) {
		ctx.Status(http.StatusOK)
	})

	router.GET("/swagger", func(ctx *gin.Context) {
		ctx.Redirect(http.StatusPermanentRedirect, "/swagger/index.html")
	})
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerfiles.Handler))

	return router

}
