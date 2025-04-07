package middleware

import (
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
)

func RequireAdminAuth(c *gin.Context) {
	apiKey := c.GetHeader("X-API-KEY")

	if apiKey == "" || apiKey != os.Getenv("ADMIN_SECRET") {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	c.Next()
}
