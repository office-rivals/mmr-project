#include "beam_health.h"

#include <math.h>
#include <string.h>

namespace beam {

static const char* MODES[] = {"a", "a_boost", "b", "auto"};
static const char* HEALTH[] = {"ok", "low_margin", "ambient_high", "blocked", "sensor_dead"};
const char* name(Mode m) { return MODES[(int)m]; }
const char* name(Health h) { return HEALTH[(int)h]; }
bool parseMode(const char* s, Mode& out) {
  for (int i = 0; i < 4; i++)
    if (!strcmp(s, MODES[i])) return out = (Mode)i, true;
  return false;
}

float pullup(const Cfg& c, Mode m) { return m == Mode::B ? 1 / (1 / c.r_pu_a + 1 / c.r_pu_b) : c.r_pu_a; }
float needUa(const Cfg& c, Mode m) { return (VDD_MV - VIL_MV) / pullup(c, m) * 1000; }
float tolUa(const Cfg& c, Mode m) { return (VDD_MV - VIH_MV) / pullup(c, m) * 1000; }
static float ua(int mv, float ohm) { return mv < 0 ? -1 : fmaxf(0, VDD_MV - mv) / ohm * 1000; }
static float ledMa(const Cfg& c, Mode m) { return m == Mode::A ? c.led_ma[0] : c.led_ma[0] + c.led_ma[1]; }

// Light at the mode's LED current over what "lit" needs; lit1 was read at led_ma[0].
float Monitor::marginOf(const Cfg& c, Mode m) const {
  return lit1_ua < 0 ? -1 : lit1_ua * ledMa(c, m) / c.led_ma[0] / needUa(c, m);
}

void Monitor::enter(Mode m, uint32_t now_s, const char* reason) {
  p_.active = m;
  p_.mode_since_s = now_s;
  p_.b_trial = m == Mode::B && reason != nullptr;
  why = reason ? reason : "config";
}

bool Monitor::setManual(const Cfg& c, uint32_t now_s) {
  Mode m = c.mode == Mode::Auto ? p_.active : c.mode;
  if (m == p_.active) return false;
  enter(m, now_s, nullptr);
  return true;
}

bool Monitor::check(const Reading& r, const Cfg& c, uint32_t now_s) {
  float both = pullup(c, Mode::B);
  amb_ua = ua(r.amb_mv, pullup(c, p_.active));
  float zero = r.amb20_mv >= 0 ? ua(r.amb20_mv, both) : fmaxf(0, amb_ua);
  lit1_ua = r.lit1_mv < 0 ? -1 : fmaxf(0, ua(r.lit1_mv, both) - zero);
  margin = marginOf(c, p_.active);
  checked_s = now_s;
  amb_max_ua = fmaxf(amb_max_ua, amb_ua);
  // The LED doesn't move the node at 52 k: a C-E short (stuck at 0 V) or a dead receiver. Light in the
  // drawer moves only the LED-off reading, so it never looks like this.
  dead_run = lit1_ua >= 0 && lit1_ua < c.dead_delta_ua ? dead_run + 1 : 0;

  // Baselines: an EWMA in real time (deep sleep included), so they follow the day, not one reading.
  drift_low = p_.have && c.drift_pct > 0 && lit1_ua >= 0 && lit1_ua < p_.base_lit1_ua * (1 - c.drift_pct / 100);
  if (amb_ua >= 0 && lit1_ua >= 0) {
    float a = !p_.have || !c.baseline_min ? 1 : 1 - expf(-(float)(now_s - p_.last_s) / (c.baseline_min * 60.0f));
    p_.base_amb_ua += a * (amb_ua - p_.base_amb_ua);
    p_.base_lit1_ua += a * (lit1_ua - p_.base_lit1_ua);
    p_.have = true;
    p_.last_s = now_s;
  }

  if (c.mode != Mode::Auto) return setManual(c, now_s);
  Mode m = p_.active;
  if (m == Mode::B && p_.b_trial) {  // B's lit margin is thin (~2.4x typ): prove it before staying
    p_.b_trial = false;
    if (margin < c.margin_min) {  // back, but to A+ when A's own margin is short too (twin, review 2 parts)
      p_.hold_until_s = now_s + c.dwell_s;
      enter(marginOf(c, Mode::A) < c.margin_min ? Mode::ABoost : Mode::A, now_s, "b: margin too low");
      return true;
    }
  }
  if (now_s - p_.mode_since_s < c.dwell_s || (int32_t)(now_s - p_.hold_until_s) < 0 || !p_.have) return false;
  if (m != Mode::B && p_.base_amb_ua > c.switch_ua)
    enter(Mode::B, now_s, "ambient");
  else if (m == Mode::B && p_.base_amb_ua < c.return_ua)
    enter(Mode::A, now_s, "dark again");
  else if (m == Mode::A && margin >= 0 && margin < c.margin_min)
    enter(Mode::ABoost, now_s, "low margin");
  else if (m == Mode::ABoost && marginOf(c, Mode::A) >= 2 * c.margin_min)
    enter(Mode::A, now_s, "margin back");
  return p_.active != m;
}

void Monitor::ball(int mv, const Cfg& c) { ball_ua = fmaxf(ball_ua, ua(mv, pullup(c, p_.active))); }

bool Monitor::blockedInB(const Cfg& c, uint32_t now_s) {
  if (c.mode != Mode::Auto || p_.active != Mode::B) return false;
  p_.hold_until_s = now_s + c.dwell_s;
  enter(Mode::A, now_s, "b: beam blocked");
  return true;
}

Health Monitor::health(bool stuck, const Cfg& c, uint32_t now_s) const {
  if (dead_run >= c.dead_checks) return Health::SensorDead;
  if (stuck) return Health::Blocked;
  bool failed_b = c.mode == Mode::Auto && (int32_t)(p_.hold_until_s - now_s) > 0;  // B couldn't be used
  if (failed_b) return Health::AmbientHigh;
  // Auto: ambient only counts once auto has moved to B (it may still be on its way). Not while the LED
  // moves nothing: then the "ambient" is the fault itself (a short reads as 15 µA in A), not light.
  if ((c.mode != Mode::Auto || p_.active == Mode::B) && !dead_run) {
    float tol = tolUa(c, p_.active) * c.ambient_max_pct / 100;
    if (amb_ua > tol || ball_ua > tol) return Health::AmbientHigh;
  }
  if ((margin >= 0 && margin < c.margin_min) || drift_low) return Health::LowMargin;
  return Health::Ok;
}

}  // namespace beam
