#include <algorithm>
// GoalApp orchestration against a fake HAL: what the device does on each wake,
// which requests it sends, how it reacts to answers, and what it asks of the hardware.
#include <string.h>
#include <unity.h>

#include <functional>
#include <map>
#include <string>
#include <vector>

#include "goal_app.h"

using app::Lane;
using app::WakeCause;

struct FakeKv : Kv {
  std::map<std::string, std::string> m;
  bool getU32(const char* k, uint32_t& o) override { return getBlob(k, &o, sizeof o); }
  bool setU32(const char* k, uint32_t v) override { return setBlob(k, &v, sizeof v); }
  bool getBlob(const char* k, void* b, size_t n) override {
    auto it = m.find(k);
    if (it == m.end() || it->second.size() != n) return false;
    memcpy(b, it->second.data(), n);
    return true;
  }
  bool setBlob(const char* k, const void* b, size_t n) override {
    m[k] = std::string((const char*)b, n);
    return true;
  }
  bool getStr(const char* k, std::string& o) override {
    auto it = m.find(k);
    if (it == m.end()) return false;
    o = it->second;
    return true;
  }
  bool setStr(const char* k, const std::string& v) override {
    m[k] = v;
    return true;
  }
  void remove(const char* k) override { m.erase(k); }
};

struct Req {
  uint32_t id;
  Lane lane;
  std::string method, path, body;
};

struct FakeHal : app::Hal {
  uint32_t now = 0, rtc_s = 1000;
  int64_t epoch = 0;
  int mv = 3900;
  bool blocked = false, motion = false, board = false, otlp = true, beam_on = false, ap_down = false;
  int wifi_offs = 0;
  FakeKv store;
  std::vector<Req> sent;
  std::vector<std::string> lines;
  bool slept = false, usb = false;
  int light_sleep = -1;  // last lightSleep() call, -1 = never
  std::vector<std::pair<uint32_t, int>> tones;  // (hz, volume) per change
  app::SleepRequest sleep;
  app::WifiStats wifi;

  uint32_t millis() override { return now; }
  int64_t epochMs() override { return epoch ? epoch + now : 0; }
  uint32_t rtcSeconds() override { return rtc_s + now / 1000; }
  int batteryMv() override { return mv; }
  Kv& kv() override { return store; }
  uint32_t random() override { return 0x9c41e07a; }
  void print(const std::string& l) override { lines.push_back(l); }
  std::string deviceId() override { return "fb-a0b1c2d3e4f5"; }
  std::string resetReason() override { return "deepsleep"; }
  void send(uint32_t id, Lane lane, const char* m, const std::string& p, const std::string& b, uint32_t) override {
    sent.push_back({id, lane, m, p, b});
    if (ap_down)
      wifi.failed_attempts++;
    else if (!wifi.connects)
      wifi = {1, 640, -61, 0}, epoch = epoch ? epoch : 1792006923000LL;  // connect + NTP
  }
  bool otlpEnabled() override { return otlp; }
  void wifiOff() override { wifi_offs++; }
  int tx_low = -1;  // last wifiTxLow(), -1 = never
  void wifiTxLow(bool low) override { tx_low = low; }
  app::WifiStats wifiStats() override { return wifi; }
  void deepSleep(const app::SleepRequest& r) override { slept = true, sleep = r; }
  void boardInit() override { board = true; }
  void beamPower(bool on) override { beam_on = on; }
  bool beamBlocked() override { return blocked; }
  bool motionSeen() override { return motion; }
  std::vector<std::pair<uint32_t, app::Led>> leds;  // the status LED: (ms, colour) per change
  void statusLed(app::Led c) override { leds.push_back({now, c}); }
  bool btn = false;  // the undo button
  bool buttonDown() override { return btn; }
  bool oled_on = false;  // the debug OLED
  int oled_draws = 0;
  app::StatusView view{};
  void oled(const app::StatusView* v) override {
    oled_on = v;
    if (v) view = *v, oled_draws++;
  }
  std::string line(int i) { return view.line[i]; }
  bool inverse(int i) { return view.inverse >> i & 1; }
  bool usbPowered() override { return usb; }
  void lightSleep(bool on) override { light_sleep = on; }
  void tone(uint32_t hz, int duty) override { tones.push_back({hz, duty}); }
  // beam health: no ADC unless a test fits one
  bool beam_adc = false;
  beam::Reading beam_now;
  int ball_mv = -1, checks = 0;
  std::vector<beam::Mode> modes;
  void beamMode(beam::Mode m, uint32_t) override { modes.push_back(m); }
  bool beamCheck(uint32_t, beam::Reading& r) override {
    if (!beam_adc) return false;
    checks++;
    r = beam_now;
    return true;
  }
  int beamMv() override { return beam_adc ? ball_mv : -1; }
  int chop_clear = 1200;  // plan C: a chopped read's clear difference in mV, 0 while blocked
  int chops = 0;
  int beamChop() override { return beam_adc ? (chops++, blocked ? 0 : chop_clear) : -1; }

  // The request still waiting for an answer on `lane` whose path contains `what`.
  const Req* find(const char* what) {
    for (auto it = sent.rbegin(); it != sent.rend(); ++it)
      if (it->path.find(what) != std::string::npos) return &*it;
    return nullptr;
  }
  bool any(const char* what) { return find(what) != nullptr; }
  bool printed(const char* what) {
    for (auto& l : lines)
      if (l.find(what) != std::string::npos) return true;
    return false;
  }
};

template <class App>
static void answer(FakeHal& h, App& a, const char* what, int code, const std::string& body = "") {
  const Req* r = h.find(what);
  TEST_ASSERT_NOT_NULL_MESSAGE(r, what);
  uint32_t id = r->id;
  a.response(id, code, body);
}

