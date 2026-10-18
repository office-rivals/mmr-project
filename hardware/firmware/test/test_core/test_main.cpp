#include <math.h>
#include <string.h>
#include <unity.h>

#include <map>
#include <string>
#include <vector>

#include "api.h"
#include "telemetry.h"
#include "beam_health.h"
#include "detector.h"
#include "event_queue.h"

// In-memory NVS. After `writes_left` hits 0 the "battery is pulled": every later
// write fails without landing. Each write is atomic, like NVS.
struct FakeKv : Kv {
  std::map<std::string, std::string> m;
  long writes_left = -1;  // -1 = unlimited
  bool getU32(const char* k, uint32_t& o) override { return getBlob(k, &o, sizeof o); }
  bool setU32(const char* k, uint32_t v) override { return setBlob(k, &v, sizeof v); }
  bool getBlob(const char* k, void* b, size_t n) override {
    auto it = m.find(k);
    if (it == m.end() || it->second.size() != n) return false;
    memcpy(b, it->second.data(), n);
    return true;
  }
  bool setBlob(const char* k, const void* b, size_t n) override {
    if (writes_left == 0) return false;
    if (writes_left > 0) writes_left--;
    m[k] = std::string((const char*)b, n);
    return true;
  }
};

void setUp() {}
void tearDown() {}

// ---- detector

void test_detector_counts_while_still_blocked() {
  Detector d;
  TEST_ASSERT_FALSE(d.update(true, 100));
  TEST_ASSERT_TRUE(d.pending());
  TEST_ASSERT_EQUAL_UINT32(2, d.msUntilDecision(103));
  TEST_ASSERT_TRUE(d.update(true, 105));
  TEST_ASSERT_FALSE(d.update(true, 200));  // once per block
  TEST_ASSERT_FALSE(d.update(false, 240));
}

void test_detector_counts_block_seen_only_by_edges() {
  Detector d;
  d.update(true, 100);
  TEST_ASSERT_TRUE(d.update(false, 140));
}

void test_detector_ignores_short_glitch() {
  Detector d;
  d.update(true, 100);
  TEST_ASSERT_FALSE(d.update(false, 103));
  TEST_ASSERT_FALSE(d.update(false, 500));
}

void test_detector_lockout_from_clear() {
  Detector d;
  d.lockout_ms = 1500;
  d.update(true, 1000);
  TEST_ASSERT_TRUE(d.update(true, 1010));
  d.update(false, 3000);                    // ball sat in the gate for 2 s; lockout starts now
  d.update(true, 4000);                     // rolled back through the beam
  TEST_ASSERT_FALSE(d.update(true, 4100));
  d.update(false, 4200);                    // re-arm pushed out to 5700
  d.update(true, 5600);
  TEST_ASSERT_FALSE(d.update(false, 5700));
  d.update(true, 7300);                     // next real goal
  TEST_ASSERT_TRUE(d.update(true, 7310));
}

void test_detector_stuck_ball() {
  Detector d;
  d.update(true, 0);
  TEST_ASSERT_TRUE(d.update(true, 5));  // counted once, even though it never clears
  TEST_ASSERT_FALSE(d.stuck(9999));
  TEST_ASSERT_FALSE(d.update(true, 10000));
  TEST_ASSERT_TRUE(d.stuck(10000));
  TEST_ASSERT_FALSE(d.pending());       // nothing to wait for: sleep until the clear edge
  d.update(false, 60000);
  TEST_ASSERT_FALSE(d.stuck(60000));
}

void test_detector_ball_present_at_wake() {
  Detector d;
  d.min_block_ms = 7;
  d.reset(true, 1000);
  TEST_ASSERT_EQUAL_UINT32(7, d.min_block_ms);  // tuning survives the reset
  TEST_ASSERT_FALSE(d.update(true, 2000));
  d.update(false, 3000);
  d.update(true, 3100);  // no lockout: nothing was counted
  TEST_ASSERT_TRUE(d.update(true, 3110));
}

// Phototransistor edges are slow (0.5-1 ms), so each transition can chatter.
void test_detector_chattering_edges_count_once() {
  Detector d;
  int goals = 0;
  const uint32_t t[] = {100, 100, 101, 101, 102};  // block start bouncing
  for (int i = 0; i < 5; i++) goals += d.update(i % 2 == 0, t[i]);
  goals += d.update(true, 120);
  for (uint32_t ms = 300; ms < 303; ms++) goals += d.update(ms % 2 == 0, ms);  // clear bouncing
  goals += d.update(false, 310);
  TEST_ASSERT_EQUAL_INT(1, goals);
}

