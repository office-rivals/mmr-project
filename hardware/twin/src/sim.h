#pragma once
// Virtual time for every simulated device: a discrete-event scheduler. Time only moves when the
// next event is due; run() jumps straight to it (speed 0) or waits real time / speed.
#include <stdint.h>

#include <functional>
#include <queue>
#include <random>
#include <vector>

namespace sim {

class Clock {
 public:
  using Fn = std::function<void()>;

  int64_t now() const { return now_; }  // ms since the twin started
  // Simulated wall clock: what NTP would give a device (ms since 1970).
  int64_t epochMs() const { return epoch0_ + now_; }
  void setEpoch(int64_t epoch0_ms) { epoch0_ = epoch0_ms; }

  void at(int64_t t, Fn fn) { q_.push({t < now_ ? now_ : t, n_++, std::move(fn)}); }
  void after(int64_t ms, Fn fn) { at(now_ + ms, std::move(fn)); }
  bool empty() const { return q_.empty(); }
  int64_t next() const { return q_.empty() ? INT64_MAX : q_.top().t; }

  // Advance to `t` (or the next event, whichever is first) and run what's due. Returns false if
  // nothing was due before `t`.
  bool step(int64_t t) {
    if (q_.empty() || q_.top().t > t) {
      now_ = t;
      return false;
    }
    Ev e = q_.top();
    q_.pop();
    now_ = e.t;
    e.fn();
    return true;
  }

 private:
  struct Ev {
    int64_t t;
    uint64_t n;  // FIFO among equal times: deterministic
    Fn fn;
    bool operator>(const Ev& o) const { return t != o.t ? t > o.t : n > o.n; }
  };
  std::priority_queue<Ev, std::vector<Ev>, std::greater<Ev>> q_;
  int64_t now_ = 0, epoch0_ = 0;  // set by the world (--start)
  uint64_t n_ = 0;
};

using Rng = std::mt19937_64;  // seeded per run (--seed): same seed, same inputs

}  // namespace sim
