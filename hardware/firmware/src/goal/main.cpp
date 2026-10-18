// Goal counter image: a thin shell. All behaviour is app::GoalApp (lib/core, host-tested); this file
// only wires the board to it: the D7 strap, beam power + ISR + health pins, the undo button + buzzer,
// the LIS3DH, the debug OLED, the app loop.
#include <Arduino.h>
#include <U8x8lib.h>
#include <Wire.h>
#include <driver/gpio.h>
#include <esp_sleep.h>
#include <hal/gpio_ll.h>

#include "board.h"
#include "device.h"
#include "goal_app.h"

#ifndef WIFI_PER_GOAL
#define WIFI_PER_GOAL 0  // 1: Wi-Fi off between goals, reconnect per goal (fallback)
#endif

RTC_DATA_ATTR static app::RtcState rtc;

// ---- beam ISR. Auto light sleep only wakes on GPIO *levels*, so the beam pin waits for the level
// opposite to its current state; the ISR records the change and flips the level it waits for next.

struct Edge {
  uint32_t ms;
  bool blocked;  // the button's edges: true = pressed
  bool button = false;
};
static QueueHandle_t edges;

#define WAIT_FOR(blocked) \
  (((blocked) ? BEAM_BLOCKED_LEVEL : !BEAM_BLOCKED_LEVEL) ? GPIO_INTR_HIGH_LEVEL : GPIO_INTR_LOW_LEVEL)

// Beam pins (electronics/beam-health §2): HIGH or high-Z while powered, never LOW, except all LOW when off.
static void drive(int pin, bool high) {
  if (pin < 0) return;
  if (high) {
    digitalWrite(pin, HIGH);
    pinMode(pin, OUTPUT);
  } else {
    pinMode(pin, INPUT);
  }
}

struct GoalHal : dev::DeviceHal {
  GoalHal() : DeviceHal(!WIFI_PER_GOAL) {}
  bool ready = false, powered = false;
  beam::Mode mode = beam::Mode::A;