void test_detector_wraps_millis() {
  Detector d;
  d.update(true, 0xFFFFFFF0u);
  TEST_ASSERT_TRUE(d.update(true, 0x20));
}

// ---- queue

void test_queue_fifo_and_persists() {
  FakeKv kv;
  {
    EventQueue q(kv);
    q.load(0x9c41e07a);
    for (uint32_t i = 0; i < 3; i++) TEST_ASSERT_TRUE(q.push(i * 10, 1000 + i));
    Event e;
    TEST_ASSERT_TRUE(q.peek(e));
    TEST_ASSERT_TRUE(q.pop(e.seq));
  }
  EventQueue q(kv);  // reboot
  q.load(0x9c41e07a);
  TEST_ASSERT_EQUAL_UINT32(2, q.size());
  Event e;
  TEST_ASSERT_TRUE(q.peek(e));
  TEST_ASSERT_EQUAL_UINT32(1, e.seq);
  TEST_ASSERT_EQUAL_UINT32(10, e.uptime_ms);
  TEST_ASSERT_FALSE(q.pop(2));  // only the oldest can be acked
  TEST_ASSERT_EQUAL_UINT32(3, q.nextSeq());
  TEST_ASSERT_EQUAL_HEX32(0x9c41e07a, q.epoch());
  EventQueue again(kv);
  again.load(0x1234);  // epoch is kept once stored
  TEST_ASSERT_EQUAL_HEX32(0x9c41e07a, again.epoch());
}

void test_queue_full_drops_oldest() {
  FakeKv kv;
  EventQueue q(kv);
  q.load(0x9c41e07a);
  for (uint32_t i = 0; i < EventQueue::CAP + 2; i++) q.push(i, 0);
  TEST_ASSERT_EQUAL_UINT32(EventQueue::CAP, q.size());
  Event e;
  TEST_ASSERT_TRUE(q.peek(e));
  TEST_ASSERT_EQUAL_UINT32(2, e.seq);
  TEST_ASSERT_EQUAL_UINT32(2, e.uptime_ms);
  TEST_ASSERT_TRUE(q.pop(e.seq, true));  // server rejected it
  TEST_ASSERT_EQUAL_UINT32(3, q.dropped());
  EventQueue again(kv);
  again.load(0);
  TEST_ASSERT_EQUAL_UINT32(3, again.dropped());
}

void test_queue_skips_corrupt_slot() {
  FakeKv kv;
  EventQueue q(kv);
  q.load(0x9c41e07a);
  q.push(1, 0);
  q.push(2, 0);
  kv.m.erase("e0");
  Event e;
  TEST_ASSERT_TRUE(q.peek(e));
  TEST_ASSERT_EQUAL_UINT32(1, e.seq);
}

