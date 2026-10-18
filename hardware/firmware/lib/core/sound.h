#pragma once
// The buzzer's sounds (ux/sounds.py BUZZER; when each plays: ux/goal-counter-phase1-2026-10-17.md B2),
// played without blocking: the app calls Player::tick() and sets the buzzer to the returned pitch and
// level (Hal::tone).
#include <math.h>
#include <stddef.h>
#include <stdint.h>

namespace snd {

enum class Id : uint8_t { Goal, Undo, Scan, NotJoined, None };  // None = stop
inline constexpr const char* NAMES[] = {"goal", "undo", "scan", "not joined"};

// ux: "hold" = steady; "hit" = falls to -30 dB by its end.
enum class Shape : uint8_t { Hold, Hit };

struct Note {
  uint16_t hz;  // 0 = rest
  uint16_t ms;
  int16_t db10 = 0;  // the note's level, 0.1 dB
  Shape shape = Shape::Hold;
};

struct Sound {
  const Note* notes = nullptr;
  size_t n = 0;
  int16_t level10 = 0;  // the whole sound's level, 0.1 dB
};

// ux's BUZZER table (from ux/sounds.py): legato notes {Hz, ms, note dB x10, shape}, each sound's level (dB x10).
inline constexpr Note B_GOAL[] = {{1760, 60, -20, Shape::Hold}, {2349, 160, 0, Shape::Hit}};
inline constexpr Note B_UNDO[] = {{2349, 100, 0, Shape::Hold}, {1760, 200, -20, Shape::Hit}};
inline constexpr Note B_SCAN[] = {{2349, 30, 0, Shape::Hit}};
inline constexpr Note B_NOT_JOINED[] = {{1319, 140, 0, Shape::Hit}};
inline constexpr Sound BUZZER[] = {{B_GOAL, 2, 0}, {B_UNDO, 2, -40}, {B_SCAN, 1, -100}, {B_NOT_JOINED, 1, -80}};  // by Id

inline Sound buzzer(Id id) { return id < Id::None ? BUZZER[(int)id] : Sound{}; }

constexpr uint32_t RAMP_MS = 5;  // ux: the first note fades in, the last one out (no click)

// Whole octaves up (+) or down (-): moves a sound towards the buzzer's loudest frequency.
constexpr uint32_t shift(uint32_t hz, int octaves) { return octaves >= 0 ? hz << octaves : hz >> -octaves; }

// Square-wave duty for an amplitude (1 = full): the fundamental scales with sin(pi * duty), so 1 -> 50 %.
inline float duty(float amp) { return asinf(amp < 1 ? amp : 1) / (float)M_PI; }

class Player {
 public:
  void play(Sound s, uint32_t now) {  // replaces whatever is playing
    s_ = s, i_ = 0, at_ = now;
  }
  void stop() { s_ = {}; }
  bool playing() const { return i_ < s_.n; }

  // Pitch now (0 = silent), its amplitude (1 = 0 dB, before the volume step) and ms until either
  // changes (UINT32_MAX = nothing playing; 1 while an envelope moves). Notes are legato (back to
  // back). Late calls skip notes whose time has passed; times are millis() and wrap-safe.
  uint16_t tick(uint32_t now, uint32_t& next_ms, float& amp) {
    while (playing() && now - at_ >= s_.notes[i_].ms) at_ += s_.notes[i_++].ms;
    amp = 0;
    if (!playing()) {
      next_ms = UINT32_MAX;
      return 0;
    }
    const Note& n = s_.notes[i_];
    uint32_t t = now - at_, left = n.ms - t;
    float db = (s_.level10 + n.db10) / 10.0f;
    if (n.shape == Shape::Hit) db -= 30.0f * t / n.ms;
    amp = powf(10, db / 20);
    bool first = i_ == 0, last = i_ + 1 == s_.n;
    if (first && t < RAMP_MS) amp *= (t + 1) / (float)RAMP_MS;
    if (last && left <= RAMP_MS) amp *= left / (float)(RAMP_MS + 1);
    bool moving = n.shape != Shape::Hold || (first && t < RAMP_MS) || (last && left <= RAMP_MS + 1);
    next_ms = moving ? 1 : last ? left - RAMP_MS - 1 : left;
    return n.hz;
  }

 private:
  Sound s_;
  size_t i_ = 0;
  uint32_t at_ = 0;
};

}  // namespace snd