  void boardInit() override {
    esp_deep_sleep_disable_rom_logging();  // D6 (R_PU_B) is U0TXD: the ROM's wake log would toggle it
    for (int p : {PIN_BEAM_POWER, PIN_BEAM_LED, PIN_BEAM_BOOST, PIN_BEAM_PU_B})
      if (p >= 0) {
        pinMode(p, OUTPUT);
        digitalWrite(p, LOW);
        gpio_sleep_sel_dis((gpio_num_t)p);  // keep driving them through light sleep
      }
    if (PIN_BEAM_ADC >= 0) analogSetPinAttenuation(PIN_BEAM_ADC, ADC_11db);  // 12 dB: up to the rail
    pinMode(PIN_BEAM_RX, INPUT);
    gpio_sleep_sel_dis((gpio_num_t)PIN_BEAM_RX);
    dev::motionInit();
    Wire.setClock(I2C_CLOCK_HZ);  // one clock for both chips (U8x8 sets it again per transfer)
    edges = xQueueCreate(32, sizeof(Edge));
    gpio_install_isr_service(ESP_INTR_FLAG_IRAM);
    gpio_isr_handler_add((gpio_num_t)PIN_BEAM_RX, onBeam, this);
    gpio_wakeup_enable((gpio_num_t)PIN_BEAM_RX, WAIT_FOR(beamBlocked()));  // level interrupt + light-sleep wake
    esp_sleep_enable_gpio_wakeup();
    gpio_intr_enable((gpio_num_t)PIN_BEAM_RX);
    if (PIN_UNDO >= 0) {  // as the beam: wait for the other level (light-sleep wake needs levels)
      pinMode(PIN_UNDO, INPUT);  // external 100k pull-up
      gpio_sleep_sel_dis((gpio_num_t)PIN_UNDO);
      gpio_isr_handler_add((gpio_num_t)PIN_UNDO, onButton, this);
      gpio_wakeup_enable((gpio_num_t)PIN_UNDO, buttonDown() ? GPIO_INTR_HIGH_LEVEL : GPIO_INTR_LOW_LEVEL);
      gpio_intr_enable((gpio_num_t)PIN_UNDO);
    }
    buzzerInit(PIN_SOUND);
    dev::lpBlink(0);  // the LP core's sleep blinking ends; awake, statusLed() drives the pin
    if (PIN_STATUS_LED >= 0) gpio_sleep_sel_dis((gpio_num_t)PIN_STATUS_LED);  // holds through light sleep
    if (OLED_ADDR) {
      frames = xQueueCreate(1, sizeof(Frame));
      xTaskCreate(oledTask, "oled", 4096, this, 1, nullptr);  // below the app (2): it preempts every frame
    }
    ready = true;
  }
  void statusLed(app::Led c) override {  // HIGH green, LOW red, Hi-Z off; not before boardInit (heartbeat wakes)
    if (!ready || PIN_STATUS_LED < 0) return;
    if (c == app::Led::Off) return pinMode(PIN_STATUS_LED, INPUT);
    digitalWrite(PIN_STATUS_LED, c == app::Led::Green);
    pinMode(PIN_STATUS_LED, OUTPUT);
  }
  bool buttonDown() override { return PIN_UNDO >= 0 && digitalRead(PIN_UNDO) == LOW; }
  static void IRAM_ATTR onButton(void* arg) {
    bool down = gpio_ll_get_level(&GPIO, PIN_UNDO) == 0;
    gpio_ll_set_intr_type(&GPIO, PIN_UNDO, down ? GPIO_INTR_HIGH_LEVEL : GPIO_INTR_LOW_LEVEL);
    Edge e{(uint32_t)(esp_timer_get_time() / 1000), down, true};
    xQueueSendFromISR(edges, &e, nullptr);
    static_cast<GoalHal*>(arg)->notifyFromIsr();
  }
  // Debug OLED on the LIS3DH's Wire (begun by motionInit). Initialised only when first shown in a wake:
  // the init turns the panel on, so doing it every wake would flash it at each motion wake.
#if OLED_HEIGHT == 32
  U8X8_SSD1306_128X32_UNIVISION_HW_I2C panel{U8X8_PIN_NONE};
#else
  U8X8_SSD1306_128X64_NONAME_HW_I2C panel{U8X8_PIN_NONE};
#endif
  static constexpr int TOP = (OLED_HEIGHT / 8 - 4) / 2;  // tile row of line 1: the 2 lines centred
  bool panel_begun = false, panel_on = false;
  // A frame is ~50 ms of I²C at 100 kHz: it's drawn by its own task, below the app's priority, so the app never
  // waits for it (plan C polls every 3 ms; twin plan C finding 1). oled() only hands over the latest view.
  // The bus goes in u8x8's <= 24-byte chunks, so a LIS3DH read waits <= ~3 ms behind one.
  struct Frame {
    bool on;
    app::StatusView v;
  };
  QueueHandle_t frames = nullptr;  // one slot, overwritten: the latest view wins
  volatile bool drawing = false;
  void oled(const app::StatusView* v) override {
    if (!OLED_ADDR || !frames) return;
    Frame f{v != nullptr, v ? *v : app::StatusView{}};
    xQueueOverwrite(frames, &f);
  }
  static void oledTask(void* arg) {
    GoalHal* self = static_cast<GoalHal*>(arg);
    Frame f;
    for (;;) {
      xQueuePeek(self->frames, &f, portMAX_DELAY);  // still queued until `drawing` is set: deepSleep can wait
      self->drawing = true;
      xQueueReceive(self->frames, &f, 0);
      self->draw(f.on ? &f.v : nullptr);
      self->drawing = false;
    }
  }
  void deepSleep(const app::SleepRequest& r) override {
    for (int i = 0; frames && i < 100 && (drawing || uxQueueMessagesWaiting(frames)); i++) delay(2);  // panel off first
    DeviceHal::deepSleep(r);
  }
  void draw(const app::StatusView* v) {
    if (!v && !panel_on) return;
    if (!v) return panel.setPowerSave(1), void(panel_on = false);  // 0xAE: off, and so through deep sleep
    if (!panel_begun) {
      panel.setI2CAddress(OLED_ADDR * 2);
      panel.setBusClock(I2C_CLOCK_HZ);
      panel.begin();  // on, cleared
      panel.setFlipMode(OLED_FLIP);
      panel.setFont(u8x8_font_8x13B_1x2_r);  // 8 x 16 cells: 2 lines x 16 (ux B5a)
      panel_begun = true;
    } else if (!panel_on) {
      panel.setPowerSave(0);
    }
    panel_on = true;
    for (int i = 0; i < 2; i++) {
      char l[17];
      snprintf(l, sizeof l, "%-16s", v->line[i]);  // padded: the inverse bar spans the line, old text goes
      panel.setInverseFont(v->inverse >> i & 1);
      panel.drawString(0, TOP + i * 2, l);
    }
  }
  void beamPower(bool on) override {
    powered = on;
    if (on) return pins(mode, true), digitalWrite(PIN_BEAM_POWER, HIGH);
    for (int p : {PIN_BEAM_POWER, PIN_BEAM_LED, PIN_BEAM_BOOST, PIN_BEAM_PU_B})  // no beam current in sleep
      if (p >= 0) pinMode(p, OUTPUT), digitalWrite(p, LOW);
  }
  // A mode's pins, with the LED at the mode's current or off.
  static void pins(beam::Mode m, bool led) {
    if (PIN_BEAM_LED >= 0) pinMode(PIN_BEAM_LED, OUTPUT), digitalWrite(PIN_BEAM_LED, led);
    drive(PIN_BEAM_BOOST, led && m != beam::Mode::A);
    drive(PIN_BEAM_PU_B, m == beam::Mode::B);
  }
  void beamMode(beam::Mode m, uint32_t settle_ms) override {
    mode = m;
    if (powered) masked([&] {
        pins(m, true);
        delayMicroseconds(settle_ms * 1000);
      });
  }
  bool beamCheck(uint32_t settle_ms, beam::Reading& r) override {
    if (PIN_BEAM_ADC < 0 || !powered) return false;
    masked([&] {
      pins(mode, false);  // LED off, the mode's pull-ups: ambient alone
      delayMicroseconds(settle_ms * 1000);
      r.amb_mv = nodeMv();
      if (mode != beam::Mode::B) {  // LED still off, both pull-ups: lit1's zero (B already has them)
        drive(PIN_BEAM_PU_B, true);
        delayMicroseconds(settle_ms * 1000);
      }
      r.amb20_mv = nodeMv();
      if (PIN_BEAM_BOOST >= 0) pinMode(PIN_BEAM_BOOST, INPUT);
      digitalWrite(PIN_BEAM_LED, HIGH);  // LED 1 mA, both pull-ups: the linear range
      delayMicroseconds(settle_ms * 1000);
      r.lit1_mv = nodeMv();
      pins(mode, true);
      delayMicroseconds(settle_ms * 1000);
    });
    return true;
  }
  int beamMv() override { return PIN_BEAM_ADC < 0 ? -1 : nodeMv(); }
  // Plan C (review 2): the node with the LED off, then at 1 mA, both pull-ups (linear range); the ISR is masked
  // for ~2 x BEAM_CHOP_SETTLE_US. One ADC read each: it runs every BEAM_CHOP_MS while it's on.
  int beamChop() override {
    if (PIN_BEAM_ADC < 0 || !powered) return -1;
    int off = 0, on = 0;
    masked([&] {
      pins(mode, false);
      drive(PIN_BEAM_PU_B, true);
      delayMicroseconds(BEAM_CHOP_SETTLE_US);
      off = analogReadMilliVolts(PIN_BEAM_ADC);
      if (PIN_BEAM_BOOST >= 0) pinMode(PIN_BEAM_BOOST, INPUT);
      digitalWrite(PIN_BEAM_LED, HIGH);
      delayMicroseconds(BEAM_CHOP_SETTLE_US);
      on = analogReadMilliVolts(PIN_BEAM_ADC);
      pins(mode, true);
    });
    return off > on ? off - on : 0;
  }
  static int nodeMv() {
    uint32_t sum = 0;
    for (int i = 0; i < 4; i++) sum += analogReadMilliVolts(PIN_BEAM_ADC);
    int mv = sum / 4;
    return mv >= BEAM_ADC_TOP_MV ? 3300 : mv;
  }
  // The beam ISR is off while pins change; a ball that came in meanwhile is queued as an edge timed at
  // the start, so even a 9 ms block still passes min_block_ms (5).
  template <class F>
  static void masked(F f) {
    gpio_intr_disable((gpio_num_t)PIN_BEAM_RX);
    uint32_t t0 = (uint32_t)(esp_timer_get_time() / 1000);
    f();
    bool blocked = gpio_get_level((gpio_num_t)PIN_BEAM_RX) == BEAM_BLOCKED_LEVEL;
    gpio_ll_set_intr_type(&GPIO, PIN_BEAM_RX, WAIT_FOR(!blocked));  // as onBeam: wait for the other level
    gpio_ll_clear_intr_status(&GPIO, 1u << PIN_BEAM_RX);
    if (blocked) {
      Edge e{t0, true, false};
      xQueueSend(edges, &e, 0);
    }
    gpio_intr_enable((gpio_num_t)PIN_BEAM_RX);
  }
  bool beamBlocked() override { return digitalRead(PIN_BEAM_RX) == BEAM_BLOCKED_LEVEL; }
  bool motionSeen() override { return dev::motionSeen(); }