// Pull the battery after every possible number of writes during a realistic
// sequence (goals, acks, offline overflow) and check the reboot state each time.
void test_queue_power_loss_at_every_write() {
  std::vector<char> ops;
  for (int i = 0; i < 5; i++) ops.push_back('P');
  for (int i = 0; i < 2; i++) ops.push_back('A');
  for (uint32_t i = 0; i < EventQueue::CAP + 3; i++) ops.push_back('P');  // offline: overflow
  for (int i = 0; i < 4; i++) ops.push_back('A');
  ops.push_back('P');

  long writes;  // count the writes of a clean run
  {
    FakeKv c;
    c.writes_left = 1L << 30;
    EventQueue q(c);
    q.load(0x9c41e07a);
    for (char op : ops) {
      Event e;
      if (op == 'P') q.push(7, 1);
      else if (q.peek(e)) q.pop(e.seq);
    }
    writes = (1L << 30) - c.writes_left;
  }

  for (long k = 0; k <= writes; k++) {
    FakeKv kv;
    kv.writes_left = k;
    std::map<uint32_t, uint32_t> pushed;  // seq -> uptime, for every push attempted
    std::vector<uint32_t> confirmed;      // pending seqs the firmware believes are durable
    uint32_t confirmed_next = 0, attempt = 0;
    {
      EventQueue q(kv);
      q.load(0x9c41e07a);
      for (char op : ops) {
        if (op == 'P') {
          uint32_t up = 1000 + attempt++;
          pushed[q.nextSeq()] = up;
          Event e;
          if (!q.push(up, 0, &e)) break;  // power gone
          confirmed.push_back(e.seq);
          confirmed_next = e.seq + 1;
          if (confirmed.size() > EventQueue::CAP) confirmed.erase(confirmed.begin());
        } else {
          Event e;
          if (!q.peek(e)) continue;
          if (!q.pop(e.seq)) break;
          confirmed.erase(confirmed.begin());
        }
      }
    }
    kv.writes_left = -1;  // new batteries
    EventQueue q(kv);
    q.load(0x9c41e07a);
    // seq never goes backwards, and at most the one in-flight push appears
    TEST_ASSERT_TRUE(q.nextSeq() >= confirmed_next);
    TEST_ASSERT_TRUE(q.nextSeq() <= confirmed_next + 1);
    std::vector<uint32_t> got;
    Event e;
    while (q.peek(e)) {
      TEST_ASSERT_EQUAL_UINT32(pushed[e.seq], e.uptime_ms);  // data intact
      got.push_back(e.seq);
      TEST_ASSERT_TRUE(q.pop(e.seq));
    }
    // every durable pending event survives (an in-flight overflow may drop the oldest one)
    for (size_t i = 0; i < confirmed.size(); i++) {
      bool found = false;
      for (uint32_t s : got) found |= s == confirmed[i];
      if (!found) TEST_ASSERT_TRUE_MESSAGE(i == 0 && confirmed.size() == EventQueue::CAP, "lost a queued event");
    }
    // and a new goal after reboot gets a fresh seq
    Event fresh;
    TEST_ASSERT_TRUE(q.push(1, 0, &fresh));
    for (auto& p : pushed)
      if (p.first < confirmed_next) TEST_ASSERT_TRUE(fresh.seq > p.first);
  }
}

// ---- api

void test_parse_config_partial_and_ranges() {
  api::Config c;
  TEST_ASSERT_TRUE(api::parseConfig(R"({"role":"goal","table_id":"t1","goal":"home","lockout_ms":900,"min_block_ms":0,"stuck_after_s":20})", c));
  TEST_ASSERT_EQUAL_UINT32(20, c.stuck_after_s);
  TEST_ASSERT_EQUAL_STRING("t1", c.table_id.c_str());
  TEST_ASSERT_EQUAL_STRING("home", c.goal.c_str());
  TEST_ASSERT_EQUAL_STRING("goal", c.role.c_str());
  TEST_ASSERT_EQUAL_UINT32(900, c.lockout_ms);
  TEST_ASSERT_EQUAL_UINT32(5, c.min_block_ms);  // 0 out of range -> default kept
  TEST_ASSERT_EQUAL_UINT32(300, c.idle_timeout_s);
  TEST_ASSERT_FALSE(api::parseConfig("not json", c));
  TEST_ASSERT_FALSE(api::parseConfig("[1]", c));
  TEST_ASSERT_EQUAL_STRING("t1", c.table_id.c_str());
  TEST_ASSERT_EQUAL_INT(2, c.sound_volume);  // missing = medium
  TEST_ASSERT_TRUE(api::parseConfig(R"({"role":"scoreboard","sound_volume":0})", c));
  TEST_ASSERT_EQUAL_INT(0, c.sound_volume);
  TEST_ASSERT_TRUE(api::parseConfig(R"({"role":"scoreboard"})", c));
  TEST_ASSERT_EQUAL_INT(2, c.sound_volume);  // missing again: back to 2, not the cached 0
  TEST_ASSERT_TRUE(api::parseConfig(R"({"role":"scoreboard","sound_volume":7})", c) && c.sound_volume == 2);  // spec-invalid
  TEST_ASSERT_EQUAL_UINT32(10, c.undo_window_s);  // the button's window: 10 s unless the server says
  TEST_ASSERT_TRUE(api::parseConfig(R"({"role":"goal","undo_window_s":15})", c) && c.undo_window_s == 15);
  TEST_ASSERT_TRUE(api::parseConfig(R"({"batt_cutoff_mv":3700,"batt_warn_mv":2500,"batt_resume_mv":4000})", c));
  TEST_ASSERT_EQUAL_INT(3700, c.batt_cutoff_mv);  // review 2: server-tunable thresholds
  TEST_ASSERT_EQUAL_INT(0, c.batt_warn_mv);        // out of range: ignored (board.h default)
  TEST_ASSERT_EQUAL_INT(4000, c.batt_resume_mv);
  api::Config b;  // beam health (firmware/beam-health-firmware-2026-10-16.md §6)
  TEST_ASSERT_TRUE(api::parseConfig(R"({"role":"goal","beam_mode":"auto","beam_check_s":0,"beam_margin_min":3,)"
                                    R"("beam_ambient_switch_ua":2.5,"beam_r_pu_b_ohm":20000,"beam_led_ma":[1.2,4.5]})", b));
  TEST_ASSERT_TRUE(b.beam.mode == beam::Mode::Auto);
  TEST_ASSERT_EQUAL_UINT32(0, b.beam.check_s);
  TEST_ASSERT_FLOAT_WITHIN(0.001, 3, b.beam.margin_min);
  TEST_ASSERT_FLOAT_WITHIN(0.001, 2.5, b.beam.switch_ua);
  TEST_ASSERT_FLOAT_WITHIN(0.5, 20000, b.beam.r_pu_b);
  TEST_ASSERT_FLOAT_WITHIN(0.001, 4.5, b.beam.led_ma[1]);
  api::Config d;  // out of range or unknown: defaults
  TEST_ASSERT_TRUE(api::parseConfig(R"({"beam_mode":"sunny","beam_check_s":5,"beam_led_ma":[1]})", d));  // spec-invalid
  TEST_ASSERT_TRUE(d.beam.mode == beam::Mode::A && d.beam.check_s == 60 && d.beam.led_ma[0] == 1.0f);
}

