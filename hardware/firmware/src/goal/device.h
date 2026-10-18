#pragma once
// The ESP32 side of the app::Hal seam (XIAO ESP32-C6): time, battery, NVS, Wi-Fi + the network lanes,
// the buzzer, deep sleep. Pins come from include/board.h; main.cpp adds the beam, button and OLED.
#include <Arduino.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>

#include <deque>
#include <mutex>
#include <string>

#include "app.h"
#include "goal_app.h"

#ifndef FW_VERSION
#define FW_VERSION "0.0.0-dev"
#endif

namespace dev {

void pmInit(bool light_sleep);  // auto light sleep whenever the CPU idles (custom sdkconfig)
uint32_t buildId();             // changes with every build: RtcState from another firmware is discarded

// LIS3DH wake-on-motion (latched INT1). motionSeen() reads and re-arms the latch.
void motionInit();
bool motionSeen();
bool motionPinActive();

// The status LED in deep sleep: the LP core blinks `n` per group (1 green, 2-3 red); 0 = stop it, pin Hi-Z.
void lpBlink(uint8_t n);

// One keep-alive HTTP connection to one base URL. Not thread-safe: one per lane task.
class Http {
 public:
  enum class Auth { Api, Otlp };
  explicit Http(Auth auth) : auth_(auth) {}
  int request(const char* method, const std::string& path, const std::string& body, String* resp,
              uint32_t timeout_ms);  // HTTP status, or <= 0 on network error / timeout

 private:
  Auth auth_;
  NetworkClientSecure tls_;
  NetworkClient plain_;
  HTTPClient h_;
  bool init_ = false;
};

// Not copyable: it owns tasks.
class DeviceHal : public app::Hal {
 public:
  explicit DeviceHal(bool stay_associated) : stay_(stay_associated) {}
  void begin();                         // after the strap read: NVS, lanes, RF switch off
  app::WakeCause wakeCause();
  void deliver(app::GoalApp& a);        // hand finished requests to the app (app thread)
  void wait(uint32_t ms);               // light-sleep until notified or ms passed
  void notifyFromIsr();                 // ISRs: wake the app thread

  uint32_t millis() override { return ::millis(); }
  int64_t epochMs() override;
  uint32_t rtcSeconds() override;
  int batteryMv() override;
  Kv& kv() override;
  uint32_t random() override { return esp_random(); }
  void print(const std::string& line) override { Serial.println(line.c_str()); }
  std::string deviceId() override;
  std::string resetReason() override;
  uint32_t freeHeap() override;
  uint32_t minFreeHeap() override;
  void send(uint32_t id, app::Lane lane, const char* method, const std::string& path, const std::string& body,
            uint32_t timeout_ms) override;
  bool otlpEnabled() override;
  void wifiOff() override;
  void wifiTxLow(bool low) override;
  app::WifiStats wifiStats() override;
  void deepSleep(const app::SleepRequest& r) override;
  void led(bool on) override;
  bool usbPowered() override;
  void lightSleep(bool allowed) override;
  // Buzzer: LEDC square wave on pin -> BC337 -> CMT-1209.
  void buzzerInit(int pin);
  void tone(uint32_t hz, int duty_bp) override;

 private:
  struct Req {
    uint32_t id;
    std::string method, path, body;
    uint32_t timeout_ms;
  };
  struct Res {
    uint32_t id;
    int code;
    std::string body;
  };
  bool stay_;
  TaskHandle_t app_task_ = nullptr;
  QueueHandle_t lanes_[2] = {};
  std::mutex mu_;  // results_, stats_
  std::deque<Res> results_;
  app::WifiStats stats_;
  bool led_init_ = false;
  int buzzer_pin_ = -1;
  bool sounding_ = false;
  uint32_t tone_hz_ = 0;
  void* tone_lock_ = nullptr;  // esp_pm_lock_handle_t

  static void laneTask(void* arg);
  bool ensureWifi();
};

}  // namespace dev
