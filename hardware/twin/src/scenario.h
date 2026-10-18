#pragma once
// Scenarios: scripted, seeded table sessions that assert what the devices show and send.
#include <stdarg.h>
#include <stdio.h>

#include <functional>
#include <string>
#include <vector>

#include "world.h"

namespace sim {

struct Ctx {
  World& w;
  std::vector<Table*> t;  // this scenario's tables (own table numbers: scenarios never share state)
  int fails = 0;

  // Records a failed expectation; the scenario keeps going so one run shows every problem.
  bool check(bool ok, const char* fmt, ...) __attribute__((format(printf, 3, 4))) {
    if (ok) return true;
    va_list a;
    va_start(a, fmt);
    fprintf(stderr, "    FAIL @%.1fs: ", w.clk.now() / 1000.0);
    vfprintf(stderr, fmt, a);
    fputc('\n', stderr);
    va_end(a);
    fails++;
    return false;
  }
  void note(const char* fmt, ...) __attribute__((format(printf, 2, 3))) {
    va_list a;
    va_start(a, fmt);
    fprintf(stderr, "    @%.1fs ", w.clk.now() / 1000.0);
    vfprintf(stderr, fmt, a);
    fputc('\n', stderr);
    va_end(a);
  }

  void runFor(int64_t ms) { w.run.runFor(ms); }
  template <class F>
  bool waitFor(F cond, int64_t max_ms) { return w.run.runUntil(cond, max_ms); }
};

struct Scenario {
  const char* name;
  const char* what;  // one line: what it shows the backend
  int tables;
  std::function<void(Ctx&)> fn;
  // Devices the scenario needs registered differently from the default table layout:
  // {device_id, role, table_id, goal-or-end, extra config}; role "" = must NOT be registered (unassigned).
  // config: more DeviceConfig fields for the server to hand out, as JSON members ("\"beam_mode\": \"auto\"").
  struct Reg {
    std::string id, role, table, slot, config;
  };
  std::function<std::vector<Reg>(int first_table)> regs;
};

std::vector<Scenario>& scenarios();

}  // namespace sim
