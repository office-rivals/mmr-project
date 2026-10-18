// twin: virtual foosball tables (2 goal counters each) running the firmware's own lib/core app on
// simulated hardware, against a real REST server + OTLP endpoint. See README.md.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <algorithm>
#include <map>
#include <chrono>
#include <string>

#include "scenario.h"

using namespace sim;

static const char* USAGE = R"(usage: twin [options] <command>

commands:
  list                      scenarios and what each one checks
  run <name>... | all       run scenarios; exit 1 if any expectation fails
  play [--tables N] [--hours H] [--silent N[@H]] [--low-batt N]
                            N tables play seeded office sessions (matches, then rest) for H
                            virtual hours (default 0.5). Faults on the first N tables:
                            --silent: home goal device dies after H h (default 1 min), never back
                            --low-batt: away goal device low (between cutoff and warn)
  devices                   device registry JSON for the mock server (--devices) or your backend
  selftest [url]            check the sim layer itself

options:
  --base URL        REST base URL                   (env TWIN_BASE,  default http://127.0.0.1:8000)
  --token T         enrolment token (§11)           (env TWIN_ENROLMENT_TOKEN, default twin)
                    device secrets derive from env TWIN_SECRET_SEED (default twin)
  --otlp URL        OTLP/HTTP base, "" = off        (env TWIN_OTLP,  default = --base)
  --otlp-header H   e.g. "x-api-key: ..."           (env TWIN_OTLP_HEADER)
  --speed X         virtual/real time; 0 = as fast as possible (default 0)
  --seed N          RNG seed (default 1)
  --ball MM         ball diameter for every goal (default 31; range: INTERFACES §0)
  --start T         virtual clock start: now (default), -3d / -12h / -30m, or 2026-10-14T00:00:00Z
  --wire FILE       log every request + answer (bodies, virtual + real time) as JSON lines
  -v                device logs on stderr
)";

int selftest(const char* url);  // selftest.cpp

static const char* env(const char* k, const char* def) {
  const char* v = getenv(k);
  return v ? v : def;
}

// Table numbers: scenarios get consecutive ranges in list order; play uses 101+.
static int firstTable(size_t i) {
  int n = 1;
  for (size_t k = 0; k < i; k++) n += scenarios()[k].tables;
  return n;
}
constexpr int PLAY_FIRST = 101, PLAY_MAX = 10;

static void devicesJson() {
  struct Dev {
    std::string id, role, table, slot, config;
  };
  std::vector<Dev> devs;
  std::vector<int> tables;
  auto addTable = [&](int n) {
    tables.push_back(n);
    devs.push_back({twinId(n, 1), "goal", tableId(n), "home"});
    devs.push_back({twinId(n, 2), "goal", tableId(n), "away"});
  };
  for (size_t i = 0; i < scenarios().size(); i++) {
    auto& s = scenarios()[i];
    int first = firstTable(i);
    for (int k = 0; k < s.tables; k++) addTable(first + k);
    if (!s.regs) continue;
    for (auto& r : s.regs(first)) {
      std::erase_if(devs, [&](const Dev& d) { return d.id == r.id; });
      if (!r.role.empty()) devs.push_back({r.id, r.role, r.table, r.slot, r.config});
    }
  }
  for (int n = PLAY_FIRST; n < PLAY_FIRST + PLAY_MAX; n++) addTable(n);
  printf("{\n  \"devices\": {\n");
  for (size_t i = 0; i < devs.size(); i++) {
    auto& d = devs[i];
    printf("    \"%s\": { \"role\": \"%s\", \"table_id\": \"%s\", \"%s\": \"%s\"%s%s }%s\n", d.id.c_str(),
           d.role.c_str(), d.table.c_str(), d.role == "goal" ? "goal" : "end", d.slot.c_str(),
           d.config.empty() ? "" : ", ", d.config.c_str(), i + 1 < devs.size() ? "," : "");
  }
  printf("  },\n  \"tables\": {\n");
  for (size_t i = 0; i < tables.size(); i++) {
    int n = tables[i];
    const char* sep = i + 1 < tables.size() ? "," : "";
    printf("    \"%s\": { \"name\": \"Twin %d\", \"teams\": { \"home\": { \"name\": \"RED\", \"players\": "
           "[\"Ann %d\", \"Bo %d\"] }, \"away\": { \"name\": \"BLUE\", \"players\": [\"Cy %d\", \"Di %d\"] } } }%s\n",
           tableId(n).c_str(), n, n, n, n, n, sep);
  }
  printf("  }\n}\n");
}

