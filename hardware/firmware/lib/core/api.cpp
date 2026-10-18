#include "api.h"

#include <ArduinoJson.h>
#include <math.h>
#include <stdio.h>
#include <time.h>

namespace api {

static void setOrNull(JsonDocument& d, const char* key, const std::string& v) {
  if (v.empty())
    d[key] = nullptr;
  else
    d[key] = v;
}

static void setBattery(JsonDocument& d, int mv) {
  if (mv < 0)
    d["battery_mv"] = nullptr;
  else
    d["battery_mv"] = mv;
}

template <typename T>
static void readRange(JsonObject o, const char* key, T& out, T lo, T hi) {
  JsonVariant v = o[key];
  if (!v.is<int64_t>()) return;
  int64_t x = v.as<int64_t>();
  if (x >= (int64_t)lo && x <= (int64_t)hi) out = (T)x;
}

template <typename T>
static void readFloat(JsonObject o, const char* key, T& out, float lo, float hi) {
  JsonVariant v = o[key];
  if (!v.is<float>()) return;
  float x = v.as<float>();
  if (x >= lo && x <= hi) out = x;
}

static void readBeam(JsonObject o, beam::Cfg& b) {
  if (o["beam_mode"].is<const char*>()) beam::parseMode(o["beam_mode"].as<const char*>(), b.mode);
  if (o["beam_check_s"].is<int64_t>() && o["beam_check_s"].as<int64_t>() == 0)
    b.check_s = 0;
  else
    readRange<uint32_t>(o, "beam_check_s", b.check_s, 10, 3600);
  readRange<uint32_t>(o, "beam_settle_ms", b.settle_ms, 1, 20);
  readFloat(o, "beam_ambient_max_pct", b.ambient_max_pct, 1, 100);
  readFloat(o, "beam_margin_min", b.margin_min, 1, 20);
  readFloat(o, "beam_drift_pct", b.drift_pct, 0, 100);
  readFloat(o, "beam_dead_delta_ua", b.dead_delta_ua, 0, 1000);
  readRange<uint32_t>(o, "beam_dead_checks", b.dead_checks, 1, 100);
  readRange<uint32_t>(o, "beam_baseline_min", b.baseline_min, 0, 1440);
  readRange<uint32_t>(o, "beam_report_s", b.report_s, 60, 86400);
  readFloat(o, "beam_ambient_switch_ua", b.switch_ua, 0, 100);
  readFloat(o, "beam_ambient_return_ua", b.return_ua, 0, 100);
  readRange<uint32_t>(o, "beam_mode_min_dwell_s", b.dwell_s, 0, 86400);
  readFloat(o, "beam_r_pu_a_ohm", b.r_pu_a, 1000, 10000000);
  readFloat(o, "beam_r_pu_b_ohm", b.r_pu_b, 1000, 10000000);
  JsonArray led = o["beam_led_ma"];
  if (led.size() == 2 && led[0].is<float>() && led[1].is<float>()) {
    float a = led[0], x = led[1];
    if (a >= 0.1f && a <= 20 && x >= 0.1f && x <= 20) b.led_ma[0] = a, b.led_ma[1] = x;
  }
}

Outcome classify(int c) {
  if ((c >= 200 && c < 300) || c == 409) return Outcome::Done;
  if (c == 400 || c == 404 || c == 410 || c == 422) return Outcome::Drop;
  return Outcome::Retry;  // network, 5xx, 408, 429, 401/403 (fixable token), anything unexpected
}

bool parseConfig(const char* json, Config& out) {
  JsonDocument d;
  if (deserializeJson(d, json) || !d.is<JsonObject>()) return false;
  JsonObject o = d.as<JsonObject>();
  Config c = out;
  if (o["role"].is<const char*>()) c.role = o["role"].as<const char*>();
  if (o["table_id"].is<const char*>()) c.table_id = o["table_id"].as<const char*>();
  if (o["goal"].is<const char*>()) c.goal = o["goal"].as<const char*>();
  readRange<int32_t>(o, "config_version", c.config_version, 0, INT32_MAX);
  readRange<uint32_t>(o, "idle_timeout_s", c.idle_timeout_s, 30, 86400);
  readRange<uint32_t>(o, "undo_window_s", c.undo_window_s, 1, 300);
  readRange<int32_t>(o, "batt_warn_mv", c.batt_warn_mv, 3000, 5000);
  readRange<int32_t>(o, "batt_cutoff_mv", c.batt_cutoff_mv, 3000, 5000);
  readRange<int32_t>(o, "batt_resume_mv", c.batt_resume_mv, 3000, 5000);
  readRange<uint32_t>(o, "min_block_ms", c.min_block_ms, 1, 1000);
  readRange<uint32_t>(o, "lockout_ms", c.lockout_ms, 0, 60000);
  readRange<uint32_t>(o, "stuck_after_s", c.stuck_after_s, 1, 3600);
  c.sound_volume = 2;  // missing means medium, not "whatever the last config said"
  readRange<int32_t>(o, "sound_volume", c.sound_volume, 0, 3);
  if (o["vbat_scale"].is<float>()) {
    float v = o["vbat_scale"].as<float>();
    if (v >= 0.8f && v <= 1.2f) c.vbat_scale = v;
  }
  readBeam(o, c.beam);
  out = c;
  return true;
}

std::string goalEventJson(const std::string& device_id, const char* fw, const Config& cfg, uint32_t epoch,
                          const Event& e, int battery_mv) {
  JsonDocument d;
  d["event_id"] = eventId(device_id, epoch, e.seq);
  d["device_id"] = device_id;
  d["seq"] = e.seq;
  if (e.epoch_ms > 0)
    d["occurred_at"] = iso8601(e.epoch_ms);
  else
    d["occurred_at"] = nullptr;
  d["uptime_ms"] = e.uptime_ms;
  setOrNull(d, "table_id", cfg.table_id);
  setOrNull(d, "goal", cfg.goal);
  if (e.undoes) d["undoes_event_id"] = eventId(device_id, epoch, e.undoes - 1);
  setBattery(d, battery_mv);
  d["firmware_version"] = fw;
  std::string s;
  serializeJson(d, s);
  return s;
}

std::string eventId(const std::string& device_id, uint32_t epoch, uint32_t seq) {
  char id[48];
  snprintf(id, sizeof id, "%s-%08x-%u", device_id.c_str(), (unsigned)epoch, (unsigned)seq);
  return id;
}

std::string refusalCode(const std::string& body) {
  JsonDocument d;
  if (deserializeJson(d, body) || !d["code"].is<const char*>()) return "";
  return d["code"].as<std::string>();
}

std::string statusJson(const Status& st) {
  JsonDocument d;
  d["device_id"] = st.device_id;
  d["role"] = "goal";
  d["reason"] = st.reason;
  setBattery(d, st.battery_mv);
  d["firmware_version"] = st.fw;
  d["uptime_ms"] = st.uptime_ms;
  d["queued_events"] = st.queued_events;
  d["dropped_events"] = st.dropped_events;
  d["beam_blocked"] = st.beam_blocked;
  if (st.has_beam) {
    JsonObject b = d["beam"].to<JsonObject>();
    b["health"] = st.beam.health;
    b["mode"] = st.beam.mode;
    auto num = [&](const char* k, float v) {  // 2 decimals; < 0 = null
      if (v < 0)
        b[k] = nullptr;
      else
        b[k] = roundf(v * 100) / 100;
    };
    num("amb_ua", st.beam.amb_ua);
    num("lit1_ua", st.beam.lit1_ua);
    num("margin", st.beam.margin);
    num("ball_ua", st.beam.ball_ua);
    num("baseline_amb_ua", st.beam.base_amb_ua);
    num("baseline_lit1_ua", st.beam.base_lit1_ua);
    if (st.beam.checked_s < 0)
      b["checked_s"] = nullptr;
    else
      b["checked_s"] = st.beam.checked_s;
  }
  d["low_batt"] = st.low_batt;
  JsonObject m = d["metrics"].to<JsonObject>();
  m["reset_reason"] = st.reset_reason;
  if (st.config_role.empty())
    m["config_role"] = nullptr;
  else
    m["config_role"] = st.config_role;
  m["wake_count"] = st.wake_count;
  m["goals"] = st.goals;
  m["short_blocks"] = st.short_blocks;
  m["stuck_events"] = st.stuck_events;
  if (st.wifi_connect_ms < 0)
    m["wifi_connect_ms"] = nullptr;
  else
    m["wifi_connect_ms"] = st.wifi_connect_ms;
  if (st.rssi == 0)
    m["rssi"] = nullptr;
  else
    m["rssi"] = st.rssi;
  m["wifi_retries"] = st.wifi_retries;
  m["free_heap"] = st.free_heap;
  m["min_free_heap"] = st.min_free_heap;
  m["log_dropped"] = st.log_dropped;
  std::string s;
  serializeJson(d, s);
  return s;
}

std::string iso8601(int64_t epoch_ms) {
  time_t secs = (time_t)(epoch_ms / 1000);
  struct tm t;
  gmtime_r(&secs, &t);
  char buf[32];
  snprintf(buf, sizeof buf, "%04d-%02d-%02dT%02d:%02d:%02d.%03dZ", t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
           t.tm_hour, t.tm_min, t.tm_sec, (int)(epoch_ms % 1000));
  return buf;
}

std::string deviceId(const uint8_t mac[6]) {
  char buf[16];
  snprintf(buf, sizeof buf, "fb-%02x%02x%02x%02x%02x%02x", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return buf;
}

}  // namespace api
