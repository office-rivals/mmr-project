package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"mmr/backend/middleware"
)

func setupAuthRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/protected", middleware.RequireAdminAuth, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func TestRequireAdminAuth_CorrectKey(t *testing.T) {
	t.Setenv("ADMIN_SECRET", "correct-secret")
	r := setupAuthRouter()

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("X-API-KEY", "correct-secret")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestRequireAdminAuth_WrongKey(t *testing.T) {
	t.Setenv("ADMIN_SECRET", "correct-secret")
	r := setupAuthRouter()

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("X-API-KEY", "wrong-secret")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestRequireAdminAuth_EmptyHeader(t *testing.T) {
	t.Setenv("ADMIN_SECRET", "correct-secret")
	r := setupAuthRouter()

	req, _ := http.NewRequest("GET", "/protected", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestRequireAdminAuth_EmptySecretAndEmptyHeader(t *testing.T) {
	t.Setenv("ADMIN_SECRET", "")
	r := setupAuthRouter()

	req, _ := http.NewRequest("GET", "/protected", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}

func TestRequireAdminAuth_EmptySecretNonEmptyHeader(t *testing.T) {
	t.Setenv("ADMIN_SECRET", "")
	r := setupAuthRouter()

	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("X-API-KEY", "some-key")
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)
}