template <class App>
static void run(FakeHal& h, App& a, uint32_t until) {  // tick through virtual time
  while (h.now < until && !a.asleep()) {
    uint32_t ms = a.tick();
    if (a.asleep()) break;
    h.now = std::min<uint64_t>(until, (uint64_t)h.now + std::max<uint32_t>(1, std::min<uint32_t>(ms, 1000)));
  }
}

static const char* CONFIG = R"({"role":"goal","table_id":"table-1","goal":"home","idle_timeout_s":60})";
static app::RtcState rtc;
static app::GoalOptions gopt;

void setUp() {
  memset(&rtc, 0, sizeof rtc);
  rtc.init(1);
}
void tearDown() {}

// ---- goal counter

void test_goal_boot_counts_and_delivers() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::PowerOn);  // D7 strapped to GND: right board
  TEST_ASSERT_TRUE(h.board && h.beam_on);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  TEST_ASSERT_EQUAL_STRING("home", g.config().goal.c_str());
  TEST_ASSERT_TRUE(h.store.m.count("cfg"));  // cached for the next wake
  run(h, g, 100);  // beam warmed up
  h.blocked = true;
  g.beam(true, 200);
  run(h, g, 240);
  h.blocked = false;
  g.beam(false, 240);
  run(h, g, 250);
  TEST_ASSERT_FALSE(h.any("/goal-events"));  // the chirp first: no TX on top of the buzzer (review 2)
  run(h, g, 500);
  TEST_ASSERT_EQUAL_UINT32(1, rtc.goals);
  TEST_ASSERT_EQUAL_UINT32(1, g.queue().size());  // persisted before sending
  const Req* ev = h.find("/goal-events");
  TEST_ASSERT_NOT_NULL(ev);
  TEST_ASSERT_TRUE(ev->body.find("\"goal\":\"home\"") != std::string::npos);
  answer(h, g, "/goal-events", 201);
  TEST_ASSERT_EQUAL_UINT32(0, g.queue().size());
}

void test_goal_retries_with_backoff_then_delivers() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::PowerOn);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  run(h, g, 100);
  h.blocked = true;
  run(h, g, 200);
  h.blocked = false;
  run(h, g, 500);
  size_t before = h.sent.size();
  answer(h, g, "/goal-events", 503);
  run(h, g, 4000);
  TEST_ASSERT_EQUAL_UINT(before, h.sent.size() - (h.any("/v1/logs") ? 1 : 0));  // nothing re-sent before 5 s
  run(h, g, 5600);
  TEST_ASSERT_EQUAL_STRING("/goal-events", h.sent.back().path.c_str());
  answer(h, g, "/goal-events", 409);  // the first one did arrive: done
  TEST_ASSERT_EQUAL_UINT32(0, g.queue().size());
}

void test_goal_idle_reports_then_sleeps_with_heartbeat_timer() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);  // idle 60 s
  run(h, g, 61000);
  const Req* st = h.find("/status");
  TEST_ASSERT_NOT_NULL(st);
  TEST_ASSERT_TRUE(st->body.find("\"reason\":\"sleep\"") != std::string::npos);
  TEST_ASSERT_TRUE(st->body.find("\"role\":\"goal\"") != std::string::npos);
  answer(h, g, "/status", 204);
  g.tick();
  answer(h, g, "/v1/metrics", 200);
  g.tick();
  answer(h, g, "/v1/logs", 200);
  g.tick();
  TEST_ASSERT_TRUE(g.asleep() && h.slept);
  TEST_ASSERT_FALSE(h.beam_on);
  TEST_ASSERT_EQUAL_UINT32(86400, h.sleep.timer_s);  // next heartbeat in 24 h
  TEST_ASSERT_EQUAL_UINT32(1, rtc.log.pending());  // all shipped but the "deep sleep" line: next wake
}

void test_goal_motion_keeps_it_awake() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  h.motion = true;  // table in use, no goals
  run(h, g, 120000);
  TEST_ASSERT_FALSE(h.any("/status"));
}

// ---- the undo button + buzzer (ux/goal-counter-phase1-2026-10-17.md Part B)

static void goalAt(FakeHal& h, app::GoalApp& g, uint32_t t) {  // a ball through the beam at t
  run(h, g, t);
  h.blocked = true;
  g.beam(true, t);
  run(h, g, t + 40);
  h.blocked = false;
  g.beam(false, t + 40);
  run(h, g, t + 300);  // the chirp (~0.22 s) plays before the POST goes out (review 2)
}

static void press(FakeHal& h, app::GoalApp& g, uint32_t t, uint32_t ms) {
  run(h, g, t);
  h.btn = true;
  g.button(true, t);
  run(h, g, t + ms);
  h.btn = false;
  g.button(false, t + ms);
  g.tick();
}

static int count(FakeHal& h, const char* what) {
  int n = 0;
  for (auto& l : h.lines) n += l.find(what) != std::string::npos;
  return n;
}

