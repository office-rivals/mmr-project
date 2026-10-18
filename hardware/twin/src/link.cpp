#include "link.h"

#include <algorithm>
#include <chrono>
#include <set>

namespace sim {

Fault* Link::match(Lane lane, const std::string& path) {
  for (auto& f : faults)
    if (f.count != 0 && (lane != Lane::Otlp || f.kind == Fault::Kind::Offline) &&
        path.find(f.path) != std::string::npos) {
      if (f.count > 0) f.count--;
      return &f;
    }
  return nullptr;
}

static std::string esc(const std::string& s) {
  std::string o;
  for (unsigned char ch : s) {
    if (ch == '"' || ch == '\\') o += '\\', o += (char)ch;
    else if (ch < 0x20) {
      char b[8];
      snprintf(b, sizeof b, "\\u%04x", ch);
      o += b;
    } else o += (char)ch;
  }
  return o;
}

// One JSON line per request (dir ">") and per answer ("<"); n pairs them within a device.
void Link::wire(size_t i, Lane lane, const char* dir, int code, const std::string& body, const char* note) {
  if (!ep_.wire) return;
  static const char* lanes[] = {"rest", "otlp"};
  long long real = std::chrono::duration_cast<std::chrono::milliseconds>(
                       std::chrono::system_clock::now().time_since_epoch()).count();
  const Sent& s = sent[i];
  fprintf(ep_.wire, "{\"real_ms\":%lld,\"t\":%lld,\"dev\":\"%s\",\"n\":%zu,\"lane\":\"%s\",\"dir\":\"%s\","
          "\"method\":\"%s\",\"path\":\"%s\",\"code\":%d,\"note\":\"%s\",\"body\":\"%s\"}\n",
          real, (long long)clk_.now(), device_id.c_str(), i, lanes[(int)lane], dir, s.method.c_str(),
          esc(s.path).c_str(), code, note, esc(body).c_str());
  fflush(ep_.wire);
}

void Link::send(Lane lane, const std::string& method, const std::string& path, const std::string& body,
                uint32_t timeout_ms, Done done) {
  size_t i = sent.size();
  sent.push_back({clk_.now(), method, path, body, 0, false});
  wire(i, lane, ">", 0, body, "");
  uint64_t gen = gen_;
  auto finish = [this, i, gen, done, lane](int code, const std::string& resp, bool injected) {
    if (gen != gen_) {  // device lost power or slept meanwhile: the answer is never seen
      wire(i, lane, "<", code, resp, "unseen");
      return;
    }
    wire(i, lane, "<", code, resp, injected ? "injected" : "");
    sent[i].code = code, sent[i].injected = injected;
    done(code, resp);
  };
  Fault* f = match(lane, path);
  if (f && f->kind == Fault::Kind::Offline) {  // no AP: the connect attempt times out
    clk_.after(wifi_connect_ms * 4, [=] { finish(-1, "", true); });
    return;
  }
  if (f && f->kind == Fault::Kind::Code) {
    int code = f->code;
    clk_.after(50, [=] { finish(code, "", true); });
    return;
  }
  bool otlp = lane == Lane::Otlp;
  net::Request r{method, (otlp ? ep_.otlp_base : ep_.rest_base) + path, body};
  r.timeout_ms = timeout_ms;
  if (otlp && !ep_.otlp_header.empty()) r.headers.push_back(ep_.otlp_header);
  if (!otlp) {  // §11 device auth, as lib/device/device.cpp sends it
    r.headers.push_back("X-Device-Id: " + device_id);
    r.headers.push_back("Authorization: Device " + secret);
    r.headers.push_back("X-Enrolment-Token: " + ep_.enrolment_token);
  }
  if (f && f->kind == Fault::Kind::PowerPull) {
    bool landed = false;  // the server answers, but the device is already dead
    http_.send(r, [this, i, &landed, lane](int code, const std::string& resp) {
      sent[i].code = code, landed = true;
      wire(i, lane, "<", code, resp, "power-pulled");
    });
    while (!landed) http_.poll(5);  // virtual time is frozen meanwhile
    if (on_power_pull) on_power_pull();
    return;
  }
  live_.push_back(http_.send(r, [=](int code, const std::string& resp) { finish(code, resp, false); }));
}

void Link::powerLoss() {
  gen_++;
  for (uint64_t id : live_) http_.forget(id);
  live_.clear();
}

int Link::held(const char* path) const {
  std::set<std::string> ids;
  int n = 0;
  for (auto& s : sent) {
    if (s.method != "POST" || s.path.find(path) == std::string::npos) continue;
    size_t p = s.body.find("\"event_id\":\"");
    std::string id = p == std::string::npos ? "" : s.body.substr(p + 12, s.body.find('"', p + 12) - p - 12);
    if (s.code >= 200 && s.code < 300) n++, ids.insert(id);
    else if (s.code == 409 && ids.insert(id).second) n++;
  }
  return n;
}

}  // namespace sim
