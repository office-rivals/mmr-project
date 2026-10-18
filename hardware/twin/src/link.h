#pragma once
// One virtual device's network: real HTTP to the REST server / OTLP endpoint, plus faults a
// scenario arms (Wi-Fi down, injected status codes, power pull mid-request). Everything sent is
// recorded so scenarios can assert on the wire traffic.
#include <stdint.h>
#include <stdio.h>

#include <functional>
#include <string>
#include <vector>

#include "app.h"
#include "http.h"
#include "sim.h"

namespace sim {

struct Endpoints {
  std::string rest_base;
  std::string enrolment_token;    // X-Enrolment-Token (INTERFACES §11)
  std::string secret_seed;        // device secrets derive from it (see Device::ensureSecret)
  std::string otlp_base;          // empty = telemetry off
  std::string otlp_header;        // "Name: value", optional
  FILE* wire = nullptr;           // --wire: every request and answer as JSON lines
};

struct Fault {
  // Code: the twin answers `code`, the server never sees it (REST lanes only).
  // Offline: Wi-Fi/AP down, every lane fails. PowerPull: the request goes out for real, then the
  // device loses power before the answer (the server must dedupe the resend).
  enum class Kind { Code, Offline, PowerPull } kind;
  int code = 0;
  std::string path;          // substring the request path must contain; "" = any
  int count = -1;            // how many requests it hits; -1 = until cleared
};

struct Sent {
  int64_t t;  // virtual ms
  std::string method, path, body;
  int code;       // what the device saw; 0 = still in flight / never answered (power lost)
  bool injected;  // the code came from a fault, not the server
};

class Link {
 public:
  using Lane = app::Lane;  // the firmware's, so the two never drift
  using Done = net::Done;

  Link(Clock& clk, net::Http& http, const Endpoints& ep) : clk_(clk), http_(http), ep_(ep) {}

  void send(Lane lane, const std::string& method, const std::string& path, const std::string& body,
            uint32_t timeout_ms, Done done);
  // Power gone: in-flight answers never arrive. Requests already sent may still land server-side.
  void powerLoss();

  std::vector<Fault> faults;
  std::function<void()> on_power_pull;  // set by the device
  std::string device_id, secret;        // §11 auth headers on REST requests
  std::vector<Sent> sent;
  // Events the server holds from this device on `path` (/goal-events, /undo-events): each event_id
  // answered 2xx or 409 once, plus every further 2xx for it (the server failed to dedupe).
  int held(const char* path) const;
  int wifi_connect_ms = 800, rssi = -58;

 private:
  Clock& clk_;
  net::Http& http_;
  const Endpoints& ep_;
  uint64_t gen_ = 0;  // bumped on power loss: stale scheduled answers are ignored
  std::vector<uint64_t> live_;
  Fault* match(Lane lane, const std::string& path);
  void wire(size_t i, Lane lane, const char* dir, int code, const std::string& body, const char* note);
};

}  // namespace sim