void test_goal_undo_button() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::PowerOn);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  goalAt(h, g, 200);
  TEST_ASSERT_TRUE(h.printed("[sound] goal volume=2"));  // the chirp, at once (no beep = not counted)
  TEST_ASSERT_EQUAL_UINT32(1760, h.tones[0].first);
  answer(h, g, "/goal-events", 201);
  run(h, g, 1000);
  TEST_ASSERT_EQUAL_UINT32(0, h.tones.back().first);  // silent again

  press(h, g, 2000, 900);  // too short: the tick only
  TEST_ASSERT_TRUE(h.printed("[sound] scan"));
  TEST_ASSERT_FALSE(h.any("/undo-events"));
  press(h, g, 2910, 20);  // a bounce right after the release: the same press, no second tick
  TEST_ASSERT_EQUAL_INT(1, count(h, "[sound] scan"));

  h.btn = true;  // a real hold: one undo, however long it is held
  g.button(true, 3000);
  g.button(false, 3005);  // contact bounce
  g.button(true, 3008);
  run(h, g, 6000);
  TEST_ASSERT_TRUE(h.printed("[sound] undo"));
  TEST_ASSERT_EQUAL_INT(2, count(h, "[sound] scan"));
  const Req* u = h.find("/undo-events");
  TEST_ASSERT_NOT_NULL(u);
  TEST_ASSERT_TRUE(u->body.find(R"("seq":1,)") != std::string::npos);
  TEST_ASSERT_TRUE(u->body.find(R"("undoes_event_id":"fb-a0b1c2d3e4f5-9c41e07a-0")") != std::string::npos);
  h.btn = false;
  g.button(false, 6000);
  answer(h, g, "/undo-events", 201);
  TEST_ASSERT_EQUAL_UINT32(0, g.queue().size());
  TEST_ASSERT_TRUE(h.printed("[undo] applied"));

  press(h, g, 7000, 1100);  // its only goal is undone: "no", nothing sent
  TEST_ASSERT_TRUE(h.printed("[undo] nothing to undo here"));
  TEST_ASSERT_TRUE(h.printed("[sound] not joined"));
  TEST_ASSERT_EQUAL_UINT32(0, g.queue().size());
}

void test_goal_undo_double_count_window_and_refusals() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::PowerOn);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  goalAt(h, g, 200);  // a double count: seq 0, 1
  answer(h, g, "/goal-events", 201);
  goalAt(h, g, 2000);
  answer(h, g, "/goal-events", 201);
  press(h, g, 3000, 1100);  // the newest first
  press(h, g, 5000, 1100);  // then the one before, still inside 10 s
  TEST_ASSERT_EQUAL_UINT32(2, g.queue().size());  // offline: both queued behind their goals
  TEST_ASSERT_TRUE(h.find("/undo-events")->body.find(R"(-9c41e07a-1")") != std::string::npos);
  answer(h, g, "/undo-events", 422, R"({"code":"too_late"})");
  TEST_ASSERT_TRUE(h.printed("[undo] refused by server: too_late"));
  TEST_ASSERT_EQUAL_INT(1, count(h, "[sound] not joined"));
  TEST_ASSERT_EQUAL_UINT32(0, g.queue().dropped());  // an answer, not a lost event
  run(h, g, h.now + 200);  // after the "no"
  TEST_ASSERT_TRUE(h.find("/undo-events")->body.find(R"(-9c41e07a-0")") != std::string::npos);
  answer(h, g, "/undo-events", 409);  // a retry of one that worked: done, no "no"
  TEST_ASSERT_TRUE(h.printed("[undo] already applied"));
  TEST_ASSERT_EQUAL_INT(1, count(h, "[sound] not joined"));
  TEST_ASSERT_EQUAL_UINT32(0, g.queue().size());

  goalAt(h, g, 8000);
  answer(h, g, "/goal-events", 201);
  size_t sent = h.sent.size();
  press(h, g, 18100, 1100);  // hold reached 11.1 s after the goal: outside the window, refused locally
  TEST_ASSERT_EQUAL_INT(2, count(h, "[sound] not joined"));
  for (size_t i = sent; i < h.sent.size(); i++) TEST_ASSERT_TRUE(h.sent[i].path.find("/undo-events") == std::string::npos);
}

void test_goal_button_wake_shows_status_and_stuck_button() {
  FakeHal h;
  h.btn = true;  // the press that woke it, still held
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Key);
  g.tick();
  TEST_ASSERT_TRUE(h.printed("[undo] woken by the button"));
  TEST_ASSERT_FALSE(h.printed("[sound]"));  // a press from deep sleep shows the screen; only a hold means more
  answer(h, g, "/config", 200, CONFIG);
  run(h, g, 1001);  // the hold counts from the wake: nothing is ever inside the window, "no"
  TEST_ASSERT_EQUAL_INT(1, count(h, "[sound] not joined"));
  TEST_ASSERT_EQUAL_STRING("Undo: too late", h.line(0).c_str());
  TEST_ASSERT_TRUE(h.inverse(0));
  run(h, g, 12000);  // held on: no undo, no second "no", then "button stuck" (log only)
  TEST_ASSERT_FALSE(h.printed("[sound] undo"));
  TEST_ASSERT_EQUAL_INT(1, count(h, "[sound] not joined"));
  TEST_ASSERT_TRUE(h.printed("[undo] button stuck"));
  run(h, g, 30000);  // a stuck button doesn't keep the screen on
  TEST_ASSERT_FALSE(h.oled_on);
  run(h, g, 70000);  // a stuck button isn't activity: it idles out and asks for the key wake (the glue
  TEST_ASSERT_TRUE(h.any("/status"));  // leaves a held pin out and re-checks on a timer)
  h.btn = false;
  g.button(false, 70000);
  TEST_ASSERT_TRUE(h.printed("[undo] button released"));
}

// ---- the debug OLED (ux/goal-counter-phase1-2026-10-17.md B5)

