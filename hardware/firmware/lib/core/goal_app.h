#pragma once
// The goal counter, hardware-free (the glue: src/goal/main.cpp; the seam: app.h). Per wake: boot
// (battery cutoff, heartbeat, wrong board), config pull, beam detection into the persistent goal
// queue and its delivery, the undo button + buzzer + debug OLED (ux/goal-counter-phase1-2026-10-17.md
// Part B, B5a), telemetry (log ring + OTLP), the end-of-session report (REST status, then OTLP metrics,
// then the remaining logs) and the deep-sleep request.
#include <initializer_list>
#include <string>

#include "api.h"
#include "app.h"
#include "beam_health.h"
#include "detector.h"
#include "event_queue.h"
#include "otlp.h"
#include "telemetry.h"

namespace app {

struct GoalOptions {
  const char* fw = "0.0.0-dev";
  bool stay_associated = true;  // false: Wi-Fi off whenever nothing is in flight (per-goal mode)
  int warn_mv = 3750, cutoff_mv = 3650, resume_mv = 3950;  // board.h LOW_BATT_*; config batt_*_mv overrides
  uint32_t motion_poll_ms = 2000, http_timeout_ms = 5000, retry_min_ms = 5000, retry_max_ms = 300000;
  uint32_t log_export_ms = 60000;  // ship logs at least this often while online (board.h LOG_EXPORT_MS)
  int8_t volume_db[4] = {0, -18, -9, 0};  // config sound_volume 0..3 (0 = off): the gain step (ux)
  int sound_octave = 0;                   // shifts all notes by whole octaves (+1 = up), towards the buzzer's peak
  uint32_t beam_warmup_ms = 50;  // receiver settle time after power-up
  bool led_beam = false;         // bench: LED follows the beam (helps aligning it)
  uint32_t undo_hold_ms = 1000;  // ux B2: a ball or a bump can't hold the button this long
  uint32_t button_stuck_ms = 10000, button_debounce_ms = 30;
  // debug OLED (ux B5/B5a): on for view_ms after a release, an undo result on line 1 for view_undo_ms, line 2
  // cycles the details every view_cycle_ms; after a key wake or a power-on until view_ms past the first server
  // answer (or a failed Wi-Fi), at most view_wake_max_ms
  uint32_t view_ms = 10000, view_undo_ms = 5000, view_wake_max_ms = 30000, view_cycle_ms = 2000;
  // status LED awake (ux/status-led-2026-10-18.md §2): 30 ms blinks 150 ms apart, a group every 2 s
  uint32_t led_blink_ms = 30, led_gap_ms = 150, led_period_ms = 2000;
  int buzzer_max_mv = 5000;  // above this pack voltage (lithium cells) the buzzer duty is scaled down
  // plan C: chopped beam reads every chop_ms once ambient_high held for chop_after_checks checks (0 ms = never)
  uint32_t chop_ms = 3, chop_after_checks = 2;  // round 3: <= 3 ms incl. settling (a ball can block only ~9 ms)
  float chop_frac = 0.5f;
};

class GoalApp {
 public:
  GoalApp(Hal& hal, RtcState& rtc, const GoalOptions& o) : hal_(hal), rtc_(rtc), o_(o), queue_(hal.kv()), mon_(rtc.beam) {}

  void boot(WakeCause cause);
  void response(uint32_t id, int code, const std::string& body);
  uint32_t tick();  // ms until tick() is needed again (events may come sooner); UINT32_MAX = only events
  bool asleep() const { return asleep_; }
  const api::Config& config() const { return cfg_; }
  void beam(bool blocked, uint32_t ms);  // a beam change, timestamped by the glue's ISR
  void button(bool down, uint32_t ms);   // an undo-button change, timestamped by the glue's ISR (bounces too)
  const EventQueue& queue() const { return queue_; }
  const beam::Monitor& beamMonitor() const { return mon_; }
  void command(const std::string& line);  // a line typed on USB serial (assembly: `cal <mV>`)

 private:
  enum class Mode : uint8_t { Active, Final, Report };  // Final: idle -> report -> sleep
  enum class Purpose : uint8_t { None, Config, Status, Metrics, Logs, Event, Note };

  Hal& hal_;
  RtcState& rtc_;
  GoalOptions o_;
  api::Config cfg_;
  Mode mode_ = Mode::Active;
  int batt_mv_ = -1;
  float vbat_gain_ = 1.0f, vbat_off_ = 0;  // the battery trim from `cal` (NVS): mV = raw * gain + offset
  int cal_raw_ = 0, cal_meter_ = 0;        // this session's first `cal` point
  snd::Id held_sound_ = snd::Id::None;     // near the cutoff: a sound waiting for the radio to be quiet
  WakeCause cause_ = WakeCause::PowerOn;
  std::string config_role_;  // the config's role when it isn't "goal"
  int rest_code_ = 0;        // the last REST answer this wake (-1 = no answer), 0 = none yet: the OLED's "srv"

