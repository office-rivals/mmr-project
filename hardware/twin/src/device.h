#pragma once
// A virtual goal counter's board: the firmware's GoalApp (lib/core) on simulated parts. This file is the
// twin's equivalent of src/goal/main.cpp: it implements app::Hal and never decides anything the firmware
// decides. The beam, receiver and button are in devices.h.
#include <stdio.h>
#include <string.h>

#include <functional>
#include <memory>
#include <optional>
#include <string>

#include "goal_app.h"
#include "link.h"
#include "sim.h"
#include "sim_kv.h"

namespace sim {

struct Env {  // shared by every device of a run
  Clock& clk;
  net::Http& http;
  Endpoints ep;
  Rng rng;
  bool verbose = false;
  uint32_t nonce = 0;  // per run, from the real clock
};

// Pack voltages relative to firmware's thresholds (app::GoalOptions), so a threshold change can't strand a scenario.
inline constexpr app::GoalOptions BATT{};
inline constexpr int MV_FRESH = BATT.resume_mv + 100;                     // fine; also resumes from cutoff
inline constexpr int MV_LOW = (BATT.cutoff_mv + BATT.warn_mv) / 2;        // low_batt, not yet cutoff
inline constexpr int MV_DEAD = BATT.cutoff_mv - 250;                      // below cutoff

class Device : public app::Hal {
 public:
  using App = app::GoalApp;
  Device(Env& env, std::string id) : link(env.clk, env.http, env.ep), env_(env), id_(std::move(id)) {
    kv_.on_pull = [this] { pull(); };
    link.on_power_pull = [this] { pull(); };
  }
  ~Device() override { gen_++; }

  Link link;

  // ---- physical world (scenario side)

  int64_t clock_skew_ms = 0;  // device wall clock vs the twin's (NTP off by this much)
  bool ntp_ok = true;          // false: never synced (occurred_at null, no OTLP)
  int busy_loops = 0;     // times tick() spun at one instant (see tick())
  int battery_mv = MV_FRESH;  // pack voltage; -1 = no pack fitted (USB power)
  app::GoalOptions opts;  // the image's build options (board.h knobs), per device

  void powerOn() {
    if (powered_) return;
    powered_ = true;
    kv_.dead = false;
    power_on_at_ = env_.clk.now();
    rtc_ = {};  // garbage after power loss: init() rejects it
    ensureSecret();
    wake(app::WakeCause::PowerOn);
  }
  // Batteries pulled. Safe to call from inside the app (an NVS write, a send): the app object is
  // only destroyed from the scheduler, never under its own feet.
  void pull() {
    if (!powered_) return;
    log("POWER PULLED");
    powered_ = false;
    kv_.dead = true;
    screen.reset();
    led_ = app::Led::Off;
    link.powerLoss();
    retire();
  }
  // USB 5 V in or out (VBUS sense, goal board: D2 is an ext1 wake, so plugging in wakes it).
  void usb(bool on) {
    usb_ = on;
    if (on && powered_ && asleep_) wake(app::WakeCause::Usb);
  }
  bool light_sleep = true;  // auto light sleep as the app last set it (off while on USB)
  void motion() {
    motion_latched_ = true;
    if (powered_ && asleep_) wake(app::WakeCause::Motion);
  }

  bool powered() const { return powered_; }
  bool asleep() const { return asleep_; }
  bool awake() const { return powered_ && !asleep_; }
  const std::string& id() const { return id_; }
  NvsKv& nvs() { return kv_; }
  Env& env() { return env_; }
  app::RtcState& rtc() { return rtc_; }

  // ---- app::Hal

