package main

import "testing"

// TestVersionDefaultValue verifies that the version variable defaults to "dev"
// when no -ldflags override is supplied at build time. The Dockerfile injects
// the real release tag via -X main.version=${VERSION}; without that flag the
// binary (and tests) fall back to this sentinel so that the absence of the
// build argument is immediately visible in OTel service.version attributes.
func TestVersionDefaultValue(t *testing.T) {
	if version != "dev" {
		t.Errorf("expected default version %q, got %q", "dev", version)
	}
}

// TestVersionIsNonEmpty guards against an accidental blank string being baked
// in, which would produce an empty service.version attribute in OpenTelemetry.
func TestVersionIsNonEmpty(t *testing.T) {
	if version == "" {
		t.Error("version must not be an empty string; use \"dev\" as the sentinel default")
	}
}
