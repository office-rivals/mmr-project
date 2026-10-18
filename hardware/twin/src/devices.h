#pragma once
// The goal counter with its physical parts: beam, receiver, ball, undo button.
#include <algorithm>
#include <string>
#include <vector>

#include "device.h"

namespace sim {

class GoalDevice : public Device {
 public:
  GoalDevice(Env& env, std::string id) : Device(env, std::move(id)) {}

  // A ball rolls through the gate and blocks the beam for `block_ms` (slow ball: ~100+ ms).
  void ball(uint32_t block_ms = 120) {
    setBall(true);
    env_.clk.after(block_ms, [this] { setBall(false); });
  }
  void setBall(bool in_gate) {  // stuck ball: setBall(true) and leave it
    in_gate_ = in_gate;
    edge();
  }
  bool beamOn() const { return beam_on_; }

  // The undo button (ux B2), held down for ms. From deep sleep a press wakes it (ext1). A held pin is no
  // wake: the glue leaves it out until released (its 60 s re-check isn't modelled; a press after release
  // always wakes). Bounces aren't modelled.
  void holdButton(uint32_t ms) {
    setButton(true);
    env_.clk.after(ms, [this] { setButton(false); });
  }
  void setButton(bool down) {  // a stuck button: setButton(true) and leave it
    if (btn_ == down) return;
    btn_ = down;
    if (down && powered() && asleep_) return wake(app::WakeCause::Key);
    uint32_t ms = millis();
    edgeIn([this, down, ms] { app_->button(down, ms); });
  }
  bool buttonDown() override { return btn_; }

  // The receiver (electronics/beam-health-2026-10-16.md §3): the node is pulled up through the mode's
  // R_PU (B: both in parallel); the phototransistor sinks the LED's light (none with a ball in the
  // gate) plus the drawer light. Fitted parts = firmware's beam config defaults.
  void setAmbient(double ua) {  // drawer light reaching the receiver, µA
    ambient_ua_ = ua;
    edge();
  }
  double lit_ua = 73;  // LED light at 1 mA (typ); dirt or misalignment lowers it
  void shortReceiver(bool on) {  // receiver C-E short: the node sits at 0 V whatever the light
    shorted_ = on;
    edge();
  }
  std::vector<beam::Mode> modes;  // every mode the app switched the pins to
  std::vector<std::string> mode_log;  // why: "b (ambient)" from each '[beam] mode b (ambient)' log line
  const beam::Monitor* monitor() const { return app_ ? &app_->beamMonitor() : nullptr; }  // awake only
  void print(const std::string& line) override {
    if (line.starts_with("[beam] mode ")) mode_log.push_back(line.substr(12));
    if (line.starts_with("[beam] chopped reads ")) chopping = line.starts_with("[beam] chopped reads on");
    Device::print(line);
  }

  void beamPower(bool on) override { beam_on_ = on, level_ = beamBlocked(); }
  void beamMode(beam::Mode m, uint32_t) override {
    if (modes.empty() || modes.back() != m) modes.push_back(m);
    mode_ = m, level_ = beamBlocked();  // the app polls the beam after a switch
  }
  // Between V_IL and V_IH the input may read either way; the twin takes the wrong one (a ball reads
  // clear, no ball reads blocked), so the thresholds in electronics' §3 are where goals start to go.
  bool beamBlocked() override {  // unpowered receiver reads clear
    if (!beam_on_) return false;
    int mv = nodeMv(mode_, mode_ == beam::Mode::A ? 1 : 2);
    return mv >= beam::VIH_MV || (mv > beam::VIL_MV && !in_gate_);
  }
  // ponytail: no ISR mask while checking (a ball arriving in those ~9 ms is delivered as usual).
  bool beamCheck(uint32_t, beam::Reading& r) override {
    r.amb_mv = nodeMv(mode_, 0);
    r.amb20_mv = nodeMv(beam::Mode::B, 0);
    r.lit1_mv = nodeMv(beam::Mode::B, 1);
    return true;
  }
  int beamMv() override { return nodeMv(mode_, mode_ == beam::Mode::A ? 1 : 2); }
  // Plan C's chopped read: the node with the LED off minus at 1 mA, both pull-ups. ponytail: a point sample (the
  // glue's two 0.25 ms settles aren't modelled; a ball edge between them reads half-way).
  int beamChop() override { return beam_on_ ? std::max(0, nodeMv(beam::Mode::B, 0) - nodeMv(beam::Mode::B, 1)) : -1; }
  bool chopping = false;  // from the app's '[beam] chopped reads on/off' log

 private:
  bool in_gate_ = false, beam_on_ = false, level_ = false, shorted_ = false, btn_ = false;
  double ambient_ua_ = 0.2;
  beam::Mode mode_ = beam::Mode::A;
  // leds: 0 = LED off, 1 = D9 only, 2 = D9 + the D10 boost.
  int nodeMv(beam::Mode pulls, int leds) const {
    static const beam::Cfg parts;
    double ma = leds == 0 ? 0 : leds == 1 ? parts.led_ma[0] : parts.led_ma[0] + parts.led_ma[1];
    double ua = ambient_ua_ + (in_gate_ ? 0 : lit_ua * ma);
    return shorted_ ? 0 : (int)std::max(0.0, beam::VDD_MV - ua * beam::pullup(parts, pulls) / 1000);
  }
  void edge() {  // the beam ISR: only a change of what the input reads
    bool b = beamBlocked();
    if (b == level_) return;
    level_ = b;
    uint32_t ms = millis();
    edgeIn([this, b, ms] { app_->beam(b, ms); });
  }
};

}  // namespace sim
