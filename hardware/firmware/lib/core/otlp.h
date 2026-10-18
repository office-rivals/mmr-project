#pragma once
// OpenTelemetry export, OTLP/HTTP with JSON encoding (INTERFACES §10): log batches to /v1/logs and
// a metrics snapshot to /v1/metrics. Built here so the shape is host-tested; the device only POSTs.
// Protobuf-JSON rules: 64-bit integers (times, intValue, asInt) are decimal strings, enums are numbers.
#include <stdint.h>

#include <string>

#include "telemetry.h"

namespace otlp {

constexpr const char* LOGS_PATH = "/v1/logs";
constexpr const char* METRICS_PATH = "/v1/metrics";

struct Resource {  // service.name foosball-goal-counter
  std::string version, device_id;
  std::string table_id, goal;  // empty = unknown, attribute omitted
};

// Log records; entries logged before NTP sync have no timeUnixNano (0 = unknown in OTLP), but all
// carry observedTimeUnixNano = the export time. dropped_total goes on the scope as an attribute.
std::string logsJson(const Resource& r, const tel::LogEntry* e, int n, uint32_t dropped_total, int64_t now_ms);

struct Metrics {
  int battery_mv = -1;  // -1 = not measured: the gauge is omitted
  bool low_batt = false, beam_blocked = false;
  std::string reset_reason;
  uint32_t uptime_ms = 0, queued = 0, free_heap = 0, min_free_heap = 0;
  int32_t rssi = 0, wifi_connect_ms = -1;  // 0 / -1 = unknown: omitted
  // monotonic counters since power-on (RTC memory)
  uint32_t wakes = 0, goals = 0, rejected_blocks = 0, stuck_events = 0, wifi_retries = 0;
  uint32_t queue_dropped = 0, log_dropped = 0;
  // goal counter beam health: health 0 ok .. 4 sensor_dead, mode 0 a, 1 a_boost, 2 b; µA < 0 = omitted
  bool has_beam = false;
  int beam_health = 0, beam_mode = 0;
  float beam_amb_ua = -1, beam_lit1_ua = -1, beam_ball_ua = -1, beam_margin = -1;
};

// Gauges for levels, cumulative monotonic sums for counters (start = power-on).
std::string metricsJson(const Resource& r, const Metrics& m, int64_t now_ms, int64_t start_ms);

}  // namespace otlp
