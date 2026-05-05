package middleware

import (
	"log/slog"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func AccessLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/health" || strings.HasPrefix(path, "/swagger") {
			c.Next()
			return
		}

		start := time.Now()
		c.Next()

		route := c.FullPath()
		if route == "" {
			route = path
		}

		status := c.Writer.Status()
		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		} else if status >= 400 {
			level = slog.LevelWarn
		}

		// Gin returns -1 from Writer.Size() before the body is written
		// (redirects, 204s); normalize to 0 so we don't ship bogus values.
		size := c.Writer.Size()
		if size < 0 {
			size = 0
		}

		slog.LogAttrs(c.Request.Context(), level, "http.request",
			slog.String("http.request.method", c.Request.Method),
			slog.String("http.route", route),
			slog.String("url.path", path),
			slog.Int("http.response.status_code", status),
			slog.Duration("duration", time.Since(start)),
			slog.String("client.address", c.ClientIP()),
			slog.Int("http.response.body.size", size),
		)
	}
}