  // network, report, sleep
  struct Inflight {
    uint32_t id = 0;
    Purpose purpose = Purpose::None;
  } inflight_[2];  // by Lane
  uint32_t next_id_ = 1;
  const char* reason_ = "sleep";
  bool cfg_fetched_ = false;
  uint32_t cfg_retry_at_ = 0, backoff_ms_ = 0;
  bool status_sent_ = false, status_ok_ = false, metrics_done_ = false, logs_failed_ = false;
  uint32_t log_at_ = 0, log_retry_at_ = 0, log_sent_upto_ = 0;
  uint32_t wifi_connects_ = 0;
  bool asleep_ = false, usb_ = false;
  const char* note_ = nullptr;  // a status to send mid-session (e.g. "beam": the beam health got worse)
  // buzzer
  snd::Player player_;
  uint32_t tone_hz_ = 0;
  int tone_duty_ = 0;  // 0.01 %

  // goals
  EventQueue queue_;
  Detector det_;
  bool loaded_ = false, powered_ = false, armed_ = false, stuck_ = false, last_failed_ = false;
  uint32_t warm_at_ = 0, last_activity_ = 0, motion_at_ = 0, retry_at_ = 0, rejected_seen_ = 0, idle_ms_ = 300000;
  uint32_t sending_ = 0;  // seq in flight
  Event pend_[4];         // near the cutoff: events held in RAM while the radio is busy (persist)
  int n_pend_ = 0;
  bool chop_ = false;     // plan C: chopped beam reads instead of D8
  uint32_t chop_at_ = 0, amb_checks_ = 0;
  // beam health (beam_health.h)
  beam::Monitor mon_;
  beam::Health health_ = beam::Health::Ok;
  bool beam_adc_ = true;
  uint32_t check_at_ = 0, summary_at_ = 0;
  // undo button: this wake's last goals (RAM: after deep sleep none is inside the window anyway)
  struct Recent {
    uint32_t seq, at;
    bool undone;
  } recent_[4];
  int n_recent_ = 0;
  bool btn_down_ = false, btn_done_ = false, btn_stuck_ = false, sending_undo_ = false;
  uint32_t btn_at_ = 0, btn_up_at_ = 0, first_seq_ = 0;  // first_seq_: queued from this wake on
  // debug OLED (ux B5)
  bool view_on_ = false, view_settle_ = false, undo_bad_ = false;
  uint32_t view_until_ = 0, wake_at_ = 0, view_at_ = 0, undo_until_ = 0;
  const char* undo_msg_ = nullptr;
  StatusView shown_{};
  // status LED
  Led led_ = Led::Off;
  int led_n_ = 0;
  uint32_t led_at_ = 0, led_group_ = 0;

  void log(tel::Level l, const char* tag, const char* msg, std::initializer_list<tel::Kv> kv = {});
  bool laneFree(Lane l) const { return inflight_[(int)l].purpose == Purpose::None; }
  void send(Lane l, Purpose p, const char* method, const std::string& path, const std::string& body);
  int batteryMv();  // pack, vbat_scale applied, -1 unknown
  bool online() const;
  // Deadlines already reached are ignored: every caller acts on a reached deadline in the same tick,
  // and a past one would make tick() return 0 forever (a busy loop: no light sleep).
  static void until(uint32_t& next, uint32_t now, uint32_t deadline);
  uint32_t backoff(bool ok);  // shared retry backoff, returns the delay
  bool drained() const { return (queue_.size() == 0 && !n_pend_) || last_failed_; }  // Final may sleep
  void report(const char* reason);
  void enterFinal(uint32_t now);
  void pump(uint32_t now, uint32_t& next);
  void sendStatus(const char* reason, Purpose p);
  bool sendOtlp(uint32_t now, uint32_t& next);
  bool reportDone() const;
  void sleep();
  bool usb(uint32_t now);
  void logWifi();
  void configChanged();
  // The table's sound (sound_volume; 0 = off), cutting whatever still plays; soundTick each tick.
  void play(snd::Id id, uint32_t now);
  void soundTick(uint32_t now, uint32_t& next);
  void soundOff();

  void load();
  void activate(uint32_t now);
  void active(uint32_t now, uint32_t& next);
  bool restWork(uint32_t now, uint32_t& next);  // send one goal/undo if any
  void eventAnswer(int code, const std::string& body, uint32_t now);
  void sample(bool blocked, uint32_t t, uint32_t now);
  void activity(uint32_t now);
  void beamWork(uint32_t now, uint32_t& next);
  void beamModeChanged();
  void beamHealth();
  void beamSummary(uint32_t now);
  void buttonWork(uint32_t now, uint32_t& next);
  void undo(uint32_t now);
  void undoShown(const char* msg, bool bad, uint32_t now);
  void viewWork(uint32_t now, uint32_t& next);
  StatusView view(uint32_t now);
  bool fault(char (&out)[17]);  // the worst fault's text (B5a order); false = none
  int ledCount();
  bool battLow() const;
  bool persist(uint32_t up, uint32_t undoes, Event* out);
  void flushPending();
  void chopControl(uint32_t now);
  bool chopBlocked();
  std::string margin() const;
  void ledWork(uint32_t now, uint32_t& next);
};

}  // namespace app