  uint32_t millis() override { return (uint32_t)(env_.clk.now() - wake_at_); }
  int64_t epochMs() override { return synced_ && ntp_ok ? env_.clk.epochMs() + clock_skew_ms : 0; }
  uint32_t rtcSeconds() override { return (uint32_t)((env_.clk.now() - power_on_at_) / 1000); }
  int batteryMv() override { return usb_ ? -1 : battery_mv; }  // the glue ignores VBAT on USB (VBUS_S high)
  Kv& kv() override { return kv_; }
  // Seeded for repeatable runs, xor a per-run nonce: the NVS epoch in event_id must differ between
  // runs or a server that remembers event_ids (correctly) dedupes the next run's goals.
  uint32_t random() override { return (uint32_t)env_.rng() ^ env_.nonce; }
  // The buzzer: every sound the app started ('[sound] <name> volume=N'
  // log; names may have spaces: "not joined"; "<name> muted: usb power" plays nothing), and the pitch now.
  std::vector<std::string> sounds;
  std::vector<int64_t> sound_at;  // when each of `sounds` started
  uint32_t tone_hz = 0;
  int tones = 0;           // buzzer pitch changes to a note (not silence, not duty steps)
  int buzzing_sleeps = 0;  // deep sleeps with the buzzer still on (a stuck tone drains the pack)
  // Called every ~1 ms during an envelope (duty changes), so count a note only when the pitch changes.
  void tone(uint32_t hz, int duty_bp) override {
    if (!duty_bp) hz = 0;
    tones += hz && hz != tone_hz;
    tone_hz = hz;
  }
  // The goal counter's debug OLED (ux B5): what it shows now (panel off = nullopt), and deep sleeps with it lit.
  std::optional<app::StatusView> screen;
  int screen_shows = 0;  // times the panel went from off to on
  int lit_sleeps = 0;
  // The app task can't run while something holds the single core: a request start costs a radio burst
  // (radio_ms, EST: bench it with a GPIO around a POST); busy(ms) is any other stall a scenario wants. The OLED
  // costs nothing: the glue draws on its own lower-priority task (app.h).
  uint32_t radio_ms = 2;
  void busy(uint32_t ms) { busy_until_ = std::max(busy_until_, env_.clk.now() + ms); }
  void oled(const app::StatusView* v) override {
    screen_shows += v && !screen;
    screen = v ? std::optional(*v) : std::nullopt;
  }
  // The status LED awake (asleep the LP core blinks SleepRequest::blinks): blinks started per colour, and
  // anything that breaks "short blinks only": on > 100 ms, on at deep sleep, a sleep count that doesn't fit.
  int led_blinks[3] = {};  // [app::Led::Green], [app::Led::Red]
  std::vector<std::string> led_faults;
  int sleepBlinks() const { return asleep_ ? sleep_.blinks : -1; }
  void statusLed(app::Led c) override {
    int64_t now = env_.clk.now();
    if (led_ != app::Led::Off && now - led_on_at_ > 100) led_faults.push_back("LED on " + std::to_string(now - led_on_at_) + " ms");
    if (c != app::Led::Off && led_ == app::Led::Off) led_on_at_ = now, led_blinks[(int)c]++;
    led_ = c;
  }
  void print(const std::string& line) override {
    if (line.starts_with("[sound] ") && line.find(" muted: ") == std::string::npos) {
      sounds.push_back(line.substr(8, line.rfind(" volume=") - 8));
      sound_at.push_back(env_.clk.now());
    }
    log(line.c_str());
  }
  std::string deviceId() override { return id_; }
  std::string resetReason() override { return cause_ == app::WakeCause::PowerOn ? "poweron" : "deepsleep"; }

  void send(uint32_t id, app::Lane lane, const char* method, const std::string& path, const std::string& body,
            uint32_t timeout_ms) override {
    if (!awake()) return;
    busy(radio_ms);
    if (!connected_) stats_.connect_ms = link.wifi_connect_ms;
    uint64_t gen = gen_;
    link.send(lane, method, path, body, timeout_ms, [this, gen, id](int code, const std::string& resp) {
      if (gen != gen_ || !app_) return;  // slept or lost power meanwhile
      if (code > 0 && !connected_) {     // first answer of this wake: associated, NTP done
        connected_ = synced_ = true;
        stats_.connects++, stats_.rssi = link.rssi;
      }
      if (code <= 0) stats_.failed_attempts++;
      app_->response(id, code, resp);
      tick();
    });
  }
  bool otlpEnabled() override { return !env_.ep.otlp_base.empty(); }
  void wifiOff() override { connected_ = false; }
  app::WifiStats wifiStats() override { return stats_; }
  void deepSleep(const app::SleepRequest& r) override {
    buzzing_sleeps += tone_hz != 0;
    tone_hz = 0;  // the LEDC stops with the CPU
    lit_sleeps += screen.has_value();
    screen.reset();  // the panel's supply is cut in deep sleep
    if (led_ != app::Led::Off) led_faults.push_back("deep sleep with the LED on");
    if (rtc_.cutoff ? r.blinks != 0 : r.blinks < 1 || r.blinks > 3)
      led_faults.push_back("asleep with " + std::to_string(r.blinks) + " blinks" + (rtc_.cutoff ? " at cutoff" : ""));
    led_ = app::Led::Off;
    log("deep sleep");
    asleep_ = true;
    sleep_ = r;
    link.powerLoss();  // the radio is off: nothing in flight is ever answered
    retire();
    if (r.timer_s) {
      uint64_t g = gen_;
      env_.clk.after(int64_t(r.timer_s) * 1000, [this, g] {
        if (g == gen_ && powered_ && asleep_) wake(app::WakeCause::Timer);
      });
    }
  }
  bool motionSeen() override { return std::exchange(motion_latched_, false); }
  bool usbPowered() override { return usb_; }
  void lightSleep(bool allowed) override { light_sleep = allowed; }

