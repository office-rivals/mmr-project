// The scenario catalogue. Each one drives its own table and asserts what went over the wire. The score
// is what the server accepted (Table::left/right); a ball into the home goal scores for the right.
//
// Server expectations (any backend must meet them): a goal is accepted within 10 s; event_id is deduped;
// undos as in openapi.yaml.
#include <ArduinoJson.h>

#include <algorithm>
#include <map>
#include <set>

#include "scenario.h"

namespace sim {

// ---- helpers

static std::vector<const Sent*> sent(const Link& l, const char* method, const char* path_part) {
  std::vector<const Sent*> v;
  for (auto& s : l.sent)
    if (s.method == method && s.path.find(path_part) != std::string::npos) v.push_back(&s);
  return v;
}
static bool has(const std::string& body, const char* json_fragment) {
  return body.find(json_fragment) != std::string::npos;  // firmware JSON is compact (ArduinoJson)
}
static std::string field(const std::string& body, const char* key) {  // "key":"value" or "key":value
  std::string k = std::string("\"") + key + "\":";
  size_t p = body.find(k);
  if (p == std::string::npos) return "";
  p += k.size();
  size_t e = body[p] == '"' ? body.find('"', p + 1) + 1 : body.find_first_of(",}", p);
  return body.substr(p, e - p);
}
static std::vector<const Sent*> statuses(const Link& l, const char* reason) {
  std::vector<const Sent*> v;
  for (auto* s : sent(l, "POST", "/status"))
    if (!reason || field(s->body, "reason") == std::string("\"") + reason + "\"") v.push_back(s);
  return v;
}

static bool expectScore(Ctx& c, Table& t, int left, int right, int64_t within_ms = 10000) {
  return c.check(c.waitFor([&] { return t.left() == left && t.right() == right; }, within_ms),
                 "table %d: server accepted %d : %d, expected %d : %d", t.n, t.left(), t.right(), left, right);
}

// Wait until a device has reported and gone to deep sleep (idle_timeout_s of the server config).
static bool waitAsleep(Ctx& c, GoalDevice& d, int64_t max_ms = 15 * 60000) {
  return c.check(c.waitFor([&] { return d.asleep(); }, max_ms), "%s never went to sleep", d.id().c_str());
}

// ---- scenarios

// Same-instant goals at both ends, 8 rounds in a row (first one creates the match): every goal
// must count. A lost goal here is the worst bug the system can have.
static void simultaneousBurst(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  for (int i = 1; i <= 8; i++) {
    t.goalInto(*t.home);
    t.goalInto(*t.away);
    if (!expectScore(c, t, i, i)) return;
    c.runFor(2000 + c.w.env.rng() % 3000);
  }
  size_t posts = sent(t.home->link, "POST", "/goal-events").size() + sent(t.away->link, "POST", "/goal-events").size();
  c.check(posts == 16, "%zu goal POSTs for 16 goals (expected no retries)", posts);
}

// Several tables at once, interleaved random goals: every counter's goals are accepted once each. (Which
// table the server credits isn't visible on the device API: that needs a read of the backend's own state.)
static void severalTables(Ctx& c) {
  for (Table* t : c.t) t->powerOn();
  std::vector<std::pair<int, int>> want(c.t.size());
  for (int i = 0; i < 30; i++) {
    size_t k = c.w.env.rng() % c.t.size();
    bool home = c.w.env.rng() % 2;
    Table& t = *c.t[k];
    t.goalInto(home ? *t.home : *t.away);
    (home ? want[k].second : want[k].first)++;
    c.runFor(3000 + c.w.env.rng() % 12000);
  }
  for (size_t k = 0; k < c.t.size(); k++) expectScore(c, *c.t[k], want[k].first, want[k].second);
}

// Device clocks are never exact: one goal device 5 s behind, the other 5 s ahead, then one that
// never synced (occurred_at null). Every goal must count; the server must not drop a goal for its
// timestamp (it may use its own receive time instead).
static void clockSkew(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  t.home->clock_skew_ms = -5000;
  t.away->clock_skew_ms = +5000;
  t.goalInto(*t.home);  // same instant, first goals of a new match
  t.goalInto(*t.away);
  if (!expectScore(c, t, 1, 1)) return;
  int l = 1, r = 1;
  for (int i = 0; i < 4; i++) {
    c.runFor(3000);
    bool home = i % 2 == 0;
    t.goalInto(home ? *t.home : *t.away);
    (home ? r : l)++;
    if (!expectScore(c, t, l, r)) return;
  }
  t.home->ntp_ok = false;  // NTP never answered: occurred_at null
  c.runFor(3000);
  t.goalInto(*t.home);
  if (!expectScore(c, t, l, r + 1)) return;
  auto posts = sent(t.home->link, "POST", "/goal-events");
  c.check(!posts.empty() && has(posts.back()->body, "\"occurred_at\":null"), "unsynced goal sent with a timestamp");
}

// Cells pulled right after the goal POST left the device: the server has it, the device doesn't
// know. Next boot resends the same event_id; the score must not move twice.
static void powerPullMidPost(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  t.home->link.faults.push_back({Fault::Kind::PowerPull, 0, "/goal-events", 1});
  t.goalInto(*t.home);
  c.runFor(3000);
  c.check(!t.home->powered(), "home device should have lost power mid-POST");
  expectScore(c, t, 0, 1);
  c.runFor(5000);
  t.home->powerOn();
  c.runFor(10000);
  auto posts = sent(t.home->link, "POST", "/goal-events");
  if (c.check(posts.size() == 2, "expected the same goal twice on the wire, saw %zu POSTs", posts.size())) {
    c.check(field(posts[0]->body, "event_id") == field(posts[1]->body, "event_id"), "resend has a new event_id");
    c.check(posts[1]->code == 409 || (posts[1]->code >= 200 && posts[1]->code < 300), "resend answered %d",
            posts[1]->code);
  }
  c.runFor(5000);
  expectScore(c, t, 0, 1);  // server deduped

  // Pulls inside the NVS write sequence of a goal: earlier goals survive, seq is never reused,
  // at most the goal in progress is lost.
  int right = 1;
  for (int k = 0; k < 3; k++) {
    t.home->nvs().pullAfter(k);
    t.goalInto(*t.home);
    c.runFor(2000);
    c.check(!t.home->powered(), "pullAfter(%d) did not hit a write", k);
    t.home->powerOn();
    c.runFor(8000);
    t.goalInto(*t.home);  // a normal goal after the crash must count
    c.runFor(10000);
    int got = t.right() - right;
    c.check(got == 1 || got == 2, "after NVS pull %d: %d goals counted for 1-2 goals", k, got);
    right = t.right();
  }
  std::map<std::string, std::string> first;  // event_id -> occurred_at: a reused seq would differ
  for (auto* p : sent(t.home->link, "POST", "/goal-events")) {
    auto id = field(p->body, "event_id"), at = field(p->body, "uptime_ms");
    auto [it, fresh] = first.emplace(id, at);
    c.check(fresh || it->second == at, "event_id %s reused for a different goal", id.c_str());
  }
}

// Wi-Fi down: goals queue in NVS; when it comes back they all arrive, in order, once.
static void offlineQueueDrain(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  t.home->link.faults.push_back({Fault::Kind::Offline, 0, "", -1});
  for (int i = 0; i < 5; i++) {
    t.goalInto(*t.home);
    c.runFor(20000);
  }
  c.check(t.right() == 0, "goals arrived while offline (%d)", t.right());
  c.check(t.home->awake(), "home went to sleep during play");
  t.home->link.faults.clear();
  expectScore(c, t, 0, 5, 6 * 60000);  // within the 300 s max backoff
  std::set<std::string> ids;
  for (auto* p : sent(t.home->link, "POST", "/goal-events"))
    if (p->code > 0 && !p->injected) ids.insert(field(p->body, "event_id"));
  c.check(ids.size() == 5, "%zu distinct goals delivered, expected 5", ids.size());
}

// The ball is usually 31 mm, up to 36 mm. Each size at 0.5, 1, 2 and 3 m/s counts once, and a ball
// that rolls back out through the gate (a second, slow block inside the lockout) doesn't count twice.
static void ballSizes(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  int score[2] = {0, 0}, k = 0;
  for (double mm : {31.0, 36.0}) {
    for (double mps : {0.5, 1.0, 2.0, 3.0, 1.0}) {
      bool rebound = k % 5 == 4;  // the last one of each size rolls back out
      GoalDevice& g = k++ % 2 ? *t.away : *t.home;
      uint32_t ms = blockMs(mm, mps);
      t.goalInto(g, ms);
      if (rebound) c.w.clk.after(300 + ms + 400, [&g, mm] { g.ball(blockMs(mm, 0.5)); });
      score[&g == t.home.get()]++;  // into the home goal: a point for the right
      if (!expectScore(c, t, score[0], score[1]))
        return (void)c.note("wrong after a %.0f mm ball at %.1f m/s (beam blocked %u ms)%s", mm, mps, ms,
                            rebound ? ", rolling back" : "");
      c.runFor(3000);
    }
    c.note("%.0f mm: beam blocked %u-%u ms over 0.5-3 m/s; under min_block_ms 5 above ~%.0f m/s", mm, blockMs(mm, 3),
           blockMs(mm, 0.5), blockMs(mm, 1) / 5.0);
  }
  expectScore(c, t, score[0], score[1]);  // the rebounds never counted, even late
}

// USB plugged into a goal counter to flash it in place: VBUS wakes it, it never sleeps (no deep or
// light sleep) and keeps counting, even on flat cells. Unplugged, it sleeps as usual.
static void usbFlash(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  GoalDevice& g = *t.home;
  if (!waitAsleep(c, g)) return;
  g.battery_mv = MV_DEAD;  // below cutoff: on USB the pack doesn't matter
  g.usb(true);
  c.check(g.awake(), "plugging USB in didn't wake %s", g.id().c_str());
  c.runFor(30 * 60000);  // way past idle_timeout_s
  c.check(g.awake() && !g.light_sleep, "%s slept while on USB", g.id().c_str());
  t.goalInto(g);
  expectScore(c, t, 0, 1);
  auto posts = sent(g.link, "POST", "/goal-events");
  c.check(!posts.empty() && has(posts.back()->body, "\"battery_mv\":null"), "goal on USB sent a pack voltage (want battery_mv null)");
  g.battery_mv = MV_FRESH;
  g.usb(false);
  waitAsleep(c, g);
  c.check(g.light_sleep, "%s: light sleep still off after unplugging", g.id().c_str());
}

// A ball stops in the gate: one goal, and the sleep status says beam_blocked.
static void stuckBall(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  t.motion();
  c.runFor(300);
  t.home->setBall(true);
  expectScore(c, t, 0, 1);
  c.runFor(30000);
  c.check(t.right() == 1, "stuck ball counted %d times", t.right());
  if (!waitAsleep(c, *t.home)) return;
  auto st = statuses(t.home->link, "sleep");
  c.check(!st.empty() && has(st.back()->body, "\"beam_blocked\":true"), "sleep status without beam_blocked:true");
  c.check(!st.empty() && field(st.back()->body, "stuck_events") == "1", "stuck_events != 1");
  t.home->setBall(false);
}

// Up to 3 balls wait in the drawer. Three goals 2 s apart into one goal: each ball crosses the beam
// and counts once. The third rolls into the queue and nudges a waiting ball back into the beam, where
// it stays: inside the lockout, so not a goal; after stuck_after_s it reports stuck (beam_blocked).
// A player clears the drawer, and the next goal counts as usual. Round 2: the other goal, a later nudge.
static void drawerQueue(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  int score[2] = {0, 0}, round = 0;
  for (auto [g, nudge_ms] : {std::pair{t.home.get(), 100}, std::pair{t.away.get(), 400}}) {
    round++;
    int side = g == t.home.get();  // into the home goal: a point for the right
    uint32_t block = blockMs(t.ball_mm, 1.0);
    for (int i = 0; i < 3; i++)
      c.w.clk.after(i * 2000, [&t, g, block] { t.goalInto(*g, block); });
    c.w.clk.after(2 * 2000 + 300 + block + nudge_ms, [g] { g->setBall(true); });  // nudged back into the beam: parked
    score[side] += 3;
    if (!expectScore(c, t, score[0], score[1], 15000)) return;
    c.runFor(30000);  // well past stuck_after_s
    c.check(t.left() == score[0] && t.right() == score[1], "round %d: the parked ball counted (%d : %d, want %d : %d)", round,
            t.left(), t.right(), score[0], score[1]);
    if (!waitAsleep(c, *g)) return;
    auto st = statuses(g->link, "sleep");
    c.check(!st.empty() && has(st.back()->body, "\"beam_blocked\":true"), "round %d: sleep status without beam_blocked:true",
            round);
    c.check(!st.empty() && field(st.back()->body, "stuck_events") == "1", "round %d: stuck_events %s, want 1 (this device's first)",
            round, st.empty() ? "-" : field(st.back()->body, "stuck_events").c_str());
    // Beam health: "blocked" went out at once (reason beam), not only with the sleep status.
    auto now = statuses(g->link, "beam");
    c.check(now.size() == 1 && field(now[0]->body, "health") == "\"blocked\"" && !st.empty() && now[0]->t < st.back()->t,
            "round %d: %zu beam statuses (want one, health blocked, before the sleep status)", round, now.size());
    c.check(!st.empty() && field(st.back()->body, "health") == "\"blocked\"", "round %d: sleep status health %s (want blocked)",
            round, st.empty() ? "-" : field(st.back()->body, "health").c_str());
    g->setBall(false);  // a player empties the drawer
    c.runFor(5000);
    t.goalInto(*g);
    score[side]++;
    if (!expectScore(c, t, score[0], score[1])) return;
    if (!waitAsleep(c, *g)) return;
    st = statuses(g->link, "sleep");
    c.check(field(st.back()->body, "health") == "\"ok\"" && has(st.back()->body, "\"beam_blocked\":false"),
            "round %d: emptied drawer, sleep status health %s (want ok)", round, field(st.back()->body, "health").c_str());
  }
}

// Light levels relative to firmware's fitted parts (beam::Cfg), so a part change can't strand a scenario.
static const beam::Cfg PARTS;
static double tol(beam::Mode m) { return beam::tolUa(PARTS, m); }  // most drawer light a ball still reads blocked in
// The LED light (µA per mA, lit_ua) that gives mode b `margin` x what a clean LOW needs.
static double litForB(double margin) {
  return margin * beam::needUa(PARTS, beam::Mode::B) / (PARTS.led_ma[0] + PARTS.led_ma[1]);
}
// What the lit1 check reads for a clean receiver: 73 µA, capped where its node (both pull-ups) hits 0 V.
static const double LIT1_CLEAN = std::min(73.0, beam::VDD_MV / (double)beam::pullup(PARTS, beam::Mode::B) * 1000);

// Light in the drawer over the day (electronics/beam-health-2026-10-16.md, firmware's §3-§6). Home runs
// beam mode a (the default), away runs auto. Each session is a bump on the table and 30 min (about 5
// of them awake, a health check a minute), so the baselines follow the day. The receiver model is
// GoalDevice's: mode a stops seeing a ball above ~3.75 µA of drawer light, mode b above ~16 µA (tol()).
static void drawerLight(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  GoalDevice &a = *t.home, &au = *t.away;
  auto light = [&](double ua) { a.setAmbient(ua), au.setAmbient(ua); };
  auto session = [&] { t.motion(), c.runFor(30 * 60000); };
  auto last = [&](GoalDevice& g, const char* key) {  // from the last sleep status
    auto st = statuses(g.link, "sleep");
    return st.empty() ? std::string("-") : field(st.back()->body, key);
  };
  auto mode = [&](GoalDevice& g) { return g.modes.empty() ? beam::Mode::A : g.modes.back(); };
  auto why = [&](GoalDevice& g) { return g.mode_log.empty() ? std::string("-") : g.mode_log.back(); };
  int l = 0, r = 0;
  auto goals = [&](bool home_counts) {  // one goal into each goal in a session
    t.motion();
    c.runFor(2000);
    t.goalInto(a), r += home_counts;
    c.runFor(3000);
    t.goalInto(au), l++;
    expectScore(c, t, l, r);
    c.runFor(30 * 60000);
  };

  // Morning: dark drawer, both ok in mode a.
  light(0.2);
  session(), session();
  c.check(last(a, "health") == "\"ok\"" && last(au, "health") == "\"ok\"" && last(au, "mode") == "\"a\"",
          "dark morning: health %s / %s, auto in %s (want ok, ok, a)", last(a, "health").c_str(), last(au, "health").c_str(),
          last(au, "mode").c_str());

  // Midday light, 80 % of a's tolerance (3 µA): over beam_ambient_max_pct 60. Mode a reports ambient_high at
  // once; auto moves to b once the baseline passes beam_ambient_switch_ua, and b is fine with it.
  double midday = 0.8 * tol(beam::Mode::A);
  light(midday);
  for (int i = 0; i < 16 && mode(au) != beam::Mode::B; i++) session();
  auto sa = statuses(a.link, "beam");
  c.check(!sa.empty() && field(sa[0]->body, "health") == "\"ambient_high\"" && field(sa[0]->body, "mode") == "\"a\"",
          "mode a in %.1f µA: first beam status health %s (want ambient_high in a)", midday, sa.empty() ? "none" : field(sa[0]->body, "health").c_str());
  for (size_t i = 1; i < sa.size(); i++)  // a lasting state is repeated, but only after beam_report_s (600 s)
    c.check(sa[i]->t - sa[i - 1]->t >= 600000 && field(sa[i]->body, "health") == "\"ambient_high\"",
            "beam status %zu: %s %.0f s after the last (want the same state, >= 600 s apart)", i,
            field(sa[i]->body, "health").c_str(), (sa[i]->t - sa[i - 1]->t) / 1000.0);
  if (!c.check(mode(au) == beam::Mode::B && why(au) == "b (ambient)", "auto never moved to b in %.1f µA (last: %s, baseline %s)",
               midday, why(au).c_str(), last(au, "baseline_amb_ua").c_str()))
    return;
  goals(true);  // both still see the ball
  c.check(last(au, "health") == "\"ok\"" && last(au, "mode") == "\"b\"" && statuses(au.link, "beam").empty(),
          "auto in b at midday: health %s, mode %s, %zu beam statuses (want ok, b, none)", last(au, "health").c_str(),
          last(au, "mode").c_str(), statuses(au.link, "beam").size());

  // Sun on the drawer, 80 % of b's tolerance (~13 µA): too much for mode a's D8, so its first check turns plan C's
  // chopped reads on and it still counts; b counts but is near its limit: ambient_high in b.
  double sun = 0.8 * tol(beam::Mode::B);
  light(sun);
  goals(true);
  c.check(a.chopping, "mode a in %.1f µA: chopped reads not on", sun);
  auto sb_ = statuses(au.link, "beam");
  c.check(sb_.size() == 1 && field(sb_[0]->body, "health") == "\"ambient_high\"" && field(sb_[0]->body, "mode") == "\"b\"",
          "b in %.1f µA: %zu beam statuses, health %s (want one, ambient_high in b)", sun, sb_.size(),
          sb_.empty() ? "-" : field(sb_[0]->body, "health").c_str());

  // Evening: dark again, auto goes back to a below beam_ambient_return_ua; both ok.
  light(0.2);
  for (int i = 0; i < 24 && mode(au) != beam::Mode::A; i++) session();
  c.check(mode(au) == beam::Mode::A && why(au) == "a (dark again)", "auto didn't go back to a in the dark (last: %s)",
          why(au).c_str());
  session();
  c.check(last(a, "health") == "\"ok\"" && last(au, "health") == "\"ok\"", "dark evening: health %s / %s (want ok)",
          last(a, "health").c_str(), last(au, "health").c_str());

  // Next day, a dirty receiver (lit for a b margin of 1.8x, ~14 µA per mA instead of 73) in the midday light.
  // The dirt shows first as low_margin (clean it); a's own margin is lower still, so auto may step to a_boost
  // first. Then b's margin is too thin for these optics: auto tries b, its first check fails, it falls back
  // (to a_boost while a's margin is under beam_margin_min, else a), holds there, and reports ambient_high
  // (the fix is cleaning or shading, not mode b).
  au.lit_ua = litForB(0.9 * PARTS.margin_min);
  light(midday);
  bool boost = au.lit_ua / beam::needUa(PARTS, beam::Mode::A) < PARTS.margin_min;  // a's margin at 1 mA
  beam::Mode back = boost ? beam::Mode::ABoost : beam::Mode::A;
  std::string back_s = boost ? "a_boost" : "a";
  size_t before = statuses(au.link, "beam").size();
  bool failed = false;
  for (int i = 0; i < 16 && !failed; i++) {
    t.motion();
    failed = c.waitFor([&] { return why(au) == back_s + " (b: margin too low)"; }, 30 * 60000);
  }
  if (!c.check(failed, "auto never fell back from b to %s with a dirty receiver (last: %s)", back_s.c_str(), why(au).c_str())) return;
  auto sc = statuses(au.link, "beam");
  c.check(sc.size() > before && field(sc[before]->body, "health") == "\"low_margin\"",
          "dirty receiver: first beam status health %s (want low_margin)", sc.size() > before ? field(sc[before]->body, "health").c_str() : "none");
  size_t n = au.modes.size();
  c.check(n >= 2 && au.modes[n - 2] == beam::Mode::B && au.modes[n - 1] == back, "b failed: last switch %s (want b, then %s)",
          why(au).c_str(), back_s.c_str());
  c.runFor(4 * 60000);  // within beam_mode_min_dwell_s: it holds
  c.check(mode(au) == back, "auto left %s within the hold (last: %s)", back_s.c_str(), why(au).c_str());
  if (!waitAsleep(c, au)) return;
  c.check(last(au, "health") == "\"ambient_high\"" && last(au, "mode") == "\"" + back_s + "\"",
          "b failed: sleep status health %s mode %s (want ambient_high in %s)", last(au, "health").c_str(), last(au, "mode").c_str(),
          back_s.c_str());
}

// The foosball.beam.health gauge (0 ok .. 4 sensor_dead) in the device's last OTLP metrics; -1 = none sent.
static int otlpHealth(GoalDevice& g) {
  auto m = sent(g.link, "POST", "/v1/metrics");
  if (m.empty()) return -1;
  const std::string& b = m.back()->body;
  size_t p = b.find("\"foosball.beam.health\"");
  if (p == std::string::npos || (p = b.find("\"asInt\":\"", p)) == std::string::npos) return -1;
  return atoi(b.c_str() + p + 9);
}

// Beam faults a person has to fix (firmware/beam-health-firmware-2026-10-16.md §4). Home runs mode a,
// away mode b. Each step plays a session with a goal into each goal; the score is checked after every
// goal, so a lost or double-counted goal fails. Health is read from the statuses and the OTLP gauge.
static void beamFaults(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  GoalDevice &a = *t.home, &b = *t.away;
  int l = 0, r = 0;
  auto session = [&](bool home_sees, bool away_sees) {
    t.motion();
    c.runFor(2000);
    t.goalInto(a), r += home_sees;
    c.runFor(3000);
    t.goalInto(b), l += away_sees;
    expectScore(c, t, l, r);
    c.runFor(4 * 60000);  // a few health checks
    waitAsleep(c, a), waitAsleep(c, b);
  };
  auto health = [&](GoalDevice& g) {
    auto st = statuses(g.link, "sleep");
    return st.empty() ? std::string("-") : field(st.back()->body, "health");
  };
  auto expect = [&](GoalDevice& g, const char* want, int gauge, const char* what) {
    std::string h = health(g);
    int o = otlpHealth(g);
    c.check(h == std::string("\"") + want + "\"", "%s: %s sleep status health %s (want %s)", what, g.id().c_str(), h.c_str(), want);
    c.check(o == gauge || (o < 0 && sent(g.link, "POST", "/v1/metrics").empty()), "%s: %s OTLP beam.health %d (want %d)", what,
            g.id().c_str(), o, gauge);
    c.check(g.sleepBlinks() == (gauge ? 2 : 1), "%s: %s blinks %d asleep (want %d: %s)", what, g.id().c_str(), g.sleepBlinks(),
            gauge ? 2 : 1, gauge ? "red, a fault" : "green, OK");
  };
  auto beamStatus = [&](GoalDevice& g, size_t from, const char* want) {  // a status at once, not only at sleep
    auto st = statuses(g.link, "beam");
    for (size_t i = from; i < st.size(); i++)
      if (field(st[i]->body, "health") == std::string("\"") + want + "\"") return true;
    return false;
  };

  session(true, true);
  expect(a, "ok", 0, "clean");
  expect(b, "ok", 0, "clean");

  // Dirty aperture on home: the lit reading falls 40 % below its baseline (beam_drift_pct 30). A weak
  // LED on away: b's margin 1.8x, under beam_margin_min 2. Both still count every goal.
  size_t fa = statuses(a.link, "beam").size(), fb = statuses(b.link, "beam").size();
  a.lit_ua = 0.6 * LIT1_CLEAN, b.lit_ua = litForB(0.9 * PARTS.margin_min);
  session(true, true);
  expect(a, "low_margin", 1, "dirty aperture");
  expect(b, "low_margin", 1, "weak LED");
  c.check(beamStatus(a, fa, "low_margin") && beamStatus(b, fb, "low_margin"), "low_margin: no status with reason beam");

  // Cleaned / LED fixed: ok again.
  a.lit_ua = 73, b.lit_ua = 73;
  session(true, true);
  expect(a, "ok", 0, "cleaned");
  expect(b, "ok", 0, "LED fixed");

  // Receiver shorted: the node sits at 0 V, the beam never reads blocked. Goals are lost (nothing can
  // see them) but none is made up, and after beam_dead_checks checks it's sensor_dead.
  fa = statuses(a.link, "beam").size(), fb = statuses(b.link, "beam").size();
  a.shortReceiver(true), b.shortReceiver(true);
  session(false, false);
  // The LED doesn't move the node (LED off vs on, both pull-ups): dead, in either mode, and said at once.
  expect(a, "sensor_dead", 4, "shorted receiver (a)");
  expect(b, "sensor_dead", 4, "shorted receiver (b)");
  c.check(beamStatus(a, fa, "sensor_dead") && beamStatus(b, fb, "sensor_dead"), "shorted receiver: no sensor_dead status with reason beam");
  a.shortReceiver(false), b.shortReceiver(false);
  session(true, true);
}

// The goal counter's undo button (ux/goal-counter-phase1-2026-10-17.md Part B): hold 1 s = undo this
// counter's newest goal still inside undo_window_s (10 s, the server's clock); late or not its own =
// the "no" knock. The score is checked after every step: no goal lost, no undo applied twice.
static void goalUndo(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  GoalDevice &h = *t.home, &a = *t.away;
  int l = 0, r = 0;
  size_t mark = 0;
  auto since = [&](GoalDevice& g) {  // the sounds since mark, space-separated
    std::string out;
    for (size_t i = mark; i < g.sounds.size(); i++) out += (out.empty() ? "" : " ") + g.sounds[i];
    return out;
  };
  auto undos = [&](GoalDevice& g) { return sent(g.link, "POST", "/undo-events"); };
  auto press = [&](GoalDevice& g, uint32_t ms = 1200) {
    g.holdButton(ms);
    c.runFor(ms + 500);
  };

  // A false count (a ball bounced back in): undone 3 s later. Goal chirp, press tick, undo sound.
  t.motion(), c.runFor(2000);
  mark = h.sounds.size();
  t.goalInto(h), r++;
  if (!expectScore(c, t, l, r)) return;
  press(h);
  r--;
  expectScore(c, t, l, r);
  c.check(since(h) == "goal scan undo", "false count: sounds '%s' (want 'goal scan undo')", since(h).c_str());
  c.check(undos(h).size() == 1 && undos(h)[0]->code == 201, "false count: undo answered %d (want 201)",
          undos(h).empty() ? 0 : undos(h)[0]->code);

  // A short press (0.5 s) only ticks.
  mark = h.sounds.size();
  press(h, 500);
  c.check(since(h) == "scan" && undos(h).size() == 1, "short press: sounds '%s', %zu undos (want 'scan', nothing sent)",
          since(h).c_str(), undos(h).size());

  // A double count: two presses undo both (newest first), each once.
  t.goalInto(h), r++;
  c.runFor(2000);
  t.goalInto(h), r++;
  if (!expectScore(c, t, l, r)) return;
  mark = h.sounds.size();
  press(h), press(h);
  r -= 2;
  expectScore(c, t, l, r);
  c.check(since(h) == "scan undo scan undo" && undos(h).size() == 3, "double count: sounds '%s', %zu undos (want two more)",
          since(h).c_str(), undos(h).size());

  // Too late on the device: 11 s after the goal it says "no" at once and sends nothing.
  t.goalInto(h), r++;
  if (!expectScore(c, t, l, r)) return;
  c.runFor(11000);
  mark = h.sounds.size();
  press(h);
  expectScore(c, t, l, r);
  c.check(since(h) == "scan not joined" && undos(h).size() == 3, "late press: sounds '%s', %zu undos (want 'scan not joined', none)",
          since(h).c_str(), undos(h).size());

  // Lost answer: the undo reaches the server, the counter loses power before the 201 and resends it
  // after the reboot: 409 (done), no "no", undone once.
  t.goalInto(h), r++;
  if (!expectScore(c, t, l, r)) return;
  h.link.faults.push_back({Fault::Kind::PowerPull, 0, "/undo-events", 1});
  h.holdButton(1200);
  c.runFor(3000);
  c.check(!h.powered(), "the counter should have lost power mid-undo");
  h.setButton(false);
  h.powerOn();  // cells back in
  r--;
  if (!c.check(c.waitFor([&] { return !undos(h).empty() && undos(h).back()->code == 409; }, 60000),
               "lost 201: the resent undo answered %d (want 409)", undos(h).back()->code))
    return;
  expectScore(c, t, l, r);
  mark = h.sounds.size();
  c.runFor(3000);
  c.check(since(h).find("not joined") == std::string::npos, "lost 201: the resent undo played 'no' (%s)", since(h).c_str());

  // Too late at the server: the undo is queued in time but held up (offline) past the window. The
  // window runs on the server's clock, so this part runs in real time.
  t.goalInto(a), l++;
  if (!expectScore(c, t, l, r)) return;
  a.link.faults.push_back({Fault::Kind::Offline, 0, "/undo-events", -1});
  mark = a.sounds.size();
  press(a);
  c.w.run.speed = 1;
  c.runFor(10000);
  a.link.faults.clear();
  bool answered = c.waitFor([&] { return !undos(a).empty() && undos(a).back()->code == 422; }, 30000);
  c.w.run.speed = 0;
  c.runFor(1000);
  c.check(answered && since(a) == "scan undo not joined", "late at the server: answer %d, sounds '%s' (want 422, 'scan undo not joined')",
          undos(a).empty() ? 0 : undos(a).back()->code, since(a).c_str());
  expectScore(c, t, l, r);

  // Not its own: an undo from the away counter naming a home goal is refused (not_yours).
  t.goalInto(h), r++;
  if (!expectScore(c, t, l, r)) return;
  JsonDocument d;
  deserializeJson(d, sent(h.link, "POST", "/goal-events").back()->body);
  d["undoes_event_id"] = d["event_id"];
  d["event_id"] = api::eventId(a.id(), c.w.env.rng(), 1);
  d["device_id"] = a.id();
  d["goal"] = "away";
  std::string body, reply;
  serializeJson(d, body);
  int got = 0;
  a.link.send(Link::Lane::Rest, "POST", "/undo-events", body, 5000, [&](int code, const std::string& b) { got = code, reply = b; });
  c.waitFor([&] { return got != 0; }, 6000);
  c.check(got == 422 && has(reply, "\"not_yours\""), "cross-counter undo answered %d %s (want 422 not_yours)", got, reply.c_str());
  expectScore(c, t, l, r);

  // A press while asleep can't be inside the window. A short one only wakes the screen (ux B5), silent;
  // held to 1 s from the wake it is an undo as when awake, so "no" once.
  if (!waitAsleep(c, h)) return;
  size_t n = undos(h).size();
  int shows = h.screen_shows;
  mark = h.sounds.size();
  press(h, 300);
  c.check(since(h).empty() && h.screen && h.screen_shows == shows + 1,
          "short press from sleep: sounds '%s', screen %s (want silent, screen on)", since(h).c_str(), h.screen ? "on" : "off");
  if (!waitAsleep(c, h)) return;
  c.check(!h.screen, "screen still on after the key wake ended");
  mark = h.sounds.size();
  press(h);
  c.runFor(2000);
  c.check(since(h) == "not joined" && undos(h).size() == n, "held press from sleep: sounds '%s', %zu new undos (want 'not joined', none)",
          since(h).c_str(), undos(h).size() - n);

  // A stuck button: one answer, then silence; it sleeps anyway and stays asleep (a held pin is no wake).
  mark = h.sounds.size();
  h.setButton(true);
  c.runFor(15000);
  std::string stuck = since(h);
  if (waitAsleep(c, h)) {
    c.runFor(5 * 60000);
    c.check(h.asleep(), "a stuck button woke the counter again");
  }
  c.check(stuck == "scan not joined" && since(h) == stuck, "stuck button: sounds '%s' (want 'scan not joined', then nothing)",
          since(h).c_str());
  h.setButton(false);
  t.goalInto(h), r++;  // a bump wakes it, the button works again
  if (!expectScore(c, t, l, r)) return;
  press(h);
  r--;
  expectScore(c, t, l, r);
}

// Low cells: warn in status; below cutoff exactly one status, then silence until fresh cells.
static void lowBattery(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  t.home->battery_mv = MV_LOW;
  if (!waitAsleep(c, *t.home)) return;
  auto st = statuses(t.home->link, "sleep");
  c.check(!st.empty() && has(st.back()->body, "\"low_batt\":true"), "sleep status at %d mV without low_batt", MV_LOW);
  // Below warn one request at a time: a goal detected while the first one's POST is out (a Wi-Fi connect
  // that fails after ~3 s) waits in RAM, and both count once.
  t.home->link.faults.push_back({Fault::Kind::Offline, 0, "/goal-events", 1});
  t.goalInto(*t.home);
  c.runFor(2000);
  t.goalInto(*t.home);
  expectScore(c, t, 0, 2, 6 * 60000);
  if (!waitAsleep(c, *t.home)) return;
  c.check(t.home->led_blinks[(int)app::Led::Red] && t.home->sleepBlinks() == 3, "battery low: %d red blinks awake, %d asleep (want 3)",
          t.home->led_blinks[(int)app::Led::Red], t.home->sleepBlinks());
  // cells sag below cutoff: power cycle (a swap to bad cells)
  t.home->pull();
  t.home->battery_mv = MV_DEAD;
  t.home->powerOn();
  c.runFor(30000);
  c.check(statuses(t.home->link, "cutoff").size() == 1, "expected one cutoff status");
  c.check(t.home->asleep(), "device stays up below cutoff");
  int blinks = t.home->led_blinks[1] + t.home->led_blinks[2];
  size_t before = t.home->link.sent.size();
  for (int i = 0; i < 3; i++) {
    t.motion();
    c.runFor(60000);
  }
  c.check(t.home->link.sent.size() == before, "device used the radio again below cutoff");
  c.check(t.home->led_blinks[1] + t.home->led_blinks[2] == blinks, "the status LED blinked below cutoff");
  // fresh cells (no power cycle needed: resume above resume_mv on the next wake)
  t.home->battery_mv = MV_FRESH;
  t.goalInto(*t.home);
  expectScore(c, t, 0, 3, 20000);
}

// Heartbeats keep coming with nobody playing; a device whose cells die goes silent (the backend
// should alert after 36 h without telemetry from it).
static void heartbeatAndSilence(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  c.runFor(15 * 60000);  // everyone idles to sleep
  t.away->pull();
  size_t away_before = t.away->link.sent.size();
  c.runFor(50 * 3600000LL);
  c.check(statuses(t.home->link, "heartbeat").size() >= 2, "home: %zu heartbeats in 50 h, expected >= 2",
          statuses(t.home->link, "heartbeat").size());
  c.check(t.away->link.sent.size() == away_before, "dead device sent something");
  c.note("%s silent for 50 h: the backend should have alerted (no telemetry > 36 h)", t.away->id().c_str());
}

// The server's config says "scoreboard" for a goal counter: it stays a goal counter and reports the mismatch.
static void roleMismatch(Ctx& c) {
  Table& t = *c.t[0];
  t.home->powerOn();
  c.runFor(3000);
  t.goalInto(*t.home);
  c.runFor(5000);
  auto posts = sent(t.home->link, "POST", "/goal-events");
  c.check(posts.size() == 1, "goal not sent (%zu POSTs)", posts.size());
  if (!waitAsleep(c, *t.home)) return;
  auto st = statuses(t.home->link, "sleep");
  c.check(!st.empty() && field(st.back()->body, "config_role") == "\"scoreboard\"" &&
              field(st.back()->body, "role") == "\"goal\"",
          "status doesn't report the config role mismatch");
}

// A device nobody assigned (config 404) keeps counting (table_id null).
static void unassigned(Ctx& c) {
  Table& t = *c.t[0];
  t.home->powerOn();
  c.runFor(6000);
  auto cfg = sent(t.home->link, "GET", "/config");
  c.check(!cfg.empty() && cfg[0]->code == 404, "config for an unassigned device answered %d", cfg.empty() ? 0 : cfg[0]->code);
  t.goalInto(*t.home);
  c.runFor(5000);
  auto posts = sent(t.home->link, "POST", "/goal-events");
  c.check(posts.size() == 1 && has(posts[0]->body, "\"table_id\":null"), "unassigned goal not sent with table_id null");
}

// 5xx / 429 / 401: retried with growing backoff, delivered once. 422: dropped and counted.
static void serverErrors(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  auto& f = t.home->link.faults;
  f.push_back({Fault::Kind::Code, 503, "/goal-events", 2});
  f.push_back({Fault::Kind::Code, 429, "/goal-events", 1});
  f.push_back({Fault::Kind::Code, 401, "/goal-events", 1});
  t.goalInto(*t.home);
  expectScore(c, t, 0, 1, 3 * 60000);
  auto posts = sent(t.home->link, "POST", "/goal-events");
  c.check(posts.size() == 5, "%zu attempts for 4 errors + 1 success", posts.size());
  for (size_t i = 2; i < posts.size(); i++) {
    int64_t gap = posts[i]->t - posts[i - 1]->t, prev = posts[i - 1]->t - posts[i - 2]->t;
    c.check(gap > prev, "retry %zu after %lld ms, previous gap %lld ms: backoff should grow", i, (long long)gap,
            (long long)prev);
  }
  c.runFor(20000);
  f.push_back({Fault::Kind::Code, 422, "/goal-events", 1});
  t.goalInto(*t.home);
  c.runFor(20000);
  c.check(t.right() == 1, "rejected goal counted");
  if (!waitAsleep(c, *t.home)) return;
  auto st = statuses(t.home->link, "sleep");
  c.check(!st.empty() && field(st.back()->body, "dropped_events") == "1", "dropped_events != 1 after a 422");
}

// NVS wiped (reflash with erase): new secret for a known device_id -> 401. The device keeps the
// goal queued and retries with backoff; it never gives up (an admin reset makes it work again).
static void nvsWipe(Ctx& c) {
  Table& t = *c.t[0];
  t.powerOn();
  auto known = [&] { return !sent(t.home->link, "GET", "/config").empty() && sent(t.home->link, "GET", "/config")[0]->code == 200; };
  if (!c.check(c.waitFor(known, 10000), "%s never got its config (not enrolled)", t.home->id().c_str())) return;
  t.home->pull();
  t.home->wipeNvs();
  t.home->powerOn();
  c.runFor(3000);
  auto cfg = sent(t.home->link, "GET", "/config");
  c.check(!cfg.empty() && cfg.back()->code == 401, "known device with a new secret: config answered %d",
          cfg.empty() ? 0 : cfg.back()->code);
  t.goalInto(*t.home);
  c.runFor(3 * 60000);
  auto posts = sent(t.home->link, "POST", "/goal-events");
  c.check(posts.size() >= 3, "only %zu attempts in 3 min: a 401 must be retried", posts.size());
  bool all401 = std::all_of(posts.begin(), posts.end(), [](const Sent* p) { return p->code == 401; });
  c.check(all401, "a goal from a device with the wrong secret was accepted");
  c.check(t.right() == 0, "goal from an unauthenticated device scored");
  c.check(t.home->rtc().goals == 1, "the goal wasn't counted on the device");
}


// Plan C (review 2, R2-B3): in light D8 can't see through, the app polls chopped reads every chop_ms instead.
// The fastest ball (31 mm at 3 m/s: (31 - 3) / 3 = 9.3 ms of block, electronics/README) must count at any phase
// against the poll grid and the radio (each goal's POST), with the screen off and on (its redraws run on the
// glue's own task).
static void planC(Ctx& c) {
  Table& t = *c.t[0];
  GoalDevice& g = *t.home;
  t.powerOn();
  // A goal the app only gets to after the ball has left (the core held up 100 ms): counted from the D8 edge, and
  // the in-ball light isn't read from the lit node (that would be a false ambient_high in the dark).
  c.w.clk.after(299, [&g] { g.busy(100); });
  t.goalInto(g);
  if (!expectScore(c, t, 0, 1)) return;
  for (auto* st : statuses(g.link, "beam"))
    c.check(field(st->body, "health") != "\"ambient_high\"", "a late-counted goal reported ambient_high in the dark (ball_ua %s)",
            field(st->body, "ball_ua").c_str());
  double sun = 2 * tol(beam::Mode::B);  // beyond what D8 tolerates in any mode
  g.setAmbient(sun);
  t.motion();
  if (!c.check(c.waitFor([&] { return g.chopping; }, 90000), "chopped reads never came on in %.0f µA", sun)) return;  // next check
  const int n = 60;
  for (bool screen : {false, true}) {  // n balls at random phases
    int before = t.right();
    for (int i = 0; i < n; i++) {
      if (screen && i % 3 == 0) g.holdButton(300);  // a short press: the screen stays on (no undo)
      c.runFor(1600 + c.w.env.rng() % 2000);         // past the lockout, at a random phase
      g.ball(9);
    }
    c.runFor(12000);  // the screen goes off again
    c.check(t.right() - before == n, "%d of %d fastest balls (9 ms) missed with chopped reads, the radio%s", n - (t.right() - before),
            n, screen ? " and the screen on" : "");
  }
  c.check(g.chopping, "chopped reads went off in %.0f µA", sun);
}

std::vector<Scenario>& scenarios() {
  using R = Scenario::Reg;
  static std::vector<Scenario> s = {
      {"simultaneous_burst", "8 rounds of same-instant goals at both ends: 8 : 8, none lost, no retries", 1, simultaneousBurst},
      {"clock_skew", "goal devices 5 s behind / ahead / never synced: every goal counts", 1, clockSkew},
      {"power_pull_mid_post", "cells pulled mid-POST and mid-NVS-write: resend deduped, no seq reuse", 1,
       powerPullMidPost},
      {"offline_queue_drain", "Wi-Fi down for 5 goals: queued, delivered once when it's back", 1, offlineQueueDrain},
      {"stuck_ball", "ball stuck in the gate: one goal, status beam_blocked", 1, stuckBall},
      {"low_battery", "low_batt warning; below cutoff one status, then silent until fresh cells", 1, lowBattery},
      {"heartbeat_and_silence", "idle devices heartbeat daily; a dead one goes silent for 50 h", 1,
       heartbeatAndSilence},
      {"role_mismatch", "config role 'scoreboard' for a goal counter: still counts, mismatch reported", 1, roleMismatch,
       [](int n) { return std::vector<R>{{twinId(n, 1), "scoreboard", tableId(n), "home"}}; }},
      {"unassigned", "config 404: goals still sent (table_id null)", 1, unassigned,
       [](int n) { return std::vector<R>{{twinId(n, 1), "", "", ""}}; }},
      {"server_errors", "503/429/401 retried with growing backoff; 422 dropped and counted", 1, serverErrors},
      {"nvs_wipe", "NVS wiped: new secret -> 401, goal kept and retried, never scored", 1, nvsWipe},
      {"several_tables", "3 tables, interleaved random goals: each counter's goals accepted once", 3, severalTables},
      {"ball_sizes", "31 and 36 mm balls at 0.5-3 m/s count once, a ball rolling back too", 1, ballSizes},
      {"usb_flash", "USB plugged in: goal counter wakes, never sleeps, counts; sleeps again unplugged", 1,
       usbFlash},
      {"drawer_queue", "3 quick goals, a queued ball nudged into the beam: each goal once, parked ball = blocked", 1,
       drawerQueue},
      {"drawer_light", "drawer light over the day: a -> ambient_high, auto -> b -> back to a; sun; b failing its margin", 1,
       drawerLight, [](int n) { return std::vector<R>{{twinId(n, 2), "goal", tableId(n), "away", "\"beam_mode\": \"auto\""}}; }},
      {"beam_faults", "beam health: dirty aperture / weak LED -> low_margin, shorted receiver -> sensor_dead; no goal made up", 1,
       beamFaults, [](int n) { return std::vector<R>{{twinId(n, 2), "goal", tableId(n), "away", "\"beam_mode\": \"b\""}}; }},
      {"plan_c", "bright sun: chopped reads every 3 ms count the fastest ball (9 ms) through OLED and radio activity", 1, planC},
      {"goal_undo", "goal counter undo button: own goal within 10 s undone; short, late, asleep, stuck, not yours: not", 1,
       goalUndo},
  };
  return s;
}

}  // namespace sim
