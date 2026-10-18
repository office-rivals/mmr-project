#pragma once
#include <stdint.h>

// Goal = beam blocked for >= min_block_ms; counted while still blocked (a slow
// ball may stop in the gate). After a goal the detector re-arms lockout_ms after
// the beam clears; blocks starting before that (ball rolling back) are ignored
// and push the re-arm out again. Feed it every level you see (ISR edges and
// polled samples, duplicates are fine); times are millis() and wrap-safe.
class Detector {
 public:
  uint32_t min_block_ms = 5;
  uint32_t lockout_ms = 1500;
  uint32_t stuck_after_ms = 10000;
  uint32_t rejected = 0;  // blocks that cleared before min_block_ms (glitches), for telemetry

  // Returns true when this sample completes a goal.
  bool update(bool blocked, uint32_t now_ms) {
    // Checked before the edge so a block seen only via its two edges still counts.
    bool goal = pending() && now_ms - since_ >= min_block_ms;
    if (goal) counted_ = locked_ = true;
    if (!goal && !blocked && pending()) rejected++;  // cleared too soon
    if (blocked != blocked_) {
      blocked_ = blocked;
      since_ = now_ms;
      if (blocked) {
        eligible_ = !locked_ || now_ms - cleared_ >= lockout_ms;
        counted_ = false;
      } else if (locked_) {
        locked_ = true;  // lockout runs from the latest clear
        cleared_ = now_ms;
      }
    }
    return goal;
  }

  // Start from the current level without counting it: a ball already sitting in
  // the gate when the beam powers up is not a new goal.
  void reset(bool blocked, uint32_t now_ms) {
    blocked_ = blocked;
    since_ = now_ms;
    eligible_ = counted_ = locked_ = false;
  }

  bool blocked() const { return blocked_; }
  // Blocked and not yet decided: call update() again by since + min_block_ms.
  bool pending() const { return blocked_ && eligible_ && !counted_; }
  uint32_t msUntilDecision(uint32_t now_ms) const {
    uint32_t held = now_ms - since_;
    return held >= min_block_ms ? 0 : min_block_ms - held;
  }
  bool stuck(uint32_t now_ms) const { return blocked_ && now_ms - since_ >= stuck_after_ms; }
  // A goal's lockout is still running (a roll-back may follow): leave the beam alone.
  bool inLockout(uint32_t now_ms) const { return locked_ && !blocked_ && now_ms - cleared_ < lockout_ms; }

 private:
  bool blocked_ = false;
  bool eligible_ = false;
  bool counted_ = false;
  bool locked_ = false;
  uint32_t since_ = 0;
  uint32_t cleared_ = 0;
};