void test_goal_oled_short_press_shows_status() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  goalAt(h, g, 200);
  TEST_ASSERT_EQUAL_INT(0, h.oled_draws);  // off until the button
  run(h, g, 2000);
  h.btn = true;
  g.button(true, 2000);
  g.tick();
  TEST_ASSERT_TRUE(h.oled_on);  // at press-down
  TEST_ASSERT_EQUAL_STRING("OK      End home", h.line(0).c_str());  // the verdict
  TEST_ASSERT_EQUAL_STRING("WiFi -61 srv ok", h.line(1).c_str());   // the details cycle, 2 s each
  TEST_ASSERT_EQUAL_INT(0, h.view.inverse);
  run(h, g, 2300);
  h.btn = false;
  g.button(false, 2300);  // short: no undo, on for 10 s from the release
  run(h, g, 4000);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("Batt 3.90V  Q 1", h.line(1).c_str());  // the goal's 201 is still out
  run(h, g, 6000);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("Beam a ok --", h.line(1).c_str());  // no beam check yet: no margin
  run(h, g, 8000);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("End home v0.0.0-", h.line(1).c_str());  // cut at 16
  answer(h, g, "/goal-events", 503);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("srv err", h.line(0).c_str());
  TEST_ASSERT_TRUE(h.inverse(0));
  h.blocked = true;  // a hand in the gate: live, over any fault
  g.beam(true, 9000);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("Beam BLOCKED", h.line(0).c_str());
  TEST_ASSERT_TRUE(h.inverse(0));
  h.blocked = false;
  g.beam(false, 9001);  // too short for a goal
  run(h, g, 9100);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("srv err", h.line(0).c_str());
  run(h, g, 10000);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("WiFi -61 srv err", h.line(1).c_str());  // round again, the fault in inverse
  TEST_ASSERT_TRUE(h.inverse(1));
  run(h, g, 12299);
  TEST_ASSERT_TRUE(h.oled_on);
  int draws = h.oled_draws;
  run(h, g, 12301);
  TEST_ASSERT_FALSE(h.oled_on);
  TEST_ASSERT_TRUE(draws < 15);  // redrawn on changes only
  TEST_ASSERT_FALSE(h.any("/undo-events"));
}

void test_goal_oled_undo_result_and_no_table() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::PowerOn);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  goalAt(h, g, 200);
  answer(h, g, "/goal-events", 201);
  press(h, g, 2000, 1200);  // an undo
  TEST_ASSERT_EQUAL_STRING("Undo queued", h.line(0).c_str());
  TEST_ASSERT_FALSE(h.inverse(0));
  run(h, g, 3400);  // the undo sound first
  answer(h, g, "/undo-events", 201);
  g.tick();
  TEST_ASSERT_EQUAL_STRING("Undo ok", h.line(0).c_str());
  run(h, g, 8500);  // 5 s later the verdict is back
  g.tick();
  TEST_ASSERT_EQUAL_STRING("OK      End home", h.line(0).c_str());

  goalAt(h, g, 9000);
  run(h, g, 15000);
  answer(h, g, "/goal-events", 201);
  press(h, g, 15000, 1200);
  run(h, g, 16400);  // the undo sound first
  answer(h, g, "/undo-events", 422, R"({"code":"too_late"})");  // the server's window
  g.tick();
  TEST_ASSERT_EQUAL_STRING("Undo: too late", h.line(0).c_str());
  TEST_ASSERT_TRUE(h.inverse(0));
  run(h, g, 40000);
  TEST_ASSERT_FALSE(h.oled_on);

  FakeHal h2;  // unassigned: config 404
  h2.mv = 3700;
  app::GoalApp g2(h2, rtc, gopt);
  g2.boot(WakeCause::Key);  // short press from deep sleep, already released
  g2.tick();
  TEST_ASSERT_TRUE(h2.oled_on);  // at boot, before Wi-Fi settles
  answer(h2, g2, "/config", 404);
  g2.tick();
  TEST_ASSERT_EQUAL_STRING("NO TABLE", h2.line(0).c_str());  // the worst fault first (over srv 404, low batt)
  TEST_ASSERT_TRUE(h2.inverse(0));
  run(h2, g2, 2000);
  g2.tick();
  TEST_ASSERT_EQUAL_STRING("Batt 3.70V  Q 0", h2.line(1).c_str());
  TEST_ASSERT_TRUE(h2.inverse(1));
  run(h2, g2, 9900);  // on for 10 s after the server answered
  TEST_ASSERT_TRUE(h2.oled_on);
  run(h2, g2, 10100);
  TEST_ASSERT_FALSE(h2.oled_on);
  TEST_ASSERT_FALSE(h2.printed("[sound]"));

  FakeHal h3;  // power-on (cells pushed into the drawer): the same, so the swapper sees it worked
  h3.mv = 3700;
  app::GoalApp g3(h3, rtc, gopt);
  g3.boot(WakeCause::PowerOn);
  g3.tick();
  TEST_ASSERT_TRUE(h3.oled_on);
  TEST_ASSERT_EQUAL_STRING("WiFi ...", h3.line(1).c_str());  // connecting
  g3.tick();
  TEST_ASSERT_EQUAL_STRING("WiFi -61 srv ..", h3.line(1).c_str());  // connected, no answer yet
  TEST_ASSERT_FALSE(h3.inverse(1));
  answer(h3, g3, "/config", 200, CONFIG);
  g3.tick();
  TEST_ASSERT_EQUAL_STRING("Batt low 3.70V", h3.line(0).c_str());
  FakeHal h4;
  app::GoalApp g4(h4, rtc, gopt);
  g4.boot(WakeCause::PowerOn);
  g4.tick();
  g4.tick();
  run(h4, g4, 29900);  // the server never answers: off at 30 s
  TEST_ASSERT_TRUE(h4.oled_on);
  run(h4, g4, 30100);
  TEST_ASSERT_FALSE(h4.oled_on);
  TEST_ASSERT_FALSE(h4.printed("[sound]"));
}