  static void IRAM_ATTR onBeam(void* arg) {
    bool blocked = gpio_ll_get_level(&GPIO, PIN_BEAM_RX) == BEAM_BLOCKED_LEVEL;
    gpio_ll_set_intr_type(&GPIO, PIN_BEAM_RX, WAIT_FOR(!blocked));
    Edge e{(uint32_t)(esp_timer_get_time() / 1000), blocked};
    xQueueSendFromISR(edges, &e, nullptr);
    static_cast<GoalHal*>(arg)->notifyFromIsr();
  }
};

static GoalHal hal;
static app::GoalApp* goal;

void setup() {
  Serial.begin(115200);
  dev::pmInit(USE_LIGHT_SLEEP);
  vTaskPrioritySet(nullptr, 2);  // the app above the lanes (1) and the OLED's draw task (1)
  hal.begin();
  rtc.init(dev::buildId());
  app::GoalOptions o;
  o.fw = FW_VERSION;
  o.stay_associated = !WIFI_PER_GOAL;
  o.log_export_ms = LOG_EXPORT_MS;
  o.warn_mv = LOW_BATT_WARN_MV, o.cutoff_mv = LOW_BATT_CUTOFF_MV, o.resume_mv = LOW_BATT_RESUME_MV;
  o.motion_poll_ms = MOTION_POLL_MS, o.http_timeout_ms = HTTP_TIMEOUT_MS;
  o.retry_min_ms = RETRY_MIN_MS, o.retry_max_ms = RETRY_MAX_MS;
  o.beam_warmup_ms = BEAM_WARMUP_MS;
  o.led_beam = !USE_LIGHT_SLEEP;  // bench: the LED follows the beam
  o.undo_hold_ms = UNDO_HOLD_MS, o.button_stuck_ms = BUTTON_STUCK_MS;
  o.led_blink_ms = LED_BLINK_MS, o.led_gap_ms = LED_GAP_MS, o.led_period_ms = LED_PERIOD_AWAKE_MS;
  o.buzzer_max_mv = BUZZER_MAX_MV;
  o.chop_ms = BEAM_CHOP_MS, o.chop_after_checks = BEAM_CHOP_AFTER_CHECKS, o.chop_frac = BEAM_CHOP_FRAC;
  const int8_t vol[] = SOUND_VOLUME_DB;
  memcpy(o.volume_db, vol, sizeof o.volume_db);
  o.sound_octave = SOUND_OCTAVE_SHIFT;
  static app::GoalApp app(hal, rtc, o);
  goal = &app;
  goal->boot(hal.wakeCause());
}

void loop() {
  if (hal.ready) {
    Edge e;
    while (xQueueReceive(edges, &e, 0)) e.button ? goal->button(e.blocked, e.ms) : goal->beam(e.blocked, e.ms);
  }
  static std::string line;  // USB serial commands (GoalApp::command); only on USB, where the loop ticks each second
  while (Serial.available()) {
    char c = Serial.read();
    if (c != '\n' && c != '\r') {
      if (line.size() < 40) line += c;
    } else if (!line.empty()) {
      goal->command(line);
      line.clear();
    }
  }
  hal.deliver(*goal);
  hal.wait(goal->tick());  // the CPU light-sleeps meanwhile; edges and answers wake it
}
