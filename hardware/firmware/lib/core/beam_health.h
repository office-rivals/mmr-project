#pragma once
// Goal-counter beam health and beam modes (electronics/beam-health-2026-10-16.md §2-§3, the circuit;
// firmware/beam-health-firmware-2026-10-16.md, the check, states and config). Hardware-free: the glue
// takes the readings (beamCheck), this turns them into light in µA, tracks the day's baselines, runs
// the auto mode and names the health state. Counting stays on D8 (Detector), untouched.
#include <stdint.h>

namespace beam {

enum class Mode : uint8_t { A, ABoost, B, Auto };  // electronics' A / A+ / B; the active mode is never Auto
enum class Health : uint8_t { Ok, LowMargin, AmbientHigh, Blocked, SensorDead };  // higher = worse
const char* name(Mode m);    // "a", "a_boost", "b", "auto" (config and status values)
const char* name(Health h);  // "ok", "low_margin", "ambient_high", "blocked", "sensor_dead"
bool parseMode(const char* s, Mode& out);

// Server config (DeviceConfig beam_*). Defaults are EST until the bench (firmware proposal §6).
struct Cfg {
  Mode mode = Mode::A;
  uint32_t check_s = 60;     // 0 = no checks (and no auto)
  uint32_t settle_ms = 3;    // after each LED / pull-up change
  float ambient_max_pct = 60, margin_min = 2.0f, drift_pct = 30, dead_delta_ua = 2.0f;
  uint32_t dead_checks = 3, baseline_min = 120, report_s = 600;
  float switch_ua = 1.5f, return_ua = 0.75f;  // auto: A -> B above, B -> A below (ambient baseline)
  uint32_t dwell_s = 300;
  float r_pu_a = 220000, r_pu_b = 68000;      // fitted pull-ups (Ω): R_PU on D3, R_PU_B on D6 (review 2: 68 k)
  float led_ma[2] = {1.0f, 5.3f};             // LED current from D9, and the boost from D10 (review 2: 270 Ω)
};

// One health check, node millivolts from the ADC on D2 (-1 = no reading).
struct Reading {
  int amb_mv = -1;    // LED off, the active mode's pull-ups: ambient light alone
  int lit1_mv = -1;   // LED 1 mA (D9 only), both pull-ups (linear range): the margin reading
  int amb20_mv = -1;  // LED off, both pull-ups: lit1's own zero. LED on vs off at the same 52 k is what
                      // tells a C-E short (no change, node at 0 V) from drawer light (twin, 2026-10-16)
};

// Kept in RTC memory: the day's baselines and the auto mode survive deep sleep. Zero = mode A, nothing yet.
struct Persist {
  Mode active;
  bool have;     // baselines are set
  bool b_trial;  // auto just moved to B: the next check must show the margin
  Health noted;  // the health last sent to the server (status reason "beam"), across wakes
  uint32_t noted_s;
  uint32_t mode_since_s, hold_until_s, last_s;
  float base_amb_ua, base_lit1_ua;
};

constexpr float VDD_MV = 3300, VIL_MV = 825, VIH_MV = 2475;  // C6 input thresholds at the 3.3 V rail

float pullup(const Cfg& c, Mode m);   // Ω: B has both pull-ups in parallel
float needUa(const Cfg& c, Mode m);   // light current for a clean "lit"
float tolUa(const Cfg& c, Mode m);    // ambient that still lets a ball read blocked

class Monitor {
 public:
  explicit Monitor(Persist& p) : p_(p) {}
  Mode active() const { return p_.active; }
  // A check's readings. Returns true when the active mode changed (the glue then switches the pins).
  bool check(const Reading& r, const Cfg& c, uint32_t now_s);
  void ball(int mv, const Cfg& c);                   // the node during a counted goal
  bool blockedInB(const Cfg& c, uint32_t now_s);     // auto: the beam stuck in B -> back to A
  bool setManual(const Cfg& c, uint32_t now_s);      // a manual mode from config; true if it changed
  Health health(bool stuck, const Cfg& c, uint32_t now_s) const;
  void newWindow() { amb_max_ua = ball_ua = -1; }   // after each summary record

  // The last check (this wake). < 0 = none yet.
  float amb_ua = -1, lit1_ua = -1, margin = -1;
  float ball_ua = -1, amb_max_ua = -1;  // the worst since the last summary record
  uint32_t dead_run = 0, checked_s = 0;
  bool drift_low = false;
  const char* why = "";  // the reason for the last mode change
  const Persist& persist() const { return p_; }

 private:
  Persist& p_;
  float marginOf(const Cfg& c, Mode m) const;
  void enter(Mode m, uint32_t now_s, const char* reason);
};

}  // namespace beam