void test_heartbeat_wake_reports_without_touching_the_board() {
  FakeHal h;
  rtc.heartbeat_due_s = 1000;
  h.ap_down = true;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Timer);
  TEST_ASSERT_FALSE(h.board);
  g.tick();
  TEST_ASSERT_FALSE(h.any("/config"));
  TEST_ASSERT_TRUE(h.find("/status")->body.find("\"reason\":\"heartbeat\"") != std::string::npos);
  answer(h, g, "/status", 0);  // AP down
  g.tick();
  TEST_ASSERT_TRUE(g.asleep());       // no clock: OTLP skipped
  TEST_ASSERT_EQUAL_UINT32(3600, h.sleep.timer_s);  // failed: retry in 1 h, not 24 h
}

void test_timer_wake_not_due_sleeps_at_once() {
  FakeHal h;
  rtc.heartbeat_due_s = 50000;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Timer);
  TEST_ASSERT_TRUE(g.asleep());
  TEST_ASSERT_TRUE(h.sent.empty());
  TEST_ASSERT_EQUAL_UINT32(49000, h.sleep.timer_s);
}

void test_cutoff_reports_once_then_stays_quiet() {
  FakeHal h;
  h.mv = 3200;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  TEST_ASSERT_TRUE(h.find("/status")->body.find("\"reason\":\"cutoff\"") != std::string::npos);
  TEST_ASSERT_TRUE(h.find("/status")->body.find("\"low_batt\":true") != std::string::npos);
  answer(h, g, "/status", 204);
  g.tick();
  answer(h, g, "/v1/metrics", 200);
  g.tick();
  answer(h, g, "/v1/logs", 200);
  g.tick();
  TEST_ASSERT_TRUE(g.asleep());
  TEST_ASSERT_EQUAL_UINT32(0, h.sleep.timer_s);  // no heartbeat on flat cells
  FakeHal h2;  // next motion wake, rested cells bounced to 3.7 V: still below resume
  h2.mv = 3700;
  app::GoalApp g2(h2, rtc, gopt);
  g2.boot(WakeCause::Motion);
  TEST_ASSERT_TRUE(g2.asleep() && h2.sent.empty() && !h2.board);
}

void test_battery_calibration_over_usb() {
  FakeHal h;
  h.usb = true, h.mv = 3800;  // at assembly: cells in, USB for the serial log
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Usb);
  g.command("cal 3895");  // a bench supply on J_BAT; the meter says 3895
  TEST_ASSERT_TRUE(h.printed("cal: raw 3800 mV, meter 3895 mV -> gain 1.0250 offset +0 mV saved (now a 2nd point"));
  TEST_ASSERT_EQUAL_UINT32(10250, *(uint32_t*)h.store.m["vbat_cal"].data());
  h.mv = 4500;  // the second point, at another voltage: gain + offset through both
  g.command("cal 4580");
  TEST_ASSERT_TRUE(h.printed("cal: raw 4500 mV, meter 4580 mV -> gain 0.9786 offset +176 mV saved"));
  TEST_ASSERT_EQUAL_INT32(176, *(int32_t*)h.store.m["vbat_off"].data());
  g.command("cal 9000");  // a typo: refused
  TEST_ASSERT_TRUE(h.printed("cal: not saved"));
  g.command("help");
  TEST_ASSERT_TRUE(h.printed("commands: cal"));

  FakeHal b;  // the next boot on battery: the stored trim applies, without any server config
  b.store = h.store, b.mv = 3800;
  rtc.heartbeat_due_s = 1000;
  app::GoalApp gb(b, rtc, gopt);
  gb.boot(WakeCause::Timer);
  gb.tick();
  TEST_ASSERT_TRUE(b.find("/status")->body.find("\"battery_mv\":3895") != std::string::npos);  // 3800 x 0.9786 + 176
}

void test_vbat_scale_from_cached_config() {
  FakeHal h;
  h.store.m["cfg"] = R"({"vbat_scale":1.05})";
  h.mv = 3800;
  rtc.heartbeat_due_s = 1000;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Timer);
  g.tick();
  TEST_ASSERT_TRUE(h.find("/status")->body.find("\"battery_mv\":3990") != std::string::npos);
}

void test_per_goal_mode_drops_wifi_when_done() {
  FakeHal h;
  app::GoalOptions o = gopt;
  o.stay_associated = false;
  app::GoalApp g(h, rtc, o);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  h.otlp = false;
  g.tick();
  TEST_ASSERT_EQUAL_INT(1, h.wifi_offs);
}

void test_logs_shipped_every_minute_while_associated() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  h.motion = true;
  run(h, g, 59000);
  TEST_ASSERT_FALSE(h.any("/v1/logs"));
  run(h, g, 61000);
  TEST_ASSERT_TRUE(h.any("/v1/logs"));
  TEST_ASSERT_TRUE(h.find("/v1/logs")->body.find("\"resourceLogs\"") != std::string::npos);
  TEST_ASSERT_EQUAL_INT(Lane::Otlp == h.find("/v1/logs")->lane, 1);
  for (int i = 0; i < 20; i++) rtc.log.add(tel::Level::Info, "test", "fill", {}, 0, 0, 0);  // > one batch
  answer(h, g, "/v1/logs", 200);
  size_t before = h.sent.size();
  g.tick();  // the rest goes at once, not 60 s later
  TEST_ASSERT_TRUE(h.sent.size() > before && h.sent.back().path.find("/v1/logs") != std::string::npos);
}

