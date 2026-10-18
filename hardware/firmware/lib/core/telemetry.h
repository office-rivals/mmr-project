#pragma once
// Telemetry that must work hardware-free: the log ring (lives in RTC memory on the device), the
// heartbeat schedule and the battery cutoff. INTERFACES §10; payloads are built in api.*.
#include <stdint.h>
#include <string.h>

#include <initializer_list>

namespace tel {

enum class Level : uint8_t { Debug, Info, Warn, Error };

struct Kv {
  const char* k;
  int32_t v;
};

struct LogEntry {
  uint32_t seq;
  uint32_t wake;      // wake count when logged: groups entries per boot/wake
  uint32_t up_ms;     // millis() in that wake
  int64_t epoch_ms;   // 0 = clock not synced yet
  Level level;
  char tag[8];
  char msg[40];
  uint8_t nkv;
  struct {
    char k[8];
    int32_t v;
  } kv[3];
};

// Fixed-size ring of log entries in caller storage. Plain data, so it survives deep sleep in RTC
// memory; init() clears it when it isn't ours (power-on garbage, or another firmware build).
// Full -> the oldest entry is dropped and counted. Shipped entries are removed with ack().
struct LogRing {
  static constexpr int CAP = 48;  // ~5 KB of the C6's 16 KB LP RAM
  uint32_t magic, build;
  uint32_t first, next;  // pending entries have seq in [first, next)
  uint32_t dropped;      // dropped because the ring was full, since power-on
  LogEntry e[CAP];

  void init(uint32_t build_id) {
    if (magic == MAGIC && build == build_id && next - first <= (uint32_t)CAP) return;
    memset(this, 0, sizeof *this);
    magic = MAGIC;
    build = build_id;
  }

  void add(Level level, const char* tag, const char* msg, std::initializer_list<Kv> kvs, uint32_t wake,
           uint32_t up_ms, int64_t epoch_ms) {
    if (next - first >= (uint32_t)CAP) {
      first++;
      dropped++;
    }
    LogEntry& x = e[next % CAP];
    memset(&x, 0, sizeof x);
    x = {next++, wake, up_ms, epoch_ms, level};
    strncpy(x.tag, tag, sizeof x.tag - 1);
    strncpy(x.msg, msg, sizeof x.msg - 1);
    for (const Kv& kv : kvs) {
      if (x.nkv == 3) break;
      strncpy(x.kv[x.nkv].k, kv.k, sizeof x.kv[0].k - 1);
      x.kv[x.nkv++].v = kv.v;
    }
  }

  uint32_t pending() const { return next - first; }

  // Copies up to `max` of the oldest pending entries; returns how many.
  int peek(LogEntry* out, int max) const {
    int n = 0;
    for (uint32_t s = first; s != next && n < max; s++) out[n++] = e[s % CAP];
    return n;
  }

  // The server has everything up to and including `seq` (entries dropped meanwhile stay dropped).
  void ack(uint32_t seq) {
    uint32_t to = seq + 1;
    if ((int32_t)(to - first) > 0 && (int32_t)(next - to) >= 0) first = to;
  }

 private:
  static constexpr uint32_t MAGIC = 0x4C4F4731;  // "LOG1"
};

// ---- heartbeat (a status POST at least every 24 h, even with no play)

constexpr uint32_t HEARTBEAT_S = 24 * 3600;
constexpr uint32_t HEARTBEAT_RETRY_S = 3600;  // after a failed one: 1 h, 2 h, 4 h ... capped at 24 h
constexpr uint32_t STUCK_RECHECK_S = 60;      // motion pin stuck active: look again this often

// When the next heartbeat is due (RTC seconds), after a status attempt at `now`.
inline uint32_t nextHeartbeat(uint32_t now_s, bool ok, uint32_t failures) {
  if (ok) return now_s + HEARTBEAT_S;
  uint64_t d = (uint64_t)HEARTBEAT_RETRY_S << (failures > 5 ? 5 : failures);
  return now_s + (uint32_t)(d < HEARTBEAT_S ? d : HEARTBEAT_S);
}

// A timer wake within a minute of the deadline counts (the RTC slow clock drifts a little).
inline bool heartbeatDue(uint32_t now_s, uint32_t due_s) { return (int32_t)(due_s - now_s) <= 60; }

// Deep-sleep timer: until the heartbeat, or sooner to re-check a stuck motion pin.
inline uint32_t sleepTimerS(uint32_t now_s, uint32_t due_s, bool stuck_pin) {
  int32_t left = (int32_t)(due_s - now_s);
  uint32_t t = left > 1 ? (uint32_t)left : 1;
  return stuck_pin && t > STUCK_RECHECK_S ? STUCK_RECHECK_S : t;
}

}  // namespace tel

// Low-battery cutoff with hysteresis (electronics: rested NiMH bounces back ~0.1 V/cell, so
// resuming at the cutoff voltage would flap). mv < 0 = not measured: never cut off.
inline bool batteryCutoff(int mv, bool in_cutoff, int cutoff_mv, int resume_mv) {
  if (mv < 0) return false;
  return mv < (in_cutoff ? resume_mv : cutoff_mv);
}
