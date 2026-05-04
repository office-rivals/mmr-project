package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

func AccessLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = c.Request.URL.Path
		}

		level := slog.LevelInfo
		if c.Writer.Status() >= 500 {
			level = slog.LevelError
		} else if c.Writer.Status() >= 400 {
			level = slog.LevelWarn
		}

		slog.LogAttrs(c.Request.Context(), level, "http.request",
			slog.String("http.request.method", c.Request.Method),
			slog.String("http.route", route),
			slog.String("url.path", c.Request.URL.Path),
			slog.Int("http.response.status_code", c.Writer.Status()),
			slog.Duration("duration", time.Since(start)),
			slog.String("client.address", c.ClientIP()),
			slog.Int("http.response.body.size", c.Writer.Size()),
		)
	}
}