static int runScenarios(const Settings& base, std::vector<std::string> names) {
  if (names.empty()) return fprintf(stderr, "run: name a scenario, or 'all'\n"), 2;
  bool all = names.size() == 1 && names[0] == "all";
  int failed = 0, ran = 0;
  for (size_t i = 0; i < scenarios().size(); i++) {
    auto& s = scenarios()[i];
    if (!all && std::find(names.begin(), names.end(), s.name) == names.end()) continue;
    std::erase(names, s.name);
    World w(base);
    Ctx c{w};
    for (int k = 0; k < s.tables; k++) c.t.push_back(&w.addTable(firstTable(i) + k));
    fprintf(stderr, "%-24s %s\n", s.name, s.what);
    auto t0 = std::chrono::steady_clock::now();
    s.fn(c);
    for (auto& t : w.tables)  // every scenario: no device may spin (CPU awake = battery drain)
      for (GoalDevice* d : {t->home.get(), t->away.get()}) {
        c.check(!d->busy_loops, "%s: tick() kept returning 0 ms (busy loop)", d->id().c_str());
        c.check(!d->buzzing_sleeps, "%s went to sleep with the buzzer on", d->id().c_str());
        c.check(!d->lit_sleeps, "%s went to sleep with the screen on", d->id().c_str());
        for (auto& f : d->led_faults) c.check(false, "%s status LED: %s", d->id().c_str(), f.c_str());
      }
    double real = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    fprintf(stderr, "  %s  (%.0f s virtual, %.1f s real)\n", c.fails ? "FAILED" : "ok", w.clk.now() / 1000.0, real);
    failed += c.fails > 0;
    ran++;
  }
  if (!all && !names.empty()) return fprintf(stderr, "unknown scenario: %s (see 'twin list')\n", names[0].c_str()), 2;
  fprintf(stderr, "\n%d/%d scenarios passed\n", ran - failed, ran);
  return failed ? 1 : 0;
}

struct PlayOpts {
  int tables = 1;
  double hours = 0.5;
  int silent = 0, low_batt = 0;
  double silent_after_h = 1.0 / 60;
};

// Tables play sessions like an office: 15 goals (one every 15-60 s at a random end),
// then the table rests 20 min - 4 h, so devices sleep, heartbeat and wake again. Faults, each on
// the first N tables: --silent N[@H] home goal device's cells pulled after H hours (default 1 min),
// never back; --low-batt N away goal device low (between cutoff and warn).
static int play(const Settings& st, const PlayOpts& o) {
  if (o.tables < 1 || o.tables > PLAY_MAX) return fprintf(stderr, "play: --tables 1..%d\n", PLAY_MAX), 2;
  World w(st);
  auto& rng = w.env.rng;
  for (int k = 0; k < o.tables; k++) {
    Table& t = w.addTable(PLAY_FIRST + k);
    if (k < o.low_batt) t.away->battery_mv = MV_LOW;
    t.powerOn();
    if (k < o.silent) w.clk.after(int64_t(o.silent_after_h * 3600000), [&t] { t.home->pull(); });
  }
  std::function<void(Table*, int)> next = [&](Table* t, int goals) {
    bool done = goals >= 15;
    int64_t gap = done ? 20 * 60000 + rng() % (220 * 60000) : 15000 + rng() % 45000;
    w.clk.after(gap, [&, t, done, goals] {
      t->goalInto(rng() % 2 ? *t->home : *t->away);
      fprintf(stderr, "%s  table %d  %d : %d\n", api::iso8601(w.clk.epochMs()).c_str(), t->n, t->left(), t->right());
      next(t, done ? 1 : goals + 1);
    });
  };
  for (auto& t : w.tables) next(t.get(), 0);
  fprintf(stderr, "playing %d table(s) for %.1f h from %s\n", o.tables, o.hours, api::iso8601(w.clk.epochMs()).c_str());
  w.run.runFor(int64_t(o.hours * 3600000));
  return 0;
}

