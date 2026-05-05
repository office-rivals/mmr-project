package server

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"
)

func Init(ctx context.Context) error {
	router := NewRouter()
	port := os.Getenv("MMR_API_PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
			return
		}
		close(serverErr)
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		shutdownErr := srv.Shutdown(shutdownCtx)
		// Drain serverErr: the goroutine either sent a real error (ok=true) or
		// closed the channel after a clean ErrServerClosed (ok=false). A real
		// error from ListenAndServe is more informative than Shutdown's reply.
		if listenErr, ok := <-serverErr; ok && listenErr != nil {
			return listenErr
		}
		return shutdownErr
	case err := <-serverErr:
		return err
	}
}