void test_goal_event_json() {
  api::Config c;
  c.table_id = "t1";
  Event e{123, 81234, 1792006923512LL};
  std::string s = api::goalEventJson("fb-a0b1c2d3e4f5", "0.1.0", c, 0x9c41e07a, e, 3870);
  TEST_ASSERT_EQUAL_STRING(
      R"({"event_id":"fb-a0b1c2d3e4f5-9c41e07a-123","device_id":"fb-a0b1c2d3e4f5","seq":123,)"
      R"("occurred_at":"2026-10-14T19:42:03.512Z","uptime_ms":81234,"table_id":"t1","goal":null,)"
      R"("battery_mv":3870,"firmware_version":"0.1.0"})",
      s.c_str());
  Event unsynced{1, 5, 0};
  TEST_ASSERT_EQUAL_STRING(  // unassigned, clock not synced, no battery sense
      R"({"event_id":"fb-a0b1c2d3e4f5-00000001-1","device_id":"fb-a0b1c2d3e4f5","seq":1,)"
      R"("occurred_at":null,"uptime_ms":5,"table_id":null,"goal":null,"battery_mv":null,)"
      R"("firmware_version":"0.1.0"})",
      api::goalEventJson("fb-a0b1c2d3e4f5", "0.1.0", api::Config{}, 1, unsynced, -1).c_str());
  Event undo{124, 83742, 1792006926020LL, 124};  // the button: undoes goal 123 (undoes = seq + 1)
  c.goal = "home";
  TEST_ASSERT_EQUAL_STRING(
      R"({"event_id":"fb-a0b1c2d3e4f5-9c41e07a-124","device_id":"fb-a0b1c2d3e4f5","seq":124,)"
      R"("occurred_at":"2026-10-14T19:42:06.020Z","uptime_ms":83742,"table_id":"t1","goal":"home",)"
      R"("undoes_event_id":"fb-a0b1c2d3e4f5-9c41e07a-123","battery_mv":3870,"firmware_version":"0.1.0"})",
      api::goalEventJson("fb-a0b1c2d3e4f5", "0.1.0", c, 0x9c41e07a, undo, 3870).c_str());
  TEST_ASSERT_EQUAL_STRING("too_late", api::refusalCode(R"({"code":"too_late"})").c_str());
  TEST_ASSERT_EQUAL_STRING("", api::refusalCode("").c_str());
}

