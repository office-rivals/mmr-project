package telemetry

import (
	"context"
	"errors"
	"os"

	"go.opentelemetry.io/contrib/bridges/otelslog"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	logglobal "go.opentelemetry.io/otel/log/global"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.40.0"

	"log/slog"
)

const ServiceName = "mmr-api"

type ShutdownFunc func(context.Context) error

// Init configures global tracer/meter/logger providers exporting to the OTLP endpoint
// from OTEL_EXPORTER_OTLP_ENDPOINT. If that env var is empty, telemetry is disabled and
// the returned shutdown is a no-op so callers don't need to branch.
func Init(ctx context.Context, version string) (ShutdownFunc, error) {
	if os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") == "" {
		slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
		return func(context.Context) error { return nil }, nil
	}

	// Build the service resource without its own schema URL. resource.Merge fails
	// when both resources carry a non-empty, differing schema URL, and
	// resource.Default() tracks whatever semconv version the OTel SDK bundles —
	// which drifts from our pinned semconv import on SDK upgrades. A schemaless
	// resource merges cleanly regardless, so telemetry init can't crash on it.
	res, err := resource.Merge(resource.Default(), resource.NewSchemaless(
		semconv.ServiceName(ServiceName),
		semconv.ServiceVersion(version),
	))
	if err != nil {
		return nil, err
	}

	// Track providers as they come up so a later New() failure can unwind
	// already-running ones instead of leaking goroutines and buffers.
	var shutdowns []func(context.Context) error
	rollback := func() {
		for _, fn := range shutdowns {
			_ = fn(ctx)
		}
	}

	traceExp, err := otlptracehttp.New(ctx)
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExp),
		sdktrace.WithResource(res),
	)
	shutdowns = append(shutdowns, tp.Shutdown)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))

	metricExp, err := otlpmetrichttp.New(ctx)
	if err != nil {
		rollback()
		return nil, err
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp)),
		sdkmetric.WithResource(res),
	)
	shutdowns = append(shutdowns, mp.Shutdown)
	otel.SetMeterProvider(mp)

	logExp, err := otlploghttp.New(ctx)
	if err != nil {
		rollback()
		return nil, err
	}
	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
		sdklog.WithResource(res),
	)
	shutdowns = append(shutdowns, lp.Shutdown)
	logglobal.SetLoggerProvider(lp)

	slog.SetDefault(otelslog.NewLogger(ServiceName, otelslog.WithLoggerProvider(lp)))

	return func(ctx context.Context) error {
		errs := make([]error, 0, len(shutdowns))
		for _, fn := range shutdowns {
			errs = append(errs, fn(ctx))
		}
		return errors.Join(errs...)
	}, nil
}
