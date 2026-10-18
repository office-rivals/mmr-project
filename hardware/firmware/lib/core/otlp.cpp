#include "otlp.h"

#include <ArduinoJson.h>
#include <stdio.h>

namespace otlp {

static std::string nanos(int64_t ms) {  // int64 -> decimal string, as protobuf-JSON wants
  char b[24];
  snprintf(b, sizeof b, "%lld000000", (long long)ms);
  return ms > 0 ? b : "0";
}

static void attr(JsonArray a, const char* k, const std::string& v) {
  if (v.empty()) return;
  JsonObject o = a.add<JsonObject>();
  o["key"] = k;
  o["value"]["stringValue"] = v;
}

static void attrInt(JsonArray a, const char* k, int64_t v) {
  JsonObject o = a.add<JsonObject>();
  o["key"] = k;
  o["value"]["intValue"] = std::to_string(v);
}

static void resource(JsonObject res, const Resource& r) {
  JsonArray a = res["attributes"].to<JsonArray>();
  attr(a, "service.name", "foosball-goal-counter");
  attr(a, "service.version", r.version);
  attr(a, "service.instance.id", r.device_id);
  attr(a, "device.id", r.device_id);
  attr(a, "foosball.role", "goal");
  attr(a, "foosball.table_id", r.table_id);
  attr(a, "foosball.goal", r.goal);
}

static void scope(JsonObject s, const Resource& r) {
  s["name"] = "foosball.firmware";
  s["version"] = r.version;
}

std::string logsJson(const Resource& r, const tel::LogEntry* e, int n, uint32_t dropped_total, int64_t now_ms) {
  static const int severity[] = {5, 9, 13, 17};  // DEBUG, INFO, WARN, ERROR
  static const char* text[] = {"DEBUG", "INFO", "WARN", "ERROR"};
  JsonDocument d;
  JsonObject rl = d["resourceLogs"].to<JsonArray>().add<JsonObject>();
  resource(rl["resource"].to<JsonObject>(), r);
  JsonObject sl = rl["scopeLogs"].to<JsonArray>().add<JsonObject>();
  JsonObject sc = sl["scope"].to<JsonObject>();
  scope(sc, r);
  attrInt(sc["attributes"].to<JsonArray>(), "foosball.log.dropped_total", dropped_total);
  JsonArray recs = sl["logRecords"].to<JsonArray>();
  for (int i = 0; i < n; i++) {
    int lvl = (int)e[i].level & 3;
    JsonObject o = recs.add<JsonObject>();
    o["timeUnixNano"] = nanos(e[i].epoch_ms);
    o["observedTimeUnixNano"] = nanos(now_ms);
    o["severityNumber"] = severity[lvl];
    o["severityText"] = text[lvl];
    o["body"]["stringValue"] = e[i].msg;
    JsonArray a = o["attributes"].to<JsonArray>();
    attr(a, "foosball.tag", e[i].tag);
    attrInt(a, "foosball.log.seq", e[i].seq);
    attrInt(a, "foosball.wake", e[i].wake);
    attrInt(a, "foosball.uptime_ms", e[i].up_ms);
    for (int k = 0; k < e[i].nkv; k++) attrInt(a, e[i].kv[k].k, e[i].kv[k].v);
  }
  std::string s;
  serializeJson(d, s);
  return s;
}

struct Writer {
  JsonArray metrics;
  std::string now, start;

  JsonObject point(const char* name, const char* unit, bool sum) {
    JsonObject m = metrics.add<JsonObject>();
    m["name"] = name;
    m["unit"] = unit;
    JsonObject body = m[sum ? "sum" : "gauge"].to<JsonObject>();
    if (sum) {
      body["aggregationTemporality"] = 2;  // CUMULATIVE
      body["isMonotonic"] = true;
    }
    JsonObject p = body["dataPoints"].to<JsonArray>().add<JsonObject>();
    if (sum) p["startTimeUnixNano"] = start;
    p["timeUnixNano"] = now;
    return p;
  }
  JsonObject gauge(const char* name, const char* unit, int64_t v) {
    JsonObject p = point(name, unit, false);
    p["asInt"] = std::to_string(v);
    return p;
  }
  void gaugeD(const char* name, const char* unit, double v) { point(name, unit, false)["asDouble"] = v; }
  void counter(const char* name, const char* unit, uint32_t v) { point(name, unit, true)["asInt"] = std::to_string(v); }
};

std::string metricsJson(const Resource& r, const Metrics& m, int64_t now_ms, int64_t start_ms) {
  JsonDocument d;
  JsonObject rm = d["resourceMetrics"].to<JsonArray>().add<JsonObject>();
  resource(rm["resource"].to<JsonObject>(), r);
  JsonObject sm = rm["scopeMetrics"].to<JsonArray>().add<JsonObject>();
  scope(sm["scope"].to<JsonObject>(), r);
  Writer w{sm["metrics"].to<JsonArray>(), nanos(now_ms), nanos(start_ms)};
  if (m.battery_mv >= 0) w.gaugeD("foosball.battery.voltage", "V", m.battery_mv / 1000.0);
  w.gauge("foosball.battery.low", "1", m.low_batt);
  w.gauge("foosball.uptime", "ms", m.uptime_ms);
  attr(w.gauge("foosball.reset", "1", 1)["attributes"].to<JsonArray>(), "foosball.reset.reason", m.reset_reason);
  if (m.rssi != 0) w.gauge("foosball.wifi.rssi", "dBm", m.rssi);
  if (m.wifi_connect_ms >= 0) w.gauge("foosball.wifi.connect_time", "ms", m.wifi_connect_ms);
  w.gauge("foosball.queue.depth", "{event}", m.queued);
  w.gauge("foosball.beam.blocked", "1", m.beam_blocked);
  if (m.has_beam) {
    w.gauge("foosball.beam.health", "1", m.beam_health);
    w.gauge("foosball.beam.mode", "1", m.beam_mode);
    if (m.beam_amb_ua >= 0) w.gaugeD("foosball.beam.ambient", "uA", m.beam_amb_ua);
    if (m.beam_lit1_ua >= 0) w.gaugeD("foosball.beam.lit", "uA", m.beam_lit1_ua);
    if (m.beam_ball_ua >= 0) w.gaugeD("foosball.beam.ball", "uA", m.beam_ball_ua);
    if (m.beam_margin >= 0) w.gaugeD("foosball.beam.margin", "1", m.beam_margin);
  }
  w.gauge("foosball.heap.free", "By", m.free_heap);
  w.gauge("foosball.heap.min_free", "By", m.min_free_heap);
  w.counter("foosball.wakes", "{wake}", m.wakes);
  w.counter("foosball.goals", "{goal}", m.goals);
  w.counter("foosball.beam.rejected_blocks", "{block}", m.rejected_blocks);
  w.counter("foosball.beam.stuck_events", "{event}", m.stuck_events);
  w.counter("foosball.wifi.retries", "{retry}", m.wifi_retries);
  w.counter("foosball.queue.dropped", "{event}", m.queue_dropped);
  w.counter("foosball.log.dropped", "{record}", m.log_dropped);
  std::string s;
  serializeJson(d, s);
  return s;
}

}  // namespace otlp
