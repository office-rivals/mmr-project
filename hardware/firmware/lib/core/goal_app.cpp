#include "goal_app.h"

#include <math.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>


namespace app {

static constexpr uint32_t OTLP_BATCH = 16;

static int mv(int32_t config, int option) { return config > 0 ? config : option; }  // a config value, else board.h

static const char* causeName(WakeCause c) {
  static const char* n[] = {"poweron", "motion", "key", "timer", "usb"};
  return n[(int)c];
}

void GoalApp::log(tel::Level l, const char* tag, const char* msg, std::initializer_list<tel::Kv> kv) {
  rtc_.log.add(l, tag, msg, kv, rtc_.wake_count, hal_.millis(), hal_.epochMs());
  std::string line = std::string("[") + tag + "] " + msg;
  for (const tel::Kv& x : kv) line += std::string(" ") + x.k + "=" + std::to_string(x.v);
  hal_.print(line);
}

void GoalApp::send(Lane l, Purpose p, const char* method, const std::string& path, const std::string& body) {
  uint32_t id = next_id_++;
  inflight_[(int)l] = {id, p};
  hal_.send(id, l, method, path, body, o_.http_timeout_ms);
}

int GoalApp::batteryMv() {
  if (hal_.usbPowered()) return -1;  // review 2 O-S6: on USB the charger's leak through D1 fakes a pack
  int mv = hal_.batteryMv();
  if (mv < 0) return -1;
  return cfg_.vbat_scale > 0 ? (int)(mv * cfg_.vbat_scale + 0.5f) : (int)lroundf(mv * vbat_gain_ + vbat_off_);
}

// USB serial commands (assembly). `cal <mV>`: the pack's voltage from a meter, at two voltages (round 3: a
// bench supply on J_BAT, e.g. 3.6 and 4.5 V). The first point stores a scale (meter / raw), the second a gain +
// offset through both. Kept in NVS: no server needed; a config vbat_scale wins if one is ever sent.
void GoalApp::command(const std::string& line) {
  int meter = 0;
  if (sscanf(line.c_str(), "cal %d", &meter) != 1) return hal_.print("commands: cal <pack mV from a meter> (twice)");
  int raw = hal_.batteryMv();  // raw, also on USB: calibrate with the pack in
  char msg[96];
  float gain, off = 0;
  if (cal_raw_ > 0 && abs(raw - cal_raw_) >= 300) {  // the second point
    gain = (float)(meter - cal_meter_) / (raw - cal_raw_);
    off = meter - gain * raw;
  } else {
    gain = raw > 0 ? (float)meter / raw : 0;
    cal_raw_ = raw, cal_meter_ = meter;
  }
  if (gain < 0.8f || gain > 1.2f || fabsf(off) > 300) {
    cal_raw_ = 0;
    snprintf(msg, sizeof msg, "cal: not saved (raw %d mV -> gain %.3f, offset %d mV: outside 0.8-1.2 / 300)", raw,
             gain, (int)off);
    return hal_.print(msg);
  }
  vbat_gain_ = gain, vbat_off_ = off;
  bool ok = hal_.kv().setU32("vbat_cal", (uint32_t)lroundf(gain * 10000)) &&
            hal_.kv().setU32("vbat_off", (uint32_t)(int32_t)lroundf(off));
  snprintf(msg, sizeof msg, "cal: raw %d mV, meter %d mV -> gain %.4f offset %+d mV%s%s", raw, meter, gain, (int)off,
           ok ? " saved" : " NOT saved", off == 0 ? " (now a 2nd point >= 0.3 V away)" : "");
  hal_.print(msg);
  log(tel::Level::Info, "batt", "calibrated", {{"raw_mv", raw}, {"meter_mv", meter}, {"off_mv", (int32_t)off}});
}

bool GoalApp::online() const {
  if (!o_.stay_associated) return !laneFree(Lane::Rest);  // per-goal: only during a REST session
  return hal_.wifiStats().connects > 0;
}

// Deadlines already reached are ignored: every caller acts on a reached deadline in the same tick,
// and a past one would make tick() return 0 forever (a busy loop: no light sleep).
void GoalApp::until(uint32_t& next, uint32_t now, uint32_t deadline) {
  int32_t left = (int32_t)(deadline - now);
  if (left > 0 && (uint32_t)left < next) next = left;
}

uint32_t GoalApp::backoff(bool ok) {
  backoff_ms_ = ok || !backoff_ms_ ? o_.retry_min_ms : (backoff_ms_ * 2 > o_.retry_max_ms ? o_.retry_max_ms : backoff_ms_ * 2);
  return ok ? 0 : backoff_ms_;
}

// ---- the buzzer (ux/SOUNDS-V2.md, phase 1 Part B)

void GoalApp::play(snd::Id id, uint32_t now) {
  if (cfg_.sound_volume <= 0) return;  // muted from the admin UI ("Table sound: Off")
  if (battLow() && !(laneFree(Lane::Rest) && laneFree(Lane::Otlp))) {  // round 3: near the cutoff never with a TX
    held_sound_ = id;  // the latest wins; it plays when the radio is quiet (pump)
    return;
  }
  player_.play(snd::buzzer(id), now);  // cuts off whatever is still playing
  log(tel::Level::Info, "sound", snd::NAMES[(int)id], {{"volume", cfg_.sound_volume}});
}

void GoalApp::soundTick(uint32_t now, uint32_t& next) {
  uint32_t sound_ms;
  float amp;
  uint32_t hz = player_.tick(now, sound_ms, amp);  // ux: duty = asin(10^(dB/20)) / pi, dB incl. the volume step
  int duty = hz ? (int)lroundf(snd::duty(amp * powf(10, o_.volume_db[cfg_.sound_volume] / 20.0f)) * 10000) : 0;
  if (batt_mv_ > o_.buzzer_max_mv)  // review 2: lithium cells (5.4 V) would over-drive the coil; power ~ V²
    duty = (int)(duty * powf((float)o_.buzzer_max_mv / batt_mv_, 2));
  if (hz != tone_hz_ || duty != tone_duty_) {
    tone_hz_ = hz, tone_duty_ = duty;
    hal_.tone(snd::shift(hz, o_.sound_octave), duty);
  }
  if (sound_ms != UINT32_MAX) until(next, now, now + sound_ms);
}

void GoalApp::soundOff() {
  player_.stop();
  if (tone_hz_) hal_.tone(tone_hz_ = 0, tone_duty_ = 0);
}

// ---- boot

void GoalApp::boot(WakeCause cause) {
  rtc_.wake_count++;
  cause_ = cause;
  led_at_ = hal_.millis();
  if (std::string cached; hal_.kv().getStr("cfg", cached)) api::parseConfig(cached.c_str(), cfg_);
  if (uint32_t c; hal_.kv().getU32("vbat_cal", c) && c >= 8000 && c <= 12000) vbat_gain_ = c / 10000.0f;
  if (uint32_t o; hal_.kv().getU32("vbat_off", o) && abs((int32_t)o) <= 300) vbat_off_ = (int32_t)o;
  batt_mv_ = batteryMv();  // radio still off
  hal_.wifiTxLow(battLow());  // round 3: near the cutoff a smaller TX burst (RSSI in the metrics shows the cost)
  log(tel::Level::Info, "boot", causeName(cause), {{"wake", (int32_t)rtc_.wake_count}, {"mv", batt_mv_}});

  if (usb(hal_.millis())) {  // USB-powered: the pack doesn't matter, nothing sleeps; work normally
    hal_.boardInit();
    return activate(hal_.millis());
  }
  bool cutoff = batteryCutoff(batt_mv_, rtc_.cutoff, mv(cfg_.batt_cutoff_mv, o_.cutoff_mv), mv(cfg_.batt_resume_mv, o_.resume_mv));
  if (cutoff && rtc_.cutoff) {  // already reported: only re-measure, no radio, no flash writes
    log(tel::Level::Debug, "batt", "still below cutoff", {{"mv", batt_mv_}});
    reason_ = "";
    return sleep();
  }
  if (cutoff) {
    rtc_.cutoff = true;
    log(tel::Level::Warn, "batt", "cutoff", {{"mv", batt_mv_}});
    hal_.boardInit();  // right board: pins in a defined state
    return report("cutoff");
  }
  rtc_.cutoff = false;

  uint32_t now_s = hal_.rtcSeconds();
  if (cause == WakeCause::Timer) {
    if (!tel::heartbeatDue(now_s, rtc_.heartbeat_due_s)) {  // stuck-pin re-check etc.
      reason_ = "";
      return sleep();
    }
    return report("heartbeat");
  }
  hal_.boardInit();
  activate(hal_.millis());
}

void GoalApp::report(const char* reason) {
  mode_ = Mode::Report;
  reason_ = reason;
  status_sent_ = metrics_done_ = logs_failed_ = false;
}

void GoalApp::enterFinal(uint32_t now) {
  if (mode_ != Mode::Active) return;
  mode_ = Mode::Final;
  reason_ = "sleep";
  status_sent_ = metrics_done_ = logs_failed_ = false;
  batt_mv_ = batteryMv();  // nothing is being transmitted at this instant
  hal_.wifiTxLow(battLow());
  log(tel::Level::Info, "power", "idle, reporting before sleep", {{"mv", batt_mv_}});
}

// ---- network

void GoalApp::response(uint32_t id, int code, const std::string& body) {
  uint32_t now = hal_.millis();
  for (Inflight& f : inflight_) {
    if (f.id != id || f.purpose == Purpose::None) continue;
    Purpose p = f.purpose;
    f = {};
    if (p != Purpose::Metrics && p != Purpose::Logs) rest_code_ = code ? code : -1;
    switch (p) {
      case Purpose::Config:
        if (code == 404) {  // not assigned: forget table/goal, keep working with defaults
          cfg_ = api::Config{};
          hal_.kv().remove("cfg");
          cfg_fetched_ = true;
          log(tel::Level::Warn, "config", "not assigned (404)");
          configChanged();  // defaults
          break;
        } else if (api::Config fresh; code == 200 && api::parseConfig(body.c_str(), fresh)) {
          cfg_ = fresh;  // keys left out fall back to defaults, not to the old cache
          hal_.kv().setStr("cfg", body);
          cfg_fetched_ = true;
          config_role_ = !cfg_.role.empty() && cfg_.role != "goal" ? cfg_.role : "";
          if (!config_role_.empty())
            log(tel::Level::Warn, "config", "role in config differs from this board; keeping the board's");
          log(tel::Level::Info, "config", "pulled", {{"version", cfg_.config_version}});
        } else {
          cfg_retry_at_ = now + backoff(false);
          log(tel::Level::Warn, "config", "pull failed", {{"code", code}});
          break;
        }
        configChanged();
        break;
      case Purpose::Status:
        status_sent_ = true;
        status_ok_ = api::classify(code) == api::Outcome::Done;
        if (!status_ok_) log(tel::Level::Warn, "status", "not delivered", {{"code", code}});
        break;
      case Purpose::Note:
        if (api::classify(code) != api::Outcome::Done) log(tel::Level::Warn, "status", "note not delivered", {{"code", code}});
        break;
      case Purpose::Metrics:
        metrics_done_ = true;
        if (code < 200 || code >= 300) log(tel::Level::Warn, "otlp", "metrics not delivered", {{"code", code}});
        break;
      case Purpose::Logs:
        if ((code >= 200 && code < 300) || code == 400) {  // 400: malformed, never retry it
          rtc_.log.ack(log_sent_upto_);
          if (!rtc_.log.pending()) log_at_ = now;  // else the next batch at once: a flush drains the ring
        } else {
          logs_failed_ = true;
          log_retry_at_ = now + o_.log_export_ms;
        }
        break;
      case Purpose::Event:
        eventAnswer(code, body, now);
        break;
      case Purpose::None:
        break;
    }
    return;
  }
}

void GoalApp::sendStatus(const char* reason, Purpose p) {
  api::Status s;
  s.device_id = hal_.deviceId();
  s.reason = reason;
  s.fw = o_.fw;
  s.uptime_ms = hal_.millis();
  s.battery_mv = batt_mv_;
  s.low_batt = battLow();
  s.reset_reason = hal_.resetReason();
  s.config_role = config_role_;
  s.wake_count = rtc_.wake_count;
  s.goals = rtc_.goals;
  s.short_blocks = rtc_.short_blocks;
  s.stuck_events = rtc_.stuck_events;
  WifiStats w = hal_.wifiStats();
  s.wifi_connect_ms = w.connect_ms;
  s.rssi = w.rssi;
  s.wifi_retries = rtc_.wifi_failed + w.failed_attempts;
  s.free_heap = hal_.freeHeap();
  s.min_free_heap = hal_.minFreeHeap();
  s.log_dropped = rtc_.log.dropped;
  load();
  s.queued_events = queue_.size() + n_pend_;
  s.dropped_events = queue_.dropped();
  s.beam_blocked = stuck_;
  uint32_t now_s = hal_.rtcSeconds();
  const beam::Persist& bp = mon_.persist();
  s.has_beam = true;
  s.beam.health = beam::name(mon_.health(stuck_, cfg_.beam, now_s));
  s.beam.mode = beam::name(mon_.active());
  s.beam.amb_ua = mon_.amb_ua, s.beam.lit1_ua = mon_.lit1_ua, s.beam.margin = mon_.margin;
  s.beam.ball_ua = mon_.ball_ua;
  s.beam.base_amb_ua = bp.have ? bp.base_amb_ua : -1, s.beam.base_lit1_ua = bp.have ? bp.base_lit1_ua : -1;
  s.beam.checked_s = mon_.amb_ua < 0 ? -1 : (int32_t)(now_s - mon_.checked_s);
  send(Lane::Rest, p, "POST", api::statusPath(s.device_id), api::statusJson(s));
}

// OTLP: metrics once per report, logs while online (every log_export_ms) and all of them at the end.
// Needs a synced clock (OTLP timestamps); the first REST exchange of a wake syncs it.
bool GoalApp::sendOtlp(uint32_t now, uint32_t& next) {
  int64_t epoch = hal_.epochMs();
  if (!hal_.otlpEnabled() || epoch <= 0) return false;
  otlp::Resource r{o_.fw, hal_.deviceId(), cfg_.table_id, cfg_.goal};
  bool reporting = mode_ != Mode::Active;
  if (reporting && !metrics_done_ && status_sent_) {
    otlp::Metrics m;
    m.battery_mv = batt_mv_;
    m.low_batt = battLow();
    m.reset_reason = hal_.resetReason();
    m.uptime_ms = hal_.millis();
    m.free_heap = hal_.freeHeap();
    m.min_free_heap = hal_.minFreeHeap();
    WifiStats w = hal_.wifiStats();
    m.rssi = w.rssi;
    m.wifi_connect_ms = w.connect_ms;
    m.wakes = rtc_.wake_count;
    m.goals = rtc_.goals;
    m.rejected_blocks = rtc_.short_blocks;
    m.stuck_events = rtc_.stuck_events;
    m.wifi_retries = rtc_.wifi_failed + w.failed_attempts;
    m.log_dropped = rtc_.log.dropped;
    load();
    m.queued = queue_.size();
    m.queue_dropped = queue_.dropped();
    m.beam_blocked = stuck_;
    m.has_beam = true;
    m.beam_health = (int)mon_.health(stuck_, cfg_.beam, hal_.rtcSeconds());
    m.beam_mode = (int)mon_.active();
    m.beam_amb_ua = mon_.amb_ua, m.beam_lit1_ua = mon_.lit1_ua, m.beam_ball_ua = mon_.ball_ua;
    m.beam_margin = mon_.margin;
    int64_t start = epoch - (int64_t)hal_.rtcSeconds() * 1000;  // power-on
    send(Lane::Otlp, Purpose::Metrics, "POST", otlp::METRICS_PATH, otlp::metricsJson(r, m, epoch, start));
    return true;
  }
  if (!rtc_.log.pending() || logs_failed_) return false;
  bool due = reporting ? metrics_done_ : (online() && now - log_at_ >= o_.log_export_ms);
  if (!due || (int32_t)(now - log_retry_at_) < 0) {
    if (!reporting && online()) until(next, now, log_at_ + o_.log_export_ms);
    return false;
  }
  tel::LogEntry batch[OTLP_BATCH];
  int n = rtc_.log.peek(batch, OTLP_BATCH);
  log_sent_upto_ = batch[n - 1].seq;
  send(Lane::Otlp, Purpose::Logs, "POST", otlp::LOGS_PATH, otlp::logsJson(r, batch, n, rtc_.log.dropped, epoch));
  return true;
}

void GoalApp::pump(uint32_t now, uint32_t& next) {
  bool idle = laneFree(Lane::Rest) && laneFree(Lane::Otlp);
  if (idle) flushPending();
  if (idle && held_sound_ != snd::Id::None) {  // a sound held while a request was on the air (play)
    play(held_sound_, now);
    held_sound_ = snd::Id::None;
    soundTick(now, next);
  }
  // Review 2 (R1.5): never a TX burst on top of a sound (chirp first; soundTick ticks us at its end), and near
  // the cutoff one request at a time, so goals written meanwhile wait for a quiet radio (flushPending)
  if (player_.playing() || (battLow() && !idle)) return;
  if (laneFree(Lane::Rest)) {
    bool sent = false;
    if (mode_ != Mode::Report && !cfg_fetched_) {
      if ((int32_t)(now - cfg_retry_at_) >= 0) {
        send(Lane::Rest, Purpose::Config, "GET", api::configPath(hal_.deviceId()), "");
        sent = true;
      } else {
        until(next, now, cfg_retry_at_);
      }
    }
    if (!sent && mode_ != Mode::Report) sent = restWork(now, next);
    if (!sent && note_ && mode_ == Mode::Active) {
      sendStatus(note_, Purpose::Note);
      note_ = nullptr;
      sent = true;
    }
    if (!sent && mode_ != Mode::Active && !status_sent_ && (mode_ == Mode::Report || drained()))
      sendStatus(reason_, Purpose::Status);
  }
  if (laneFree(Lane::Otlp) && (!battLow() || laneFree(Lane::Rest))) sendOtlp(now, next);
  idle = laneFree(Lane::Rest) && laneFree(Lane::Otlp);
  if (!o_.stay_associated && idle && mode_ == Mode::Active && hal_.wifiStats().connects > 0) hal_.wifiOff();
}

bool GoalApp::reportDone() const {
  if (mode_ == Mode::Active || !status_sent_) return false;
  if (!laneFree(Lane::Rest) || !laneFree(Lane::Otlp)) return false;
  if (hal_.otlpEnabled() && hal_.epochMs() > 0 && (!metrics_done_ || (rtc_.log.pending() && !logs_failed_)))
    return false;
  return mode_ == Mode::Report || drained();
}

void GoalApp::logWifi() {
  WifiStats w = hal_.wifiStats();
  if (w.connects == wifi_connects_) return;
  wifi_connects_ = w.connects;
  log(tel::Level::Info, "wifi", "connected", {{"ms", w.connect_ms}, {"rssi", w.rssi}, {"failed", (int32_t)w.failed_attempts}});
}

// USB present: no deep sleep, no auto light sleep (USB-Serial/JTAG stays up for flashing in place).
// Sampled every tick; the caller keeps ticking at least once a second meanwhile.
bool GoalApp::usb(uint32_t now) {
  bool on = hal_.usbPowered();
  if (on != usb_) {
    usb_ = on;
    hal_.lightSleep(!on);
    log(tel::Level::Info, "usb", on ? "powered: staying awake (no sleep) for flashing" : "unplugged: sleeping as usual");
  }
  return on;
}

void GoalApp::sleep() {
  uint32_t now_s = hal_.rtcSeconds();
  bool reported = status_sent_;
  if (reported) {
    rtc_.heartbeat_due_s = tel::nextHeartbeat(now_s, status_ok_, rtc_.heartbeat_failures);  // 1 h, 2 h, ...
    rtc_.heartbeat_failures = status_ok_ ? 0 : rtc_.heartbeat_failures + 1;
  } else if (!rtc_.heartbeat_due_s) {
    rtc_.heartbeat_due_s = now_s + tel::HEARTBEAT_S;
  }
  rtc_.wifi_failed += hal_.wifiStats().failed_attempts;
  flushPending();
  if (led_ != Led::Off) hal_.statusLed(led_ = Led::Off);
  soundOff();
  if (view_on_) hal_.oled(nullptr), view_on_ = false;
  if (powered_) hal_.beamPower(false);
  hal_.wifiOff();
  SleepRequest r;
  r.timer_s = rtc_.cutoff ? 0 : tel::sleepTimerS(now_s, rtc_.heartbeat_due_s, false);
  // The LP core's count while asleep: this session's, frozen; a silent re-sleep keeps the last one
  if (*reason_) rtc_.led_blinks = ledCount();
  r.blinks = rtc_.cutoff ? 0 : rtc_.led_blinks;
  log(tel::Level::Info, "power", "deep sleep", {{"timer_s", (int32_t)r.timer_s}});
  hal_.led(false);
  asleep_ = true;
  hal_.deepSleep(r);
}

uint32_t GoalApp::tick() {
  if (asleep_) return UINT32_MAX;
  uint32_t now = hal_.millis(), next = UINT32_MAX;
  logWifi();
  if (mode_ != Mode::Report) active(now, next);
  if (asleep_) return UINT32_MAX;
  ledWork(now, next);
  pump(now, next);
  if (usb(now)) {
    until(next, now, now + 1000);
  } else if (reportDone()) {
    sleep();
    return UINT32_MAX;
  }
  return next;
}

// ---- goals

void GoalApp::load() {
  if (loaded_) return;
  queue_.load(hal_.random());
  first_seq_ = queue_.nextSeq();
  loaded_ = true;
}

void GoalApp::configChanged() {
  det_.min_block_ms = cfg_.min_block_ms;
  det_.lockout_ms = cfg_.lockout_ms;
  det_.stuck_after_ms = cfg_.stuck_after_s * 1000;
  idle_ms_ = cfg_.idle_timeout_s * 1000;
  if (mon_.setManual(cfg_.beam, hal_.rtcSeconds())) beamModeChanged();
}

void GoalApp::activate(uint32_t now) {
  load();
  configChanged();
  hal_.beamMode(mon_.active(), cfg_.beam.settle_ms);  // the pins of the mode, before power-up
  hal_.beamPower(true);
  powered_ = true;
  warm_at_ = now + o_.beam_warmup_ms;
  last_activity_ = motion_at_ = summary_at_ = now;
  if (queue_.size()) log(tel::Level::Info, "queue", "goals waiting from before", {{"n", (int32_t)queue_.size()}});
  if (cause_ == WakeCause::Key) {  // ux B5: the press shows the screen; held on, it is an undo as when awake
    btn_down_ = hal_.buttonDown();   // the hold counts from the wake (nothing is ever inside the window: "no")
    btn_at_ = now;
    log(tel::Level::Info, "undo", "woken by the button");
  }
  if (cause_ == WakeCause::Key || cause_ == WakeCause::PowerOn) {  // ux B5: power-on = cells just swapped in
    view_on_ = view_settle_ = true;  // until Wi-Fi settles
    wake_at_ = view_at_ = now;
    view_until_ = now + o_.view_wake_max_ms;
  }
}

void GoalApp::activity(uint32_t now) {
  last_activity_ = now;
  if (mode_ == Mode::Final) mode_ = Mode::Active;  // back to work
}

void GoalApp::sample(bool blocked, uint32_t t, uint32_t now) {
  if (!det_.update(blocked, t)) return;
  Event ev{};
  bool ok = persist(now, 0, &ev);  // persisted before anything is sent
  rtc_.goals++;
  if (ok) {  // the button's ring: newest last
    if (n_recent_ == 4) memmove(recent_, recent_ + 1, sizeof recent_[0] * --n_recent_);
    recent_[n_recent_++] = {ev.seq, now, false};
    play(snd::Id::Goal, now);  // locally, at once: no beep = not counted (ux B3)
  }
  log(ok ? tel::Level::Info : tel::Level::Error, "goal", ok ? "counted" : "counted, NOT persisted",
      {{"seq", (int32_t)ev.seq}, {"queued", (int32_t)queue_.size()}});
  // How dark is the gate with the ball in it? Only while D8 still sees the ball: a count processed late (the
  // ball already gone) would read the lit node as "light around the ball" (twin plan C). Not in chopped mode.
  if (!chop_ && hal_.beamBlocked()) mon_.ball(hal_.beamMv(), cfg_.beam);
  beamHealth();
  activity(now);
}

void GoalApp::beam(bool blocked, uint32_t ms) {
  if (armed_ && !chop_) sample(blocked, ms, hal_.millis());  // chopped reads replace D8 in strong light
}

// Review 2 (R1.5): near the cutoff no flash write while a request is on the air. The event waits in RAM with
// its seq already fixed and is written once the radio is quiet (pump, sleep); the chirp still plays at once.
bool GoalApp::persist(uint32_t up, uint32_t undoes, Event* out) {
  int64_t epoch = hal_.epochMs();
  if (battLow() && !(laneFree(Lane::Rest) && laneFree(Lane::Otlp))) {
    if (n_pend_ == 4) flushPending();  // a burst while one request hangs: write anyway
    *out = {queue_.nextSeq() + n_pend_, up, epoch, undoes};
    pend_[n_pend_++] = *out;
    return true;
  }
  flushPending();  // keep the order
  return queue_.push(up, epoch, out, undoes);
}

void GoalApp::flushPending() {
  for (int i = 0; i < n_pend_; i++) {
    Event e{};
    if (!queue_.push(pend_[i].uptime_ms, pend_[i].epoch_ms, &e, pend_[i].undoes) || e.seq != pend_[i].seq)
      log(tel::Level::Error, "queue", "held event NOT persisted as numbered", {{"seq", (int32_t)pend_[i].seq}});
  }
  n_pend_ = 0;
}

// ---- the undo button (ux B1/B2): hold undo_hold_ms = undo this counter's newest goal that is still
// inside undo_window_s; again = the one before. One undo per press; a press never chain-undoes.

void GoalApp::button(bool down, uint32_t ms) {
  if (down == btn_down_) return;
  btn_down_ = down;
  uint32_t now = hal_.millis();
  if (!down) {
    btn_up_at_ = ms;
    if (btn_stuck_) log(tel::Level::Info, "undo", "button released");
    btn_stuck_ = false;
  } else if (ms - btn_up_at_ >= o_.button_debounce_ms || !btn_up_at_) {  // else a bounce: the same press
    btn_at_ = ms;
    btn_done_ = false;
    play(snd::Id::Scan, now);  // "it works, keep holding"
    if (!view_on_) view_at_ = now;  // the details cycle from here
    view_on_ = true;                // the screen at once (viewWork keeps it on while held)
  }
  if (!down && !view_settle_) view_until_ = now + o_.view_ms;
  activity(now);
}

void GoalApp::buttonWork(uint32_t now, uint32_t& next) {
  if (!btn_down_) return;
  uint32_t held = now - btn_at_;
  if (!btn_done_ && held >= o_.undo_hold_ms) {
    btn_done_ = true;
    undo(now);
  }
  if (!btn_stuck_ && held >= o_.button_stuck_ms) {  // no sound; the glue keeps it out of the deep-sleep wakes
    btn_stuck_ = true;
    log(tel::Level::Warn, "undo", "button stuck");
  }
  if (!btn_stuck_) until(next, now, btn_at_ + (btn_done_ ? o_.button_stuck_ms : o_.undo_hold_ms));
}

void GoalApp::undo(uint32_t now) {
  int i = n_recent_ - 1;
  while (i >= 0 && recent_[i].undone) i--;
  if (i < 0 || now - recent_[i].at >= cfg_.undo_window_s * 1000) {
    log(tel::Level::Info, "undo", "nothing to undo here", {{"window_s", (int32_t)cfg_.undo_window_s}});
    undoShown("Undo: too late", true, now);
    return play(snd::Id::NotJoined, now);
  }
  Event ev{};
  if (!persist(now, recent_[i].seq + 1, &ev)) {  // in the goals' queue: sent after its goal
    log(tel::Level::Error, "undo", "not persisted", {{"goal", (int32_t)recent_[i].seq}});
    undoShown("Undo failed", true, now);
    return play(snd::Id::NotJoined, now);
  }
  recent_[i].undone = true;
  log(tel::Level::Info, "undo", "queued", {{"seq", (int32_t)ev.seq}, {"goal", (int32_t)recent_[i].seq}});
  undoShown("Undo queued", false, now);  // "Undo ok" when the server says so
  play(snd::Id::Undo, now);
}

void GoalApp::undoShown(const char* msg, bool bad, uint32_t now) {
  undo_msg_ = msg, undo_bad_ = bad;
  undo_until_ = now + o_.view_undo_ms;
  if (view_on_ && (int32_t)(view_until_ - undo_until_) < 0) view_until_ = undo_until_;
}

// ---- the debug OLED (ux B5): live while on (1 Hz, at once on events), panel off otherwise

void GoalApp::viewWork(uint32_t now, uint32_t& next) {
  if (!view_on_) return;
  if (view_settle_ && (rest_code_ || hal_.wifiStats().failed_attempts)) {  // connected and answered, or failed
    view_settle_ = false;
    uint32_t cap = wake_at_ + o_.view_wake_max_ms;
    view_until_ = (int32_t)(cap - now - o_.view_ms) < 0 ? cap : now + o_.view_ms;
  }
  if (btn_down_ && !btn_stuck_ && !view_settle_) view_until_ = now + o_.view_ms;  // held: stays on
  if ((int32_t)(now - view_until_) >= 0) {
    view_on_ = false;
    shown_ = {};
    return hal_.oled(nullptr);
  }
  StatusView v = view(now);
  if (memcmp(&v, &shown_, sizeof v)) hal_.oled(&(shown_ = v));
  until(next, now, now + 1000);
  until(next, now, now + o_.view_cycle_ms - (now - view_at_) % o_.view_cycle_ms);  // the next detail
  until(next, now, view_until_);
}

bool GoalApp::battLow() const { return batt_mv_ >= 0 && batt_mv_ < mv(cfg_.batt_warn_mv, o_.warn_mv); }

static bool reached(int code) { return (code >= 200 && code < 300) || code == 409 || code == 422; }

// ux B5a: line 1 = the verdict (an undo result, live BLOCKED, else the worst fault, else OK), line 2 cycles the
// details every view_cycle_ms. Faults in inverse.
// The worst fault in ux's B5a order, shared by the OLED's verdict line and the status LED (so they never
// disagree). The live "Beam BLOCKED" (a hand or a ball in the gate) is the view's, not a fault.
bool GoalApp::fault(char (&out)[17]) {
  WifiStats w = hal_.wifiStats();
  beam::Health h = mon_.health(stuck_, cfg_.beam, hal_.rtcSeconds());
  unsigned q = queue_.size();
  if (cfg_.table_id.empty())
    snprintf(out, sizeof out, "NO TABLE");
  else if (!w.rssi && w.failed_attempts)
    snprintf(out, sizeof out, "WiFi off");
  else if (w.rssi && rest_code_ && !reached(rest_code_))
    snprintf(out, sizeof out, "srv %s", rest_code_ == 401 || rest_code_ == 404 ? std::to_string(rest_code_).c_str() : "err");
  else if (h == beam::Health::Blocked)
    snprintf(out, sizeof out, "Beam BLOCKED");
  else if (h == beam::Health::SensorDead)
    snprintf(out, sizeof out, "Beam DEAD");
  else if (h != beam::Health::Ok)
    snprintf(out, sizeof out, "Beam %s %s", h == beam::Health::LowMargin ? "low" : "amb", margin().c_str());
  else if (battLow())
    snprintf(out, sizeof out, "Batt low %.2fV", batt_mv_ / 1000.0);
  else if (q > 5)
    snprintf(out, sizeof out, "Queue %u", q);
  else
    return false;
  return true;
}

// ux/status-led-2026-10-18.md §2: 3 (red) = battery low, the fault you can fix at once; 2 (red) = any other; 1 (green) = OK.
int GoalApp::ledCount() {
  char f[17];
  return battLow() ? 3 : fault(f) ? 2 : 1;
}

std::string GoalApp::margin() const {
  char m[8] = "--";
  if (mon_.margin >= 0) snprintf(m, sizeof m, "%.1fx", mon_.margin);
  return m;
}

// ux B5a: line 1 = the verdict (an undo result, live BLOCKED, else the worst fault, else OK), line 2 cycles the
// details every view_cycle_ms. Faults in inverse.
StatusView GoalApp::view(uint32_t now) {
  struct Line {
    char t[17];
    bool bad;
  } d[4], verdict{"", false};
  auto put = [](Line& l, bool bad, const char* fmt, auto... a) {
    snprintf(l.t, sizeof l.t, fmt, a...);
    l.bad = bad;
  };
  WifiStats w = hal_.wifiStats();
  char srv[8];
  snprintf(srv, sizeof srv, "%d", rest_code_);
  const char* s = !rest_code_ ? ".." : reached(rest_code_) ? "ok" : rest_code_ == 401 || rest_code_ == 404 ? srv : "err";
  bool wifi_off = !w.rssi && w.failed_attempts;
  if (w.rssi)
    put(d[0], rest_code_ && !reached(rest_code_), "WiFi %d srv %s", (int)w.rssi, s);
  else
    put(d[0], wifi_off, "%s", wifi_off ? "WiFi off" : "WiFi ...");

  unsigned q = queue_.size();
  if (batt_mv_ < 0)
    put(d[1], q > 5, "Batt --  Q %u", q);
  else
    put(d[1], battLow() || q > 5, "Batt %.2fV  Q %u", batt_mv_ / 1000.0, q);

  beam::Health h = mon_.health(stuck_, cfg_.beam, hal_.rtcSeconds());
  bool blocked = det_.blocked() || h == beam::Health::Blocked;
  static const char* MODE[] = {"a", "a+", "b", "auto"};
  const char* hw = h == beam::Health::Ok ? "ok" : h == beam::Health::LowMargin ? "low" : "amb";
  if (blocked)
    put(d[2], true, "%s", "Beam BLOCKED");
  else if (h == beam::Health::SensorDead)
    put(d[2], true, "%s", "Beam DEAD");
  else
    put(d[2], h != beam::Health::Ok, "Beam %s %s %s", MODE[(int)mon_.active()], hw, margin().c_str());

  const char* end = cfg_.goal.empty() ? "?" : cfg_.goal.c_str();
  if (cfg_.table_id.empty())
    put(d[3], true, "NO TABLE v%s", o_.fw);
  else
    put(d[3], false, "End %-3.5s v%s", end, o_.fw);

  if (undo_msg_ && (int32_t)(now - undo_until_) < 0)
    put(verdict, undo_bad_, "%s", undo_msg_);
  else if (blocked)
    put(verdict, true, "%s", "Beam BLOCKED");  // live: a hand in the gate tests detection
  else if (fault(verdict.t))
    verdict.bad = true;
  else
    put(verdict, false, "OK      End %.4s", end);

  const Line& detail = d[(now - view_at_) / o_.view_cycle_ms % 4];
  StatusView v{};
  memcpy(v.line[0], verdict.t, sizeof v.line[0]);
  memcpy(v.line[1], detail.t, sizeof v.line[1]);
  v.inverse = verdict.bad | detail.bad << 1;
  return v;
}

// ---- the status LED, awake (asleep the glue's LP core blinks SleepRequest::blinks): a group of ledCount()
// blinks every led_period_ms, green for 1, red for 2 or 3. The count is latched at each group's start.

void GoalApp::ledWork(uint32_t now, uint32_t& next) {
  if (rtc_.cutoff) return;  // dark = flat (ux §1)
  uint32_t t = now - led_at_, group = t / o_.led_period_ms, phase = t % o_.led_period_ms;
  if (group != led_group_ || !led_n_) led_group_ = group, led_n_ = ledCount();
  uint32_t k = phase / o_.led_gap_ms, in = phase % o_.led_gap_ms;
  bool on = k < (uint32_t)led_n_ && in < o_.led_blink_ms;
  Led c = !on ? Led::Off : led_n_ == 1 ? Led::Green : Led::Red;
  if (c != led_) hal_.statusLed(led_ = c);
  uint32_t edge = on ? o_.led_blink_ms - in : k + 1 < (uint32_t)led_n_ ? o_.led_gap_ms - in : o_.led_period_ms - phase;
  until(next, now, now + edge);
}

void GoalApp::active(uint32_t now, uint32_t& next) {
  buttonWork(now, next);
  soundTick(now, next);
  viewWork(now, next);
  if (!armed_) {
    if ((int32_t)(now - warm_at_) < 0) return until(next, now, warm_at_);
    det_.reset(hal_.beamBlocked(), now);  // a ball already in the gate is not a goal
    armed_ = true;
    check_at_ = now;  // the first health check right away: the status at sleep then has readings
  }
  if (!chop_) {
    sample(hal_.beamBlocked(), now, now);
  } else if ((int32_t)(now - chop_at_) >= 0) {
    chop_at_ = now + o_.chop_ms;
    sample(chopBlocked(), now, now);
  }
  if (chop_) until(next, now, chop_at_);
  if (det_.pending()) until(next, now, now + det_.msUntilDecision(now));
  bool stuck = det_.stuck(now);
  if (stuck && !stuck_) {
    rtc_.stuck_events++;
    log(tel::Level::Warn, "beam", "blocked too long (stuck ball or misaligned)");
    if (mon_.blockedInB(cfg_.beam, hal_.rtcSeconds())) beamModeChanged();  // B's thin margin, not a ball?
  }
  if (stuck != stuck_) {
    stuck_ = stuck;
    beamHealth();
  }
  if (det_.blocked() && !stuck_) until(next, now, now + 1000);
  if (det_.rejected != rejected_seen_) {
    rtc_.short_blocks += det_.rejected - rejected_seen_;
    rejected_seen_ = det_.rejected;
  }
  if (o_.led_beam) hal_.led(det_.blocked());
  if (now - motion_at_ >= o_.motion_poll_ms) {
    motion_at_ = now;
    if (hal_.motionSeen()) activity(now);  // the latch holds any knock until we look
  }
  until(next, now, motion_at_ + o_.motion_poll_ms);
  beamWork(now, next);
  if (now - last_activity_ >= idle_ms_) {
    beamSummary(now);  // sessions are often shorter than beam_report_s: keep the day's profile
    enterFinal(now);
  } else
    until(next, now, last_activity_ + idle_ms_);
}

bool GoalApp::restWork(uint32_t now, uint32_t& next) {
  if (!queue_.size()) return false;
  if ((int32_t)(now - retry_at_) < 0) {
    until(next, now, retry_at_);
    return false;
  }
  Event e;
  if (!queue_.peek(e)) return false;
  sending_ = e.seq;
  sending_undo_ = e.undoes;
  send(Lane::Rest, Purpose::Event, "POST", e.undoes ? api::undoEventsPath() : api::goalEventsPath(),
       api::goalEventJson(hal_.deviceId(), o_.fw, cfg_, queue_.epoch(), e, batt_mv_));
  return true;
}

void GoalApp::eventAnswer(int code, const std::string& body, uint32_t now) {
  api::Outcome out = api::classify(code);
  const char* tag = sending_undo_ ? "undo" : "goal";
  if (out == api::Outcome::Retry) {
    last_failed_ = true;
    retry_at_ = now + backoff(false);
    log(tel::Level::Warn, tag, "not delivered, will retry", {{"seq", (int32_t)sending_}, {"code", code}});
    return;
  }
  if (sending_undo_) {  // a refusal (too late, not ours, ...) is an answer, not a lost event: not in dropped
    if (out == api::Outcome::Drop) {
      std::string why = "refused by server: " + api::refusalCode(body);
      log(tel::Level::Info, "undo", why.c_str(), {{"seq", (int32_t)sending_}, {"code", code}});
      if ((int32_t)(sending_ - first_seq_) >= 0) {  // pressed this wake: "no"
        play(snd::Id::NotJoined, now);
        std::string c = api::refusalCode(body);
        undoShown(c == "too_late"         ? "Undo: too late"
                  : c == "not_yours"      ? "Undo: not mine"
                  : c == "already_undone" ? "Undo: was undone"
                  : c == "closed"         ? "Undo: game over"
                                          : "Undo refused",
                  true, now);
      }
    } else {
      log(tel::Level::Info, "undo", code == 409 ? "already applied" : "applied", {{"seq", (int32_t)sending_}});
      if ((int32_t)(sending_ - first_seq_) >= 0) undoShown("Undo ok", false, now);
    }
  } else if (out == api::Outcome::Drop) {
    log(tel::Level::Error, "goal", "rejected by server, dropped", {{"seq", (int32_t)sending_}, {"code", code}});
  }
  queue_.pop(sending_, out == api::Outcome::Drop && !sending_undo_);
  last_failed_ = false;
  backoff(true);
  retry_at_ = now;  // send anything that queued up meanwhile right away
}

// ---- beam health: a check every beam_check_s while the beam reads clear and no lockout runs.
// The glue masks the ISR for ~3 x beam_settle_ms; a ball that arrives meanwhile is still counted.

void GoalApp::beamWork(uint32_t now, uint32_t& next) {
  const beam::Cfg& c = cfg_.beam;
  if (!c.check_s || !beam_adc_) return;
  if ((int32_t)(now - check_at_) < 0) {
    until(next, now, check_at_);
  } else if (!det_.blocked() && !det_.inLockout(now)) {  // else at a later tick (motion poll, edges)
    check_at_ = now + c.check_s * 1000;
    beam::Reading r;
    if (!hal_.beamCheck(c.settle_ms, r)) {
      beam_adc_ = false;  // no ADC on this board: no checks, beam_mode stays as wired
      log(tel::Level::Info, "beam", "no ADC: health checks off");
      return;
    }
    if (mon_.check(r, c, hal_.rtcSeconds())) beamModeChanged();
    beamHealth();
    chopControl(now);
    until(next, now, check_at_);
  }
  if (now - summary_at_ >= c.report_s * 1000) beamSummary(now);
  until(next, now, summary_at_ + c.report_s * 1000);
}

// Review 2 plan C (R1.6): while ambient_high persists, D8's comparator can't see the LED over daylight. Then
// the app polls a chopped read instead: the node with the LED off and at 1 mA (both pull-ups, linear range).
// The clear beam's difference is lit1 from the last check; a ball takes it below chop_frac of that.
void GoalApp::chopControl(uint32_t now) {
  bool amb = mon_.health(stuck_, cfg_.beam, hal_.rtcSeconds()) == beam::Health::AmbientHigh;
  amb_checks_ = amb ? amb_checks_ + 1 : 0;
  // ambient_high flags at ambient_max_pct (60 %) of what D8 tolerates, so D8 still counts while we wait for the
  // second check. Ambient beyond D8's limit (it can't see a ball any more) switches at once (round 3).
  bool blind = mon_.amb_ua >= beam::tolUa(cfg_.beam, mon_.active());
  bool want = o_.chop_ms && mon_.lit1_ua > 0 && (blind || amb_checks_ >= o_.chop_after_checks);
  if (want == chop_) return;
  chop_ = want;
  chop_at_ = now;
  log(tel::Level::Info, "beam", want ? "chopped reads on (ambient high)" : "chopped reads off");
}

bool GoalApp::chopBlocked() {
  int d = hal_.beamChop();  // mV: LED off minus LED on, both pull-ups
  if (d < 0) {              // no ADC: back to D8
    chop_ = false;
    return hal_.beamBlocked();
  }
  float clear_mv = mon_.lit1_ua * beam::pullup(cfg_.beam, beam::Mode::B) / 1000;
  return d < o_.chop_frac * clear_mv;
}

void GoalApp::beamModeChanged() {
  hal_.beamMode(mon_.active(), cfg_.beam.settle_ms);
  char msg[40];
  snprintf(msg, sizeof msg, "mode %s (%s)", beam::name(mon_.active()), mon_.why);
  log(tel::Level::Info, "beam", msg);
}

static int32_t nanoamps(float ua) { return ua < 0 ? -1 : (int32_t)lroundf(ua * 1000); }

void GoalApp::beamHealth() {
  uint32_t now_s = hal_.rtcSeconds();
  beam::Health h = mon_.health(stuck_, cfg_.beam, now_s);
  if (h == health_) return;
  bool worse = h > health_;
  health_ = h;
  char msg[40];
  snprintf(msg, sizeof msg, "health %s", beam::name(h));
  log(worse ? tel::Level::Warn : tel::Level::Info, "beam", msg,
      {{"amb_na", nanoamps(mon_.amb_ua)}, {"ball_na", nanoamps(mon_.ball_ua)},
       {"margx10", mon_.margin < 0 ? -1 : (int32_t)lroundf(mon_.margin * 10)}});
  // Tell the server now, not at sleep: a state worse than the last one it heard (RTC: across wakes, so
  // a lasting fault isn't re-sent every session), or the same again after beam_report_s.
  beam::Persist& p = rtc_.beam;
  if (worse && (h > p.noted || now_s - p.noted_s >= cfg_.beam.report_s)) {
    note_ = "beam";
    p.noted_s = now_s;
  }
  p.noted = h;  // also when better: a later relapse is news again
}

// One record per beam_report_s (and at the end of a session): the worst light seen, for the
// time-of-day profile. Nothing when there was no check.
void GoalApp::beamSummary(uint32_t now) {
  summary_at_ = now;
  if (mon_.amb_max_ua >= 0)
    log(tel::Level::Info, "beam", "summary",
        {{"mode", (int32_t)mon_.active()}, {"amb_na", nanoamps(mon_.amb_max_ua)}, {"ball_na", nanoamps(mon_.ball_ua)}});
  mon_.newWindow();
}

}  // namespace app
