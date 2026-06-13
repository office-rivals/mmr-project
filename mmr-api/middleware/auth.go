package middleware

import (
	"crypto/subtle"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func RequireAdminAuth(c *gin.Context) {
	apiKey := c.GetHeader("X-API-KEY")
	secret := os.Getenv("ADMIN_SECRET")

	if apiKey == "" || secret == "" ||
		subtle.ConstantTimeCompare([]byte(apiKey), []byte(secret)) != 1 {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	c.Next()
}