void test_status_json_and_ids() {

  const uint8_t mac[6] = {0xa0, 0xb1, 0xc2, 0xd3, 0xe4, 0xf5};
  TEST_ASSERT_EQUAL_STRING("fb-a0b1c2d3e4f5", api::deviceId(mac).c_str());
  TEST_ASSERT_EQUAL_STRING("/devices/fb-x/config", api::configPath("fb-x").c_str());
}

void test_classify_responses() {
  using api::Outcome;
  for (int c : {200, 201, 204, 409}) TEST_ASSERT_TRUE(api::classify(c) == Outcome::Done);
  for (int c : {400, 404, 410, 422}) TEST_ASSERT_TRUE(api::classify(c) == Outcome::Drop);
  for (int c : {-1, 0, 401, 403, 408, 429, 500, 503, 302}) TEST_ASSERT_TRUE(api::classify(c) == Outcome::Retry);
}

// ---- beam health (beam_health.h). Node mV for a light current: V = 3300 - I x R.
static beam::Reading lightUa(float amb_ua, float lit1_ua, float r_amb = 220000) {
  return {(int)lroundf(3300 - amb_ua * r_amb / 1000), (int)lroundf(3300 - (lit1_ua + amb_ua) * 20000 / 1000),
          (int)lroundf(3300 - amb_ua * 20000 / 1000)};
}

// The logic tests below run on review 1's parts (R_PU_B 22 k, boost 3.1 mA: config beam_r_pu_b_ohm /
// beam_led_ma), whose numbers they spell out; test_beam_review2_parts checks the new defaults.
static beam::Cfg oldParts() {
  beam::Cfg c;
  c.r_pu_b = 22000, c.led_ma[1] = 3.1f;
  return c;
}

void test_beam_review2_parts() {
  beam::Cfg c;  // R_PU_B 68 k (b = 52 k), R_LED_B 270 Ω (+5.3 mA)
  TEST_ASSERT_FLOAT_WITHIN(100, 51944, beam::pullup(c, beam::Mode::B));
  TEST_ASSERT_FLOAT_WITHIN(0.05, 4.24, beam::tolUa(c, beam::Mode::B) / beam::tolUa(c, beam::Mode::A));  // 4.2x the ambient
  TEST_ASSERT_TRUE(c.mode == beam::Mode::A);  // lead: a by default, a_boost / b only per table from config
  // Auto, a dirty receiver in daylight: b's trial fails, and a alone is short too, so it lands in a_boost
  beam::Persist p{};
  beam::Monitor m(p);
  c.mode = beam::Mode::Auto, c.baseline_min = 0;
  float rb = beam::pullup(c, beam::Mode::B);
  auto light = [&](float amb, float lit1, float r_amb) {
    return beam::Reading{(int)lroundf(3300 - amb * r_amb / 1000), (int)lroundf(3300 - (lit1 + amb) * rb / 1000),
                         (int)lroundf(3300 - amb * rb / 1000)};
  };
  m.check(light(0.5f, 8, 220000), c, 1000);
  TEST_ASSERT_TRUE(m.check(light(2, 8, 220000), c, 1400) && m.active() == beam::Mode::B);  // bright: try b
  TEST_ASSERT_TRUE(m.check(light(2, 8, rb), c, 1460));  // b: 8 x 6.3 / 47.6 = 1.06x < 2
  TEST_ASSERT_TRUE(m.active() == beam::Mode::ABoost);   // a: 8 / 11.25 = 0.7x: a_boost, not a
  TEST_ASSERT_EQUAL_STRING("b: margin too low", m.why);
}