// Beam health (firmware/beam-health-firmware-2026-10-16.md): a check right after warm-up and every
// beam_check_s while the beam reads clear; a worse state sends a status at once (reason "beam"); the
// readings ride in every status; the configured mode reaches the pins.
void test_goal_beam_health() {
  FakeHal h;
  h.beam_adc = true;
  h.beam_now = {3300 - 22, 3300 - 61 * 20, 3300 - 2};  // 0.1 µA ambient, 60 µA lit at 1 mA: 5.3x
  h.motion = true;                            // keep playing
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, R"({"role":"goal","goal":"home","idle_timeout_s":60,"beam_check_s":30})");
  run(h, g, 100);
  TEST_ASSERT_EQUAL_INT(1, h.checks);
  TEST_ASSERT_TRUE(!h.modes.empty() && h.modes.back() == beam::Mode::A);
  auto notes = [&] {
    return (int)std::count_if(h.sent.begin(), h.sent.end(),
                              [](const Req& r) { return r.body.find("\"reason\":\"beam\"") != std::string::npos; });
  };
  run(h, g, 25000);
  h.blocked = true;  // a ball rests in the beam across the 30 s check (< stuck_after_s): no check meanwhile
  run(h, g, 33000);
  TEST_ASSERT_EQUAL_INT(1, h.checks);
  h.blocked = false;
  answer(h, g, "/goal-events", 201);
  run(h, g, 36000);  // the lockout ran out: the overdue check now
  TEST_ASSERT_EQUAL_INT(2, h.checks);
  TEST_ASSERT_EQUAL_INT(0, notes());
  h.beam_now = {3300 - 3 * 220, 3300 - 63 * 20, 3300 - 3 * 20};  // daylight: 3 µA > 60 % of A's 3.75
  run(h, g, 67000);
  TEST_ASSERT_EQUAL_INT(1, notes());
  const Req* note = h.find("/status");
  TEST_ASSERT_TRUE(note->body.find("\"health\":\"ambient_high\"") != std::string::npos);
  TEST_ASSERT_TRUE(note->body.find("\"amb_ua\":3") != std::string::npos);
  TEST_ASSERT_TRUE(h.printed("[beam] health ambient_high"));
  answer(h, g, "/status", 204);
  run(h, g, 100000);  // still bright: no second note
  TEST_ASSERT_EQUAL_INT(1, notes());
  FakeHal h3;  // the next wake, still bright: the server already knows (RTC), so no new note
  h3.beam_adc = true, h3.motion = true, h3.beam_now = h.beam_now, h3.now = 0, h3.rtc_s = h.rtcSeconds() + 60;
  app::GoalApp g3(h3, rtc, gopt);
  g3.boot(WakeCause::Motion);
  g3.tick();
  answer(h3, g3, "/config", 200, R"({"role":"goal","goal":"home","idle_timeout_s":60,"beam_check_s":30})");
  run(h3, g3, 5000);
  TEST_ASSERT_TRUE(h3.printed("[beam] health ambient_high"));
  TEST_ASSERT_FALSE(h3.any("/status"));
  FakeHal h2;  // next wake: the server picked mode B -> the pins switch
  app::GoalApp g2(h2, rtc, gopt);
  g2.boot(WakeCause::Motion);
  g2.tick();
  answer(h2, g2, "/config", 200, R"({"role":"goal","goal":"home","beam_mode":"b"})");
  TEST_ASSERT_TRUE(h2.modes.back() == beam::Mode::B);
  TEST_ASSERT_TRUE(h2.printed("[beam] mode b (config)"));
}

// No ADC fitted (or an old board): one log line, no checks, the beam object carries nulls.
void test_goal_beam_without_adc() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  run(h, g, 70000);  // idle 60 s -> report
  TEST_ASSERT_TRUE(h.printed("[beam] no ADC: health checks off"));
  const Req* st = h.find("/status");
  TEST_ASSERT_NOT_NULL(st);
  TEST_ASSERT_TRUE(st->body.find("\"beam\":{\"health\":\"ok\",\"mode\":\"a\",\"amb_ua\":null") != std::string::npos);
}

// USB plugged in: never sleeps (deep or light) so it can be flashed in place; normal again unplugged.
void test_usb_keeps_it_awake_until_unplugged() {
  FakeHal h;
  h.usb = true;
  h.otlp = false;  // telemetry is covered elsewhere
  rtc.heartbeat_due_s = 50000;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Timer);  // even a heartbeat wake that isn't due
  TEST_ASSERT_FALSE(g.asleep());
  TEST_ASSERT_TRUE(h.board);
  TEST_ASSERT_EQUAL_INT(0, h.light_sleep);
  TEST_ASSERT_TRUE(h.printed("[usb] powered: staying awake"));
  g.tick();
  answer(h, g, "/config", 200, CONFIG);  // idle 60 s
  run(h, g, 61000);
  answer(h, g, "/status", 204);
  run(h, g, 200000);
  TEST_ASSERT_FALSE(g.asleep());  // reported, but held awake
  TEST_ASSERT_TRUE(g.tick() <= 1000);  // keeps checking VBUS
  h.usb = false;
  run(h, g, 202000);
  TEST_ASSERT_TRUE(g.asleep());
  TEST_ASSERT_EQUAL_INT(1, h.light_sleep);
  TEST_ASSERT_TRUE(h.printed("[usb] unplugged"));
}

// ---- the status LED (ux/status-led-2026-10-18.md §2)

static std::vector<std::pair<uint32_t, app::Led>> ledsFrom(FakeHal& h, uint32_t t0, uint32_t t1) {
  std::vector<std::pair<uint32_t, app::Led>> out;
  for (auto& x : h.leds)
    if (x.first >= t0 && x.first < t1) out.push_back(x);
  return out;
}

