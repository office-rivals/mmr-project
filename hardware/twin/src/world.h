#pragma once
// Virtual tables (2 goal counters each) sharing one clock and one HTTP client.
#include <math.h>
#include <stdio.h>

#include <chrono>
#include <memory>
#include <string>
#include <vector>

#include "devices.h"
#include "run.h"

namespace sim {

// Device ids are fb- + 12 hex like a real MAC, but in a range no Espressif MAC uses:
// fb-7477 00 TTTT RR  (TTTT = table number, RR = 01 home goal, 02 away goal).
inline std::string twinId(int table, int role) {
  char b[20];
  snprintf(b, sizeof b, "fb-747700%04x%02x", table, role);
  return b;
}
inline std::string tableId(int table) { return "twin-" + std::to_string(table); }

// How long a rolling ball blocks the beam: the beam's chord through the ball / speed (mm / (m/s) = ms).
// The beam is ~17 mm above the channel floor (INTERFACES §4); a ball of diameter d (range: INTERFACES §0)
// rolls with its centre at d/2. 0 = it passes under the beam.
// ponytail: point beam, no phototransistor edge time (<= ~2 ms); add both if fast-shot limits matter.
constexpr double BEAM_MM = 17;
inline uint32_t blockMs(double ball_mm, double mps) {
  double r = ball_mm / 2, h = BEAM_MM - r;
  return fabs(h) >= r ? 0 : uint32_t(2 * sqrt(r * r - h * h) / mps);
}

struct Table {
  int n;
  double ball_mm = 31;  // the ball in play (range: INTERFACES §0)
  Rng* rng = nullptr;
  std::unique_ptr<GoalDevice> home, away;  // goal device in each goal

  void powerOn() { home->powerOn(), away->powerOn(); }
  void motion() { home->motion(), away->motion(); }  // somebody bumps the table: both feel it
  // A ball into the home goal is a point for the right, and vice versa. Play shakes
  // the table first: a device asleep at that moment wakes and arms its beam before the ball arrives.
  // block_ms 0 = this table's ball at a random speed in the design range, 0.5-3 m/s.
  void goalInto(GoalDevice& g, uint32_t block_ms = 0, int64_t after_ms = 300) {
    if (!block_ms) block_ms = blockMs(ball_mm, 0.5 + (*rng)() % 26 / 10.0);
    motion();
    g.env().clk.after(after_ms, [&g, block_ms] { g.ball(block_ms); });
  }
  // The score as the server accepted it (goals minus undos); left = the team defending the home goal.
  int left() const { return away->link.held("/goal-events") - away->link.held("/undo-events"); }
  int right() const { return home->link.held("/goal-events") - home->link.held("/undo-events"); }
};

struct Settings {
  Endpoints ep;
  double speed = 0;
  uint64_t seed = 1;
  bool verbose = false;
  int64_t start_ms = 0;  // virtual wall clock at t=0 (epoch ms); 0 = real now
  double ball_mm = 31;   // --ball
};

struct World {
  Clock clk;
  net::Http http;
  Env env;
  Runner run{clk, http};
  std::vector<std::unique_ptr<Table>> tables;
  double ball_mm;

  explicit World(const Settings& s) : env{clk, http, s.ep, Rng(s.seed), s.verbose}, ball_mm(s.ball_mm) {
    run.speed = s.speed;
    auto real = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::system_clock::now().time_since_epoch());
    env.nonce = (uint32_t)real.count();
    clk.setEpoch(s.start_ms ? s.start_ms : real.count());
  }

  Table& addTable(int n) {
    auto t = std::make_unique<Table>();
    t->n = n;
    t->ball_mm = ball_mm;
    t->rng = &env.rng;
    t->home = std::make_unique<GoalDevice>(env, twinId(n, 1));
    t->away = std::make_unique<GoalDevice>(env, twinId(n, 2));
    tables.push_back(std::move(t));
    return *tables.back();
  }
};

}  // namespace sim
