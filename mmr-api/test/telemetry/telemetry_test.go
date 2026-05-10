package telemetry_test

import (
	"context"
	"os"
	"testing"

	"mmr/backend/telemetry"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestServiceName verifies the exported ServiceName constant is "mmr-api",
// which is what OTel resource attributes report for service.name.
func TestServiceName(t *testing.T) {
	assert.Equal(t, "mmr-api", telemetry.ServiceName)
}

// TestInit_NoOp_WhenOtlpEndpointEmpty verifies that Init returns without error
// when OTEL_EXPORTER_OTLP_ENDPOINT is not set (telemetry disabled path).
func TestInit_NoOp_WhenOtlpEndpointEmpty(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")

	shutdown, err := telemetry.Init(context.Background(), "dev")

	require.NoError(t, err)
	require.NotNil(t, shutdown)
}

// TestInit_NoOp_ShutdownIsCallable verifies the shutdown function returned by
// the no-op path can be called without error.
func TestInit_NoOp_ShutdownIsCallable(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")

	shutdown, err := telemetry.Init(context.Background(), "1.1.2")
	require.NoError(t, err)

	shutdownErr := shutdown(context.Background())
	assert.NoError(t, shutdownErr)
}

// TestInit_AcceptsArbitraryVersionString verifies that Init accepts any version
// string without error. This exercises the VERSION build-arg path introduced in
// the Dockerfile: the binary can be built with any semver or "dev" as VERSION.
func TestInit_AcceptsArbitraryVersionString(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")

	versions := []string{
		"dev",     // default when no VERSION build-arg supplied
		"1.0.0",   // typical semver
		"1.1.2",   // the example from the changeset description
		"0.0.1",   // early pre-release
		"2.3.4-rc.1", // pre-release tag
		"",        // edge case: empty string
	}

	for _, v := range versions {
		t.Run("version="+v, func(t *testing.T) {
			shutdown, err := telemetry.Init(context.Background(), v)
			require.NoError(t, err, "Init should not error for version %q", v)
			require.NotNil(t, shutdown)

			require.NoError(t, shutdown(context.Background()))
		})
	}
}

// TestInit_NoOp_DoesNotRequireOtlpEnv verifies that Init operates correctly
// even when the OTLP endpoint env var is explicitly absent (not just empty).
func TestInit_NoOp_DoesNotRequireOtlpEnv(t *testing.T) {
	original, wasSet := os.LookupEnv("OTEL_EXPORTER_OTLP_ENDPOINT")
	os.Unsetenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	t.Cleanup(func() {
		if wasSet {
			os.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", original)
		}
	})

	shutdown, err := telemetry.Init(context.Background(), "dev")
	require.NoError(t, err)
	require.NotNil(t, shutdown)
	assert.NoError(t, shutdown(context.Background()))
}

// TestInit_NoOp_CancelledContextIsHandled verifies that Init does not error
// when the context is already cancelled on the no-op path (no network dial
// occurs so cancellation has no effect).
func TestInit_NoOp_CancelledContextIsHandled(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel before calling Init

	shutdown, err := telemetry.Init(ctx, "1.0.0")
	require.NoError(t, err)
	require.NotNil(t, shutdown)
}