void test_status_led_awake_counts_and_colours() {
  using app::Led;
  using V = std::vector<std::pair<uint32_t, Led>>;
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  run(h, g, 1999);
  TEST_ASSERT_EQUAL_INT(4, (int)ledsFrom(h, 0, 2000).size());  // at boot, before the config: "no table", two red
  run(h, g, 4000);
  TEST_ASSERT_TRUE((ledsFrom(h, 2000, 4000) == V{{2000, Led::Green}, {2030, Led::Off}}));  // OK: one green every 2 s

  FakeHal h2;  // not assigned: two red
  app::GoalApp g2(h2, rtc, gopt);
  g2.boot(WakeCause::Motion);
  g2.tick();
  answer(h2, g2, "/config", 404);
  run(h2, g2, 4000);
  TEST_ASSERT_TRUE((ledsFrom(h2, 2000, 4000) == V{{2000, Led::Red}, {2030, Led::Off}, {2150, Led::Red}, {2180, Led::Off}}));

  FakeHal h3;  // battery low wins over the other faults: three red
  h3.mv = 3700;
  app::GoalApp g3(h3, rtc, gopt);
  g3.boot(WakeCause::Motion);
  g3.tick();
  answer(h3, g3, "/config", 404);
  run(h3, g3, 4000);
  TEST_ASSERT_EQUAL_INT(6, (int)ledsFrom(h3, 2000, 4000).size());
  TEST_ASSERT_TRUE(ledsFrom(h3, 2000, 4000)[4] == (std::pair<uint32_t, Led>{2300, Led::Red}));
}

void test_status_led_asleep_blinks_and_dark_cases() {
  FakeHal h;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  run(h, g, 61000);  // idle 60 s -> report
  answer(h, g, "/status", 204);
  run(h, g, 61100);
  answer(h, g, "/v1/metrics", 200);
  run(h, g, 61200);
  answer(h, g, "/v1/logs", 200);
  run(h, g, 61300);
  TEST_ASSERT_TRUE(h.slept);
  TEST_ASSERT_EQUAL_INT(1, h.sleep.blinks);  // the LP core: one green
  TEST_ASSERT_TRUE(h.leds.back().second == app::Led::Off);  // the awake rhythm hands over dark

  rtc.heartbeat_due_s = 50000;  // a timer wake that isn't due: a silent re-sleep keeps the count
  FakeHal t;
  app::GoalApp gt(t, rtc, gopt);
  gt.boot(WakeCause::Timer);
  TEST_ASSERT_TRUE(gt.asleep());
  TEST_ASSERT_EQUAL_INT(1, t.sleep.blinks);
  TEST_ASSERT_TRUE(t.leds.empty());

  FakeHal c;  // cutoff: dark (nothing to drive it with)
  c.mv = 3300;
  app::GoalApp gc(c, rtc, gopt);
  gc.boot(WakeCause::Motion);
  run(c, gc, 100);
  answer(c, gc, "/status", 204);
  run(c, gc, 200);
  answer(c, gc, "/v1/metrics", 200);
  run(c, gc, 300);
  answer(c, gc, "/v1/logs", 200);
  run(c, gc, 400);
  TEST_ASSERT_TRUE(c.slept);
  TEST_ASSERT_EQUAL_INT(0, c.sleep.blinks);
  TEST_ASSERT_TRUE(c.leds.empty());
}

// ---- hardware review 2 (electronics-review/2026-10-18-CONSOLIDATED.md)

void test_review2_battery_rules() {
  FakeHal h;  // a tuned cutoff from the server (cached) beats board.h's: 3600 mV is no cutoff at 3500
  h.store.m["cfg"] = R"({"table_id":"t","goal":"home","batt_cutoff_mv":3500,"batt_warn_mv":3700})";
  h.mv = 3600;
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  TEST_ASSERT_TRUE(h.board && h.any("/config"));
  TEST_ASSERT_TRUE(h.printed("[boot] motion wake=1 mv=3600"));
  TEST_ASSERT_EQUAL_INT(1, h.tx_low);  // 3600 < the tuned warn 3700

  FakeHal u;  // USB only: the charger's leak fakes a pack, so no battery reading at all
  u.usb = true, u.mv = 2000;
  app::GoalApp gu(u, rtc, gopt);
  gu.boot(WakeCause::Usb);
  TEST_ASSERT_TRUE(u.printed("mv=-1"));

  FakeHal n;  // near the cutoff: a goal while a request is on the air waits in RAM, then is written
  n.mv = 3700;
  app::GoalApp gn(n, rtc, gopt);
  gn.boot(WakeCause::Motion);
  gn.tick();  // GET config in flight
  goalAt(n, gn, 200);
  TEST_ASSERT_EQUAL_UINT32(0, gn.queue().size());  // held: no flash write during TX
  TEST_ASSERT_FALSE(n.printed("[sound] goal"));    // and no chirp on top of the TX either (round 3)
  TEST_ASSERT_TRUE(n.tones.empty());
  answer(n, gn, "/config", 200, CONFIG);
  gn.tick();
  TEST_ASSERT_EQUAL_INT(1, n.tx_low);               // round 3: TX power down below warn
  TEST_ASSERT_TRUE(n.printed("[sound] goal"));     // the radio is quiet: chirp first ...
  TEST_ASSERT_FALSE(n.any("/goal-events"));
  run(n, gn, n.now + 300);                         // ... then the POST
  TEST_ASSERT_EQUAL_UINT32(1, gn.queue().size());
  TEST_ASSERT_TRUE(n.find("/goal-events")->body.find("\"seq\":0,") != std::string::npos);

  FakeHal li;  // lithium cells (5.4 V): the buzzer's duty scaled by (5000 / 5400)^2
  li.mv = 5400;
  app::GoalApp gl(li, rtc, gopt);
  gl.boot(WakeCause::Motion);
  gl.tick();
  answer(li, gl, "/config", 200, CONFIG);
  goalAt(li, gl, 200);
  FakeHal ni;
  app::GoalApp gi(ni, rtc, gopt);
  gi.boot(WakeCause::Motion);
  gi.tick();
  answer(ni, gi, "/config", 200, CONFIG);
  goalAt(ni, gi, 200);
  TEST_ASSERT_INT_WITHIN(15, ni.tones[1].second * 857 / 1000, li.tones[1].second);
}