void test_beam_readings_margin_and_states() {
  beam::Persist p{};
  beam::Monitor m(p);
  beam::Cfg c = oldParts();
  c.baseline_min = 0;  // baseline = the latest reading
  TEST_ASSERT_FALSE(m.check(lightUa(1, 60), c, 100));
  TEST_ASSERT_FLOAT_WITHIN(0.05, 1, m.amb_ua);
  TEST_ASSERT_FLOAT_WITHIN(0.1, 60, m.lit1_ua);
  TEST_ASSERT_FLOAT_WITHIN(0.05, 60 / 11.25, m.margin);  // A needs (3.3 - 0.825 V) / 220 k = 11.25 µA
  TEST_ASSERT_TRUE(m.health(false, c, 100) == beam::Health::Ok);
  TEST_ASSERT_TRUE(m.health(true, c, 100) == beam::Health::Blocked);
  m.check(lightUa(1, 15), c, 160);  // dirt: 1.3x
  TEST_ASSERT_TRUE(m.health(false, c, 160) == beam::Health::LowMargin);
  m.check(lightUa(3, 60), c, 220);  // daylight: 3 µA > 60 % of A's 3.75
  TEST_ASSERT_TRUE(m.health(false, c, 220) == beam::Health::AmbientHigh);
  m.check(lightUa(0.2f, 60), c, 280);
  m.ball(3300 - 3 * 220, c);  // a ball, but 3 µA still reaches the receiver around it
  TEST_ASSERT_TRUE(m.health(false, c, 280) == beam::Health::AmbientHigh);
  m.newWindow();
  TEST_ASSERT_TRUE(m.health(false, c, 280) == beam::Health::Ok);
  for (int i = 0; i < 3; i++) m.check(lightUa(0.2f, 0.5f), c, 300 + i);  // the LED moves nothing
  TEST_ASSERT_TRUE(m.health(true, c, 303) == beam::Health::SensorDead);  // worse than blocked
  // twin: a C-E short in mode a. The node sits at 0 V in every reading: 15 µA "ambient" at 220 k, but
  // LED on vs off at 20 k doesn't differ, so it is the sensor, not light in the drawer.
  beam::Persist sp{};
  beam::Monitor shorted(sp);
  shorted.check({0, 0, 0}, c, 400);
  TEST_ASSERT_TRUE(shorted.amb_ua > 14);
  TEST_ASSERT_TRUE(shorted.health(false, c, 400) != beam::Health::AmbientHigh);  // not "shade the drawer"
  shorted.check({0, 0, 0}, c, 460);
  shorted.check({0, 0, 0}, c, 520);
  TEST_ASSERT_TRUE(shorted.health(false, c, 520) == beam::Health::SensorDead);
  shorted.check(lightUa(3, 60), c, 580);  // fixed, and real daylight: that is ambient_high
  TEST_ASSERT_TRUE(shorted.health(false, c, 580) == beam::Health::AmbientHigh);
  beam::Persist q{};
  beam::Monitor drift(q);
  beam::Cfg slow = oldParts();  // 2 h baseline: a sudden 40 % drop stands out although the margin is still 3x
  drift.check(lightUa(0.2f, 60), slow, 0);
  drift.check(lightUa(0.2f, 36), slow, 60);
  TEST_ASSERT_TRUE(drift.health(false, slow, 60) == beam::Health::LowMargin);
  TEST_ASSERT_TRUE(q.base_lit1_ua > 59);  // one reading barely moves it
}

void test_beam_auto_modes() {
  beam::Persist p{};
  beam::Monitor m(p);
  beam::Cfg c = oldParts();
  c.mode = beam::Mode::Auto, c.baseline_min = 0, c.dwell_s = 300;
  m.check(lightUa(0.5f, 70), c, 1000);
  TEST_ASSERT_TRUE(m.active() == beam::Mode::A);
  TEST_ASSERT_TRUE(m.check(lightUa(2, 70), c, 1060));  // bright (A since power-on: dwell over) -> B, on trial
  TEST_ASSERT_TRUE(m.active() == beam::Mode::B);
  TEST_ASSERT_TRUE(m.health(false, c, 1060) == beam::Health::Ok);  // A's ambient doesn't count in auto
  // B: 20 k, LED 4.1 mA. Needs 123.75 µA; 70 µA at 1 mA -> 287 µA: 2.3x, passes the trial
  TEST_ASSERT_FALSE(m.check(lightUa(2, 70, 20000), c, 1120));
  TEST_ASSERT_TRUE(m.active() == beam::Mode::B);
  TEST_ASSERT_FALSE(m.check(lightUa(0.5f, 70, 20000), c, 1200));  // dark again, but within the dwell
  TEST_ASSERT_TRUE(m.check(lightUa(0.5f, 70, 20000), c, 1400));   // dwell over: back to A
  TEST_ASSERT_TRUE(m.active() == beam::Mode::A);
  TEST_ASSERT_TRUE(m.check(lightUa(2, 50), c, 1800));  // bright again -> B
  TEST_ASSERT_TRUE(m.check(lightUa(2, 50, 20000), c, 1860));  // 50 x 4.1 / 123.75 = 1.66x: B fails
  TEST_ASSERT_TRUE(m.active() == beam::Mode::A);
  TEST_ASSERT_EQUAL_STRING("b: margin too low", m.why);
  TEST_ASSERT_TRUE(m.health(false, c, 1900) == beam::Health::AmbientHigh);  // reported while held in A
  TEST_ASSERT_FALSE(m.check(lightUa(2, 50), c, 2100));                     // held: no retry yet
  TEST_ASSERT_TRUE(m.check(lightUa(0.5f, 15), c, 2200));                   // dark, weak: A+ (1.3x in A)
  TEST_ASSERT_TRUE(m.active() == beam::Mode::ABoost);
  TEST_ASSERT_TRUE(m.check(lightUa(0.5f, 60), c, 2600));  // A alone 5.3x >= 2 x 2: back to A
  TEST_ASSERT_TRUE(m.check(lightUa(2, 70), c, 3000) && m.active() == beam::Mode::B);
  TEST_ASSERT_TRUE(m.blockedInB(c, 3010) && m.active() == beam::Mode::A);  // stuck in B: optics, not a ball
  c.mode = beam::Mode::B;  // manual wins at once
  TEST_ASSERT_TRUE(m.setManual(c, 3020) && m.active() == beam::Mode::B);
  TEST_ASSERT_FALSE(m.blockedInB(c, 3030));
}

