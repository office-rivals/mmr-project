#pragma once
// Simulated NVS. Each write is atomic (like NVS). Power can be pulled before any write: arm
// pullAfter(n) and the n+1-th write never lands, and the device dies right there.
#include <string.h>

#include <functional>
#include <map>
#include <string>

#include "event_queue.h"

namespace sim {

struct NvsKv : Kv {
  std::map<std::string, std::string> m;
  long writes = 0;                 // lifetime count, for scenarios that pick a crash point
  long pull_after = -1;            // -1 = never; 0 = the next write fails and power is lost
  std::function<void()> on_pull;   // the device kills itself (power loss)
  bool dead = false;               // writes after the pull never land

  void pullAfter(long n) { pull_after = n; }

  bool getU32(const char* k, uint32_t& o) override { return getBlob(k, &o, sizeof o); }
  bool setU32(const char* k, uint32_t v) override { return setBlob(k, &v, sizeof v); }
  bool getBlob(const char* k, void* b, size_t n) override {
    auto it = m.find(k);
    if (it == m.end() || it->second.size() != n) return false;
    memcpy(b, it->second.data(), n);
    return true;
  }
  bool setBlob(const char* k, const void* b, size_t n) override {
    if (dead) return false;
    if (pull_after == 0) {
      pull_after = -1;
      dead = true;
      if (on_pull) on_pull();
      return false;
    }
    if (pull_after > 0) pull_after--;
    writes++;
    m[k] = std::string((const char*)b, n);
    return true;
  }
  // Strings (config cache) go through the same path, so a pull can hit them too.
  bool setStr(const char* k, const std::string& v) override { return setBlob(k, v.data(), v.size()); }
  bool getStr(const char* k, std::string& out) override {
    auto it = m.find(k);
    if (it == m.end()) return false;
    out = it->second;
    return true;
  }
  void remove(const char* k) override {
    if (!dead) m.erase(k);
  }
};

}  // namespace sim
