#pragma once
// Drives virtual time. Requests in flight freeze it until answered, so a slow server never makes a
// device time out in virtual time unless a scenario injects that. Speed 0 = as fast as possible.
#include <chrono>

#include "http.h"
#include "sim.h"

namespace sim {

struct Runner {
  Clock& clk;
  net::Http& http;
  double speed = 0;  // virtual ms per real ms; 0 = jump

  void runFor(int64_t ms) { runUntil(clk.now() + ms); }

  void runUntil(int64_t until) {
    using Real = std::chrono::steady_clock;
    while (clk.now() < until) {
      // Everything due at this instant runs first, so two devices acting at the same moment hit
      // the server concurrently (e.g. simultaneous goals), not one after the other.
      if (clk.next() <= clk.now()) {
        clk.step(clk.now());
        http.poll(0);
        continue;
      }
      if (!http.idle()) {  // virtual time stands still while a device waits on the server
        http.poll(5);
        continue;
      }
      int64_t t = std::min(clk.next(), until);
      if (speed <= 0) {
        clk.step(t);
        continue;
      }
      // real-time pacing: advance by elapsed real time x speed, at most to t
      auto t0 = Real::now();
      http.poll(std::max<int>(1, std::min<int64_t>(20, (t - clk.now()) / speed)));
      double real = std::chrono::duration<double, std::milli>(Real::now() - t0).count();
      int64_t v = clk.now() + std::max<int64_t>(1, int64_t(real * speed));
      clk.step(std::min(v, t));
    }
  }

  // Run until cond() holds or `max_ms` virtual ms pass; returns cond().
  template <class F>
  bool runUntil(F cond, int64_t max_ms) {
    int64_t end = clk.now() + max_ms;
    while (!cond() && clk.now() < end) runUntil(std::min(end, clk.now() + 100));
    return cond();
  }
};

}  // namespace sim