// --start: "now", "-3d" / "-12h" / "-30m" (before now), or "2026-10-14T00:00:00Z".
static bool parseStart(const char* v, int64_t& out) {
  int64_t now = std::chrono::duration_cast<std::chrono::milliseconds>(
                    std::chrono::system_clock::now().time_since_epoch()).count();
  if (!strcmp(v, "now")) return out = now, true;
  char unit = 0;
  double n;
  if (v[0] == '-' && sscanf(v + 1, "%lf%c", &n, &unit) == 2) {
    int64_t ms = unit == 'd' ? 86400000 : unit == 'h' ? 3600000 : unit == 'm' ? 60000 : 0;
    return ms && (out = now - int64_t(n * ms), true);
  }
  struct tm t = {};
  if (!strptime(v, "%Y-%m-%dT%H:%M:%SZ", &t)) return false;
  out = int64_t(timegm(&t)) * 1000;
  return true;
}

int main(int argc, char** argv) {
  Settings st;
  st.ep.rest_base = env("TWIN_BASE", "http://127.0.0.1:8000");
  st.ep.enrolment_token = env("TWIN_ENROLMENT_TOKEN", "twin");
  st.ep.secret_seed = env("TWIN_SECRET_SEED", "twin");
  const char* otlp = getenv("TWIN_OTLP");
  st.ep.otlp_header = env("TWIN_OTLP_HEADER", "");
  PlayOpts po;
  std::vector<std::string> pos;
  for (int i = 1; i < argc; i++) {
    std::string a = argv[i];
    auto val = [&]() -> const char* {
      if (i + 1 >= argc) fprintf(stderr, "%s needs a value\n", a.c_str()), exit(2);
      return argv[++i];
    };
    if (a == "--base") st.ep.rest_base = val();
    else if (a == "--token") st.ep.enrolment_token = val();
    else if (a == "--otlp") otlp = val();
    else if (a == "--otlp-header") st.ep.otlp_header = val();
    else if (a == "--speed") st.speed = atof(val());
    else if (a == "--seed") st.seed = strtoull(val(), nullptr, 10);
    else if (a == "--ball") st.ball_mm = atof(val());
    else if (a == "--wire") {
      const char* path = val();
      if (!(st.ep.wire = fopen(path, "w"))) return perror(path), 2;
    }
    else if (a == "--start") {
      if (!parseStart(val(), st.start_ms)) return fprintf(stderr, "bad --start %s\n", argv[i]), 2;
    } else if (a == "--tables") po.tables = atoi(val());
    else if (a == "--hours") po.hours = atof(val());
    else if (a == "--silent") {
      const char* v = val();
      po.silent = atoi(v);
      if (const char* at = strchr(v, '@')) po.silent_after_h = atof(at + 1);
    } else if (a == "--low-batt") po.low_batt = atoi(val());
    else if (a == "-v") st.verbose = true;
    else if (a == "-h" || a == "--help") return fputs(USAGE, stdout), 0;
    else if (a.starts_with("-")) return fprintf(stderr, "unknown option %s\n%s", a.c_str(), USAGE), 2;
    else pos.push_back(a);
  }
  st.ep.otlp_base = otlp ? otlp : st.ep.rest_base;
  if (pos.empty()) return fputs(USAGE, stderr), 2;
  std::string cmd = pos[0];
  pos.erase(pos.begin());
  if (cmd == "list") {
    for (auto& s : scenarios()) printf("%-24s %s\n", s.name, s.what);
    return 0;
  }
  if (cmd == "devices") return devicesJson(), 0;
  if (cmd == "run") return runScenarios(st, pos);
  if (cmd == "play") return play(st, po);
  if (cmd == "selftest") return selftest(pos.empty() ? nullptr : pos[0].c_str());
  fprintf(stderr, "unknown command %s\n%s", cmd.c_str(), USAGE);
  return 2;
}
