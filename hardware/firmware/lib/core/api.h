#pragma once
// Everything the REST server sees: paths, payloads, config parsing, response policy.
// openapi.yaml is the contract; change both together (tools/check_openapi.py catches drift).
#include <stdint.h>

#include <string>

#include "beam_health.h"
#include "event_queue.h"

namespace api {

inline std::string configPath(const std::string& device_id) { return "/devices/" + device_id + "/config"; }
inline std::string goalEventsPath() { return "/goal-events"; }
inline std::string undoEventsPath() { return "/undo-events"; }
inline std::string statusPath(const std::string& device_id) { return "/devices/" + device_id + "/status"; }

// What to do with a queued goal event after the server answered `http_code`
// (<= 0 = network error).
enum class Outcome { Done, Drop, Retry };
Outcome classify(int http_code);

struct Config {
  std::string role;      // "goal"; anything else is logged (config_role) and ignored
  std::string table_id;  // empty = unassigned (sent as null)
  std::string goal;
  int32_t config_version = 0;
  uint32_t idle_timeout_s = 300;
  uint32_t min_block_ms = 5;
  uint32_t lockout_ms = 1500;
  uint32_t stuck_after_s = 10;
  float vbat_scale = 0;  // per-device trim of battery_mv, 0 = not sent (the device's own `cal` value in NVS applies)
  int32_t sound_volume = 2;  // the table's sound: 0 off, 1 low, 2 medium, 3 high; missing = 2
  uint32_t undo_window_s = 10;  // the button undoes its own goals this young (server-enforced too)
  int32_t batt_warn_mv = 0, batt_cutoff_mv = 0, batt_resume_mv = 0;  // 0 = board.h LOW_BATT_* (review 2: tunable)
  beam::Cfg beam;            // beam_* (health checks, beam modes)
};

// Fills the keys present in a GET config body; out-of-range values are ignored.
// Returns false (and leaves `out` untouched) if the body isn't a JSON object.
bool parseConfig(const char* json, Config& out);

// battery_mv < 0 means unknown (null). An undo (e.undoes) adds undoes_event_id: POST it to undoEventsPath().
std::string eventId(const std::string& device_id, uint32_t epoch, uint32_t seq);
// The 422 body's "code" of a refused undo (not_yours, too_late, already_undone, closed); "" if none.
std::string refusalCode(const std::string& body);
std::string goalEventJson(const std::string& device_id, const char* fw, const Config& cfg, uint32_t epoch,
                          const Event& e, int battery_mv);
// Status / heartbeat (INTERFACES §10). Counters are since power-on (they live in RTC memory).
struct Status {
  std::string device_id, reason;  // reason: sleep | heartbeat | cutoff | wrong_board
  const char* fw = "";
  uint32_t uptime_ms = 0;
  int battery_mv = -1;  // < 0: null
  bool low_batt = false;
  uint32_t queued_events = 0, dropped_events = 0;
  bool beam_blocked = false;
  // The "beam" object (beam health). Readings < 0 are null (no check yet, or no ADC).
  bool has_beam = false;
  struct Beam {
    const char* health = "ok";
    const char* mode = "a";
    float amb_ua = -1, lit1_ua = -1, margin = -1, ball_ua = -1, base_amb_ua = -1, base_lit1_ua = -1;
    int32_t checked_s = -1;  // seconds since the last check
  } beam;
  // metrics
  std::string reset_reason, config_role;  // config_role: set only when the config's role isn't "goal"
  uint32_t wake_count = 0, goals = 0, short_blocks = 0, stuck_events = 0;
  int32_t wifi_connect_ms = -1, rssi = 0;  // -1 / 0: unknown (null)
  uint32_t wifi_retries = 0, free_heap = 0, min_free_heap = 0, log_dropped = 0;
};
std::string statusJson(const Status& s);


std::string iso8601(int64_t epoch_ms);  // "2026-10-14T19:42:03.512Z"
std::string deviceId(const uint8_t mac[6]);  // "fb-a0b1c2d3e4f5"

}  // namespace api
