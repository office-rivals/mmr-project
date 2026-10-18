#pragma once
// The seam between GoalApp (all orchestration, hardware-free) and the glue that runs it
// (src/goal/ on the ESP32, or the digital twin on a host).
//
// Rules for both sides:
// - The app is single-threaded and never blocks. The glue calls boot() once per wake, forwards events
//   (beam edges, keys, network answers), and calls tick() again within the ms tick() returned.
// - Network is asynchronous: the app calls Hal::send(id, ...); the glue answers later with
//   app.response(id, code, body), on the app's thread. code <= 0 = no answer (network error,
//   Wi-Fi down, timeout). The glue connects Wi-Fi on demand (NTP on the first connect of a wake).
// - Deep sleep is a request (Hal::deepSleep); the app is done after it. RtcState is the only state
//   that survives it: plain data the glue keeps (RTC memory on the device), zeroed on power-on.
#include <stdint.h>

#include <string>

#include "beam_health.h"
#include "event_queue.h"
#include "sound.h"
#include "telemetry.h"

namespace app {

enum class WakeCause : uint8_t { PowerOn, Motion, Key, Timer, Usb };  // Usb: USB 5 V plugged in (VBUS sense)

// Requests on one lane are answered in order; lanes run independently (own keep-alive connection).
enum class Lane : uint8_t { Rest, Otlp };

struct SleepRequest {  // wakes: the LIS3DH interrupt, the undo button (not while held), USB, and the timer
  uint32_t timer_s = 0;  // 0 = no timer wake
  uint8_t blinks = 0;    // the status LED while asleep (LP core): 1 = green, 2-3 = red, per group; 0 = dark
};

enum class Led : uint8_t { Off, Green, Red };  // the status LED (GPIO5: HIGH green, LOW red, Hi-Z off)

// The goal counter's debug OLED (ux B5a): 2 lines of 16 characters (8 x 16 font), the verdict and a cycling
// detail; bit i of `inverse` set = line i is a fault (inverse video).
struct StatusView {
  char line[2][17];
  uint8_t inverse;
};

struct WifiStats {
  uint32_t connects = 0;        // successful connects this wake
  int32_t connect_ms = -1;      // last connect, -1 = none yet
  int32_t rssi = 0;             // 0 = unknown
  uint32_t failed_attempts = 0;  // this wake
};

struct Hal {
  virtual uint32_t millis() = 0;
  virtual int64_t epochMs() = 0;        // 0 = not NTP-synced this wake
  virtual uint32_t rtcSeconds() = 0;    // monotonic since power-on, runs through deep sleep
  virtual int batteryMv() = 0;          // pack voltage, -1 = unknown or no pack; read with the radio idle
  virtual Kv& kv() = 0;                 // NVS on the device (atomic per write)
  virtual uint32_t random() = 0;
  virtual void print(const std::string& line) {}  // bench serial log
  virtual std::string deviceId() = 0;
  virtual std::string resetReason() { return ""; }
  virtual uint32_t freeHeap() { return 0; }
  virtual uint32_t minFreeHeap() { return 0; }

  virtual void send(uint32_t id, Lane lane, const char* method, const std::string& path, const std::string& body,
                    uint32_t timeout_ms) = 0;
  virtual bool otlpEnabled() = 0;       // an OTLP endpoint is configured
  virtual void wifiOff() = 0;           // drop the connection now (per-goal mode, before sleep)
  virtual void wifiTxLow(bool low) {}   // round 3: TX power down below the warn level (now, and for later connects)
  virtual WifiStats wifiStats() = 0;
  virtual void deepSleep(const SleepRequest& r) = 0;

  // Configure the board's pins (beam, button, buzzer, OLED, LED, accelerometer). Called by the app on a working
  // wake, not on a heartbeat or a cutoff re-sleep.
  virtual void boardInit() {}

  // USB 5 V present (VBUS sense; false where not fitted). While it is, the app never deep-sleeps and
  // turns auto light sleep off, so USB-Serial/JTAG stays up for flashing in place.
  virtual bool usbPowered() { return false; }
  virtual void lightSleep(bool allowed) {}
  virtual void beamPower(bool on) {}
  virtual bool beamBlocked() { return false; }
  // Beam health (electronics/beam-health-2026-10-16.md). The glue masks the beam ISR while it switches
  // pins; a ball that came in meanwhile reaches beam() as an edge timed at the start of the mask.
  virtual void beamMode(beam::Mode m, uint32_t settle_ms) {}  // the pins of an active mode (A, A+, B)
  virtual bool beamCheck(uint32_t settle_ms, beam::Reading& r) { return false; }  // false: no ADC fitted
  virtual int beamMv() { return -1; }  // the receiver node now (read during a goal); -1 = no ADC
  // Plan C (review 2): one chopped read, both pull-ups: node mV with the LED off minus at 1 mA; -1 = no ADC
  virtual int beamChop() { return -1; }
  virtual bool motionSeen() { return false; }  // reads and re-arms the latched LIS3DH interrupt
  virtual bool buttonDown() { return false; }  // the undo button now (changes reach GoalApp::button)
  virtual void led(bool on) {}
  virtual void statusLed(Led c) {}  // awake; the glue ignores it until boardInit (a heartbeat wake leaves the LP core on)
  // The debug OLED: draw this view (nullptr = panel sleep, 0xAE; it stays off through deep sleep). Must not
  // block: the glue draws from its own lower-priority task (a frame is ~50 ms of I²C), and the panel-off frame
  // goes out before deep sleep.
  virtual void oled(const StatusView* v) {}

  virtual void tone(uint32_t hz, int duty_bp) {}  // buzzer: square wave, duty in 0.01 % (5000 = 50 %); hz 0 = silent

  virtual ~Hal() = default;
};

// Everything that must survive deep sleep. Counters run since power-on.
struct RtcState {
  uint32_t magic, build;
  uint32_t wake_count;
  bool cutoff;
  uint32_t heartbeat_due_s, heartbeat_failures;
  uint32_t goals, short_blocks, stuck_events, wifi_failed;
  beam::Persist beam;  // the day's beam baselines and the auto mode
  uint8_t led_blinks;  // the status LED's count asleep, from the last session
  tel::LogRing log;

  // Keeps the state across deep sleep; zeroes it after power-on (garbage) or for another build.
  void init(uint32_t build_id) {
    if (magic != MAGIC || build != build_id) {
      memset(this, 0, sizeof *this);
      magic = MAGIC;
      build = build_id;
    }
    log.init(build_id);
  }

 private:
  static constexpr uint32_t MAGIC = 0x52544331;  // "RTC1"
};

}  // namespace app