void test_ball_light_only_while_the_ball_is_in_the_beam() {
  FakeHal h;  // twin plan C finding 2: a count processed after the ball left must not read the lit node
  h.beam_adc = true, h.ball_mv = 3300 - 15 * 220;  // the node as the clear beam leaves it: 15 µA "around the ball"
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, CONFIG);
  run(h, g, 200);
  g.beam(true, 200);  // both edges reach the app at once (it was busy): the ball has left by then
  g.beam(false, 240);
  g.tick();
  TEST_ASSERT_EQUAL_UINT32(1, rtc.goals);
  TEST_ASSERT_TRUE(g.beamMonitor().ball_ua < 0);  // not read
  run(h, g, 3000);
  h.ball_mv = 3300 - 1;  // a normal goal: counted while the ball is still in the beam
  goalAt(h, g, 3000);
  TEST_ASSERT_EQUAL_UINT32(2, rtc.goals);
  TEST_ASSERT_TRUE(g.beamMonitor().ball_ua >= 0);
}

void test_review2_chopped_reads_in_daylight() {
  FakeHal h;
  h.beam_adc = true, h.motion = true;
  h.beam_now = {3300 - 3 * 220, 3300 - 63 * 20, 3300 - 3 * 20};  // daylight: ambient_high in mode a
  app::GoalApp g(h, rtc, gopt);
  g.boot(WakeCause::Motion);
  g.tick();
  answer(h, g, "/config", 200, R"({"table_id":"t","goal":"home","idle_timeout_s":300,"beam_check_s":30})");
  run(h, g, 29000);
  TEST_ASSERT_FALSE(h.printed("[beam] chopped reads on"));  // one bright check isn't "persists"
  run(h, g, 31000);
  TEST_ASSERT_TRUE(h.printed("[beam] chopped reads on (ambient high)"));
  int polls = h.chops;
  g.beam(true, 32000);  // D8 alone (daylight trips the comparator): not a goal any more
  g.beam(false, 32040);
  run(h, g, 33000);
  TEST_ASSERT_EQUAL_UINT32(0, rtc.goals);
  TEST_ASSERT_TRUE(h.chops - polls >= 300);  // every 3 ms (round 3)
  h.blocked = true;  // a hard shot: the LED's difference collapses for only 9 ms
  run(h, g, 33009);
  h.blocked = false;
  run(h, g, 33400);
  TEST_ASSERT_EQUAL_UINT32(1, rtc.goals);
  h.beam_now = {3300 - 22, 3300 - 61 * 20, 3300 - 2};  // evening: the next check is clean
  run(h, g, 62000);
  TEST_ASSERT_TRUE(h.printed("[beam] chopped reads off"));
  TEST_ASSERT_EQUAL_INT(0, h.tx_low);  // a full pack: normal TX power

  FakeHal s;  // sun straight onto the table: ambient beyond what D8 tolerates (3.75 µA in a) at the first check
  s.beam_adc = true, s.motion = true;
  s.beam_now = {3300 - 5 * 220, 3300 - 65 * 20, 3300 - 5 * 20};
  app::GoalApp gs(s, rtc, gopt);
  gs.boot(WakeCause::Motion);
  gs.tick();
  answer(s, gs, "/config", 200, R"({"table_id":"t","goal":"home","idle_timeout_s":300,"beam_check_s":30})");
  run(s, gs, 200);
  TEST_ASSERT_TRUE(s.printed("[beam] chopped reads on"));  // at once: D8 is blind, no waiting for a 2nd check
  uint32_t before = rtc.goals;
  s.blocked = true;
  run(s, gs, 1009);
  s.blocked = false;
  run(s, gs, 1400);
  TEST_ASSERT_EQUAL_UINT32(before + 1, rtc.goals);
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_goal_boot_counts_and_delivers);
  RUN_TEST(test_goal_retries_with_backoff_then_delivers);
  RUN_TEST(test_goal_idle_reports_then_sleeps_with_heartbeat_timer);
  RUN_TEST(test_goal_motion_keeps_it_awake);
  RUN_TEST(test_goal_undo_button);
  RUN_TEST(test_goal_undo_double_count_window_and_refusals);
  RUN_TEST(test_goal_button_wake_shows_status_and_stuck_button);
  RUN_TEST(test_goal_oled_short_press_shows_status);
  RUN_TEST(test_goal_oled_undo_result_and_no_table);
  RUN_TEST(test_heartbeat_wake_reports_without_touching_the_board);
  RUN_TEST(test_timer_wake_not_due_sleeps_at_once);
  RUN_TEST(test_cutoff_reports_once_then_stays_quiet);
  RUN_TEST(test_battery_calibration_over_usb);
  RUN_TEST(test_vbat_scale_from_cached_config);
  RUN_TEST(test_per_goal_mode_drops_wifi_when_done);
  RUN_TEST(test_logs_shipped_every_minute_while_associated);
  RUN_TEST(test_usb_keeps_it_awake_until_unplugged);
  RUN_TEST(test_goal_beam_health);
  RUN_TEST(test_goal_beam_without_adc);
  RUN_TEST(test_status_led_awake_counts_and_colours);
  RUN_TEST(test_status_led_asleep_blinks_and_dark_cases);
  RUN_TEST(test_review2_battery_rules);
  RUN_TEST(test_ball_light_only_while_the_ball_is_in_the_beam);
  RUN_TEST(test_review2_chopped_reads_in_daylight);
  return UNITY_END();
}