 protected:
  Env& env_;
  std::unique_ptr<App> app_;
  bool asleep_ = false;
  app::SleepRequest sleep_;

  static constexpr uint32_t BUILD_ID = 0x7477'0001;  // RtcState survives sleep only for the same build

  void wake(app::WakeCause c) {
    asleep_ = false;
    cause_ = c;
    wake_at_ = env_.clk.now();
    connected_ = synced_ = false;
    stats_ = {};
    gen_++;
    log(c == app::WakeCause::PowerOn ? "boot (power on)" : "wake");
    rtc_.init(BUILD_ID);
    app_ = std::make_unique<App>(*this, rtc_, opts);
    app_->boot(c);
    tick();
  }

  // Run the app's timers: tick() now, then again when it says. Superseded schedules are dropped.
  // An ISR edge (beam, button), stamped now: the glue queues it and the app task takes it in its next loop.
  void edgeIn(std::function<void()> deliver) {
    if (!awake() || !app_) return;
    edges_.push_back(std::move(deliver));
    tick();
  }
  void tick() {
    if (!app_ || !awake()) return;
    if (int64_t wait = busy_until_ - env_.clk.now(); wait > 0) {  // still blocked: run when the glue returns
      uint64_t g = ++tick_gen_;
      env_.clk.after(wait, [this, g] {
        if (g == tick_gen_) tick();
      });
      return;
    }
    for (auto e = std::move(edges_); auto& f : e)  // the glue's loop: queued edges, then tick()
      if (app_ && awake()) f();
    if (!app_ || !awake()) return;
    uint32_t ms = app_->tick();
    if (!app_ || !awake()) return;
    // A device that keeps asking to run again at the same instant never sleeps: on hardware that
    // is a CPU stuck awake (battery drain), so it is reported, and the twin backs off 1 ms.
    if (ms == 0 && env_.clk.now() == spin_at_) {
      if (++spins_ == 1000 && !busy_loops++) log("WARNING: tick() keeps returning 0 (busy loop)");
      if (spins_ >= 1000) ms = 1;
    } else if (ms == 0) {
      spin_at_ = env_.clk.now(), spins_ = 0;
    }
    uint64_t g = ++tick_gen_;
    env_.clk.after(ms == UINT32_MAX ? INT64_MAX / 4 : ms, [this, g] {
      if (g == tick_gen_) tick();
    });
  }

  void log(const char* msg) {
    if (!env_.verbose) return;
    int64_t t = env_.clk.now();
    fprintf(stderr, "%5lld.%03lld %s %s\n", (long long)(t / 1000), (long long)(t % 1000), id_.c_str(), msg);
  }

 private:
  std::string id_;
  NvsKv kv_;
  app::RtcState rtc_{};
  bool powered_ = false, connected_ = false, synced_ = false, motion_latched_ = false, usb_ = false;
  app::WakeCause cause_ = app::WakeCause::PowerOn;
  app::WifiStats stats_;
  int64_t power_on_at_ = 0, wake_at_ = 0, led_on_at_ = 0, busy_until_ = 0;
  std::vector<std::function<void()>> edges_;
  app::Led led_ = app::Led::Off;
  uint64_t gen_ = 0, tick_gen_ = 0;
  int64_t spin_at_ = -1;
  int spins_ = 0;

  // §11: the device keeps a 256-bit secret in NVS, created on first boot. A real device draws it
  // from a hardware RNG; the twin derives it from (seed, device id, NVS generation) so the same
  // virtual device keeps its identity across twin runs against a backend that remembers it.
  // wipeNvs() starts a new generation: a new secret, like a real NVS wipe (admin must reset it).
  void ensureSecret() {
    if (!kv_.getStr("secret", link.secret)) {
      std::seed_seq seq(env_.ep.secret_seed.begin(), env_.ep.secret_seed.end());
      Rng r(seq);
      r.seed(r() ^ std::hash<std::string>{}(id_) ^ (uint64_t)nvs_generation_ * 0x9E3779B97F4A7C15ull);
      char hex[65];
      for (int i = 0; i < 4; i++) snprintf(hex + 16 * i, 17, "%016llx", (unsigned long long)r());
      link.secret = hex;
      kv_.setStr("secret", link.secret);
    }
    link.device_id = id_;
  }

 public:
  void wipeNvs() {  // reflash with erase: queue, config cache, epoch and secret are gone
    kv_.m.clear();
    nvs_generation_++;
  }

 private:
  int nvs_generation_ = 0;

  void retire() {  // the app stops now; its object is freed from the scheduler
    gen_++;
    tick_gen_++;
    edges_.clear();
    if (app_) env_.clk.after(0, [dead = std::shared_ptr<App>(std::move(app_))] {});
  }
};

}  // namespace sim
