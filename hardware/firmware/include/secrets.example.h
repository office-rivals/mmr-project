#pragma once
// Copy to secrets.h (gitignored) and fill in. Never commit real values.
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define API_BASE_URL "https://api.example.com/api/v3/hardware"  // no trailing slash; http://<laptop>:8000 for the mock
// The organisation's enrolment token (admin -> devices). Lets a new device register itself as
// "unclaimed"; after that it authenticates with its own secret (created on first boot, kept in NVS).
#define ENROLMENT_TOKEN "replace-me"
// Root CA certificate of the API server (PEM), required for https://. Paste it between R"( and )"
// exactly as you received it, BEGIN and END lines included. Not needed for http:// (mock server).
static const char API_ROOT_CA[] = R"(
)";

// Telemetry (OpenTelemetry OTLP/HTTP, JSON): the collector's base URL, e.g. http://<host>:4318.
// Empty = telemetry off. The header is whatever the collector expects (e.g. the Aspire dashboard's
// "x-otlp-api-key"); leave the name empty for none.
#define OTLP_ENDPOINT ""
#define OTLP_HEADER_NAME ""
#define OTLP_HEADER_VALUE ""
static const char OTLP_ROOT_CA[] = R"(
)";