void test_battery_cutoff_hysteresis() {
  TEST_ASSERT_FALSE(batteryCutoff(3100, false, 3000, 3600));
  TEST_ASSERT_TRUE(batteryCutoff(2999, false, 3000, 3600));
  TEST_ASSERT_TRUE(batteryCutoff(3300, true, 3000, 3600));  // rested bounce-back: stay off
  TEST_ASSERT_FALSE(batteryCutoff(3600, true, 3000, 3600));  // fresh cells
  TEST_ASSERT_FALSE(batteryCutoff(-1, true, 3000, 3600));    // no ADC: never cut off
}

// lead: up to 3 balls wait in the drawer. A ball resting in the beam counts once, is "stuck" after
// 10 s, and the next goal after it clears counts normally. Two touching balls are one block: one
// count (at beam height the gap between them is ~0.1 mm, the aperture 3 mm).
void test_detector_queue_cases() {
  Detector d;
  d.update(true, 0);
  TEST_ASSERT_TRUE(d.update(true, 5));
  TEST_ASSERT_TRUE(d.stuck(10000));
  d.update(false, 30000);            // nudged out
  d.update(true, 35000);             // the next goal, seconds later
  TEST_ASSERT_TRUE(d.update(true, 35005));
  d.update(false, 35100);
  d.update(true, 40000);             // two balls touching: one long block
  TEST_ASSERT_TRUE(d.update(true, 40005));
  TEST_ASSERT_FALSE(d.update(true, 40150));
  d.update(false, 40200);
  d.update(true, 40900);             // a ball entering < lockout_ms after a clear reads as a roll-back
  TEST_ASSERT_FALSE(d.update(true, 41000));
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_detector_counts_while_still_blocked);
  RUN_TEST(test_detector_queue_cases);
  RUN_TEST(test_detector_counts_block_seen_only_by_edges);
  RUN_TEST(test_detector_ignores_short_glitch);
  RUN_TEST(test_detector_stuck_ball);
  RUN_TEST(test_detector_lockout_from_clear);
  RUN_TEST(test_detector_ball_present_at_wake);
  RUN_TEST(test_detector_chattering_edges_count_once);
  RUN_TEST(test_detector_wraps_millis);
  RUN_TEST(test_queue_fifo_and_persists);
  RUN_TEST(test_queue_full_drops_oldest);
  RUN_TEST(test_queue_skips_corrupt_slot);
  RUN_TEST(test_queue_power_loss_at_every_write);
  RUN_TEST(test_parse_config_partial_and_ranges);
  RUN_TEST(test_goal_event_json);
  RUN_TEST(test_status_json_and_ids);
  RUN_TEST(test_classify_responses);
  RUN_TEST(test_battery_cutoff_hysteresis);
  RUN_TEST(test_beam_review2_parts);
  RUN_TEST(test_beam_readings_margin_and_states);
  RUN_TEST(test_beam_auto_modes);
  return UNITY_END();
}
