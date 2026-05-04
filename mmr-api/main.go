package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mmr/backend/config"
	server "mmr/backend/server"
	"mmr/backend/telemetry"
)

// @BasePath	/api

var version = "dev"

func main() {
	config.LoadEnv()

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	shutdown, err := telemetry.Init(ctx, version)
	if err != nil {
		slog.Error("telemetry init failed", "error", err)
		os.Exit(1)
	}
	defer func() {
		shutdownCtx, c := context.WithTimeout(context.Background(), 5*time.Second)
		defer c()
		if err := shutdown(shutdownCtx); err != nil {
			slog.Error("telemetry shutdown failed", "error", err)
		}
	}()

	server.Init()
}
