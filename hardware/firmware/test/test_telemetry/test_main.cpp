// Telemetry (INTERFACES §10): log ring, heartbeat schedule, status + OTLP payloads.
#include <string.h>
#include <unity.h>

#include <ArduinoJson.h>

#include "api.h"
#include "detector.h"
#include "otlp.h"
#include "telemetry.h"

void setUp() {}
void tearDown() {}

static tel::LogRing ring;  // static: zeroed like RTC memory after a cold boot... or not (see init test)

void test_ring_drops_oldest_and_counts() {
  ring.init(1);
  for (int i = 0; i < tel::LogRing::CAP + 2; i++) ring.add(tel::Level::Info, "t", "m", {{"i", i}}, 1, i, 0);
  TEST_ASSERT_EQUAL_UINT32(tel::LogRing::CAP, ring.pending());
  TEST_ASSERT_EQUAL_UINT32(2, ring.dropped);
  tel::LogEntry e[4];
  TEST_ASSERT_EQUAL_INT(4, ring.peek(e, 4));
  TEST_ASSERT_EQUAL_UINT32(2, e[0].seq);  // the two oldest went
  TEST_ASSERT_EQUAL_INT32(2, e[0].kv[0].v);
  ring.ack(e[3].seq);  // server has the first four
  TEST_ASSERT_EQUAL_UINT32(tel::LogRing::CAP - 4, ring.pending());
  ring.ack(e[0].seq);  // a stale ack can't resurrect or skip anything
  TEST_ASSERT_EQUAL_UINT32(tel::LogRing::CAP - 4, ring.pending());
  ring.ack(1000);      // an ack beyond what exists is ignored
  TEST_ASSERT_EQUAL_UINT32(tel::LogRing::CAP - 4, ring.pending());
}

void test_ring_survives_sleep_but_not_new_build_or_garbage() {
  ring.init(1);
  ring.add(tel::Level::Warn, "beam", "stuck", {}, 2, 5, 0);
  uint32_t p = ring.pending();
  ring.init(1);  // deep-sleep wake, same firmware: kept
  TEST_ASSERT_EQUAL_UINT32(p, ring.pending());
  ring.init(2);  // reflashed: the old records may not fit this build, start clean
  TEST_ASSERT_EQUAL_UINT32(0, ring.pending());
  memset(&ring, 0xA5, sizeof ring);  // power-on garbage in RTC RAM
  ring.init(2);
  TEST_ASSERT_EQUAL_UINT32(0, ring.pending());
  TEST_ASSERT_EQUAL_UINT32(0, ring.dropped);
}

void test_ring_truncates_and_caps_kv() {
  ring.init(3);
  ring.add(tel::Level::Error, "a-very-long-tag", "a message far longer than the forty bytes a record holds",
           {{"one", 1}, {"two", 2}, {"three", 3}, {"four", 4}}, 1, 0, 0);
  tel::LogEntry e;
  ring.peek(&e, 1);
  TEST_ASSERT_EQUAL_STRING("a-very-", e.tag);
  TEST_ASSERT_EQUAL_UINT(39, strlen(e.msg));
  TEST_ASSERT_EQUAL_UINT8(3, e.nkv);
}

void test_heartbeat_schedule() {
  TEST_ASSERT_EQUAL_UINT32(1000 + 86400, tel::nextHeartbeat(1000, true, 7));
  TEST_ASSERT_EQUAL_UINT32(1000 + 3600, tel::nextHeartbeat(1000, false, 0));  // AP down: 1 h, 2 h, 4 h ...
  TEST_ASSERT_EQUAL_UINT32(1000 + 14400, tel::nextHeartbeat(1000, false, 2));
  TEST_ASSERT_EQUAL_UINT32(1000 + 86400, tel::nextHeartbeat(1000, false, 5));  // ... capped at 24 h
  TEST_ASSERT_EQUAL_UINT32(1000 + 86400, tel::nextHeartbeat(1000, false, 40));
  TEST_ASSERT_TRUE(tel::heartbeatDue(86370, 86400));   // RTC drift: within a minute counts
  TEST_ASSERT_FALSE(tel::heartbeatDue(80000, 86400));
  TEST_ASSERT_EQUAL_UINT32(6400, tel::sleepTimerS(80000, 86400, false));
  TEST_ASSERT_EQUAL_UINT32(60, tel::sleepTimerS(80000, 86400, true));  // stuck motion pin: look again soon
  TEST_ASSERT_EQUAL_UINT32(1, tel::sleepTimerS(90000, 86400, false));  // overdue: wake right away
}

void test_detector_counts_rejected_blocks() {
  Detector d;
  d.update(true, 100);
  d.update(false, 103);  // glitch
  d.update(false, 110);  // duplicate sample: not counted twice
  d.update(true, 200);
  d.update(true, 210);   // goal
  d.update(false, 260);
  TEST_ASSERT_EQUAL_UINT32(1, d.rejected);
}

void test_vbat_scale_config() {
  api::Config c;
  TEST_ASSERT_TRUE(api::parseConfig(R"({"vbat_scale":1.03})", c));
  TEST_ASSERT_FLOAT_WITHIN(0.0001, 1.03, c.vbat_scale);
  TEST_ASSERT_TRUE(api::parseConfig(R"({"vbat_scale":2.5})", c));  // out of range: ignored
  TEST_ASSERT_FLOAT_WITHIN(0.0001, 1.03, c.vbat_scale);
}

static otlp::Resource res() { return {"0.1.0", "fb-a0b1c2d3e4f5", "table-1", "home"}; }

void test_status_json_v2() {
  api::Status st;
  st.device_id = "fb-a0b1c2d3e4f5", st.reason = "heartbeat", st.fw = "0.1.0";
  st.uptime_ms = 4200, st.battery_mv = 3870, st.reset_reason = "deepsleep", st.wake_count = 37, st.goals = 412;
  st.short_blocks = 3, st.wifi_connect_ms = 640, st.rssi = -61, st.wifi_retries = 1;
  st.free_heap = 182000, st.min_free_heap = 151000;
  TEST_ASSERT_EQUAL_STRING(
      R"({"device_id":"fb-a0b1c2d3e4f5","role":"goal","reason":"heartbeat","battery_mv":3870,"firmware_ve)"
      R"(rsion":"0.1.0","uptime_ms":4200,"queued_events":0,"dropped_events":0,"beam_blocked":false,"low_b)"
      R"(att":false,"metrics":{"reset_reason":"deepsleep","config_role":null,"wake_count":37,"goals":412,)"
      R"("short_blocks":3,"stuck_events":0,"wifi_connect_ms":640,"rssi":-61,"wifi_retries":1,"free_heap":)"
      R"(182000,"min_free_heap":151000,"log_dropped":0}})",
      api::statusJson(st).c_str());
}

// Goal counter, beam health worse mid-session (reason "beam"): the beam object (openapi DeviceStatus.beam).
void test_status_json_beam() {
  api::Status st;
  st.device_id = "fb-a0b1c2d3e4f5", st.reason = "beam", st.fw = "0.1.0";
  st.uptime_ms = 61000, st.battery_mv = 3870, st.reset_reason = "deepsleep", st.wake_count = 37, st.goals = 412;
  st.has_beam = true;
  st.beam.health = "ambient_high", st.beam.mode = "a";
  st.beam.amb_ua = 2.5f, st.beam.lit1_ua = 64.25f, st.beam.margin = 5.75f, st.beam.base_amb_ua = 0.75f;
  st.beam.base_lit1_ua = 60, st.beam.checked_s = 0;
  TEST_ASSERT_EQUAL_STRING(
      R"({"device_id":"fb-a0b1c2d3e4f5","role":"goal","reason":"beam","battery_mv":3870,"firmware_version")"
      R"(:"0.1.0","uptime_ms":61000,"queued_events":0,"dropped_events":0,"beam_blocked":false,"beam":{"he)"
      R"(alth":"ambient_high","mode":"a","amb_ua":2.5,"lit1_ua":64.25,"margin":5.75,"ball_ua":null,"basel)"
      R"(ine_amb_ua":0.75,"baseline_lit1_ua":60,"checked_s":0},"low_batt":false,"metrics":{"reset_reason":)"
      R"("deepsleep","config_role":null,"wake_count":37,"goals":412,"short_blocks":0,"stuck_events":0,"wif)"
      R"(i_connect_ms":null,"rssi":null,"wifi_retries":0,"free_heap":0,"min_free_heap":0,"log_dropped":0}})",
      api::statusJson(st).c_str());
}

void test_otlp_logs_json() {
  ring.init(7);
  ring.add(tel::Level::Info, "wifi", "connected", {{"ms", 640}, {"rssi", -61}}, 37, 1200, 1792006923512LL);
  ring.add(tel::Level::Warn, "beam", "stuck", {}, 37, 9000, 0);  // before NTP: time unknown
  tel::LogEntry e[2];
  int n = ring.peek(e, 2);
  TEST_ASSERT_EQUAL_STRING(
      R"({"resourceLogs":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"foosba)"
      R"(ll-goal-counter"}},{"key":"service.version","value":{"stringValue":"0.1.0"}},{"key":"service.ins)"
      R"(tance.id","value":{"stringValue":"fb-a0b1c2d3e4f5"}},{"key":"device.id","value":{"stringValue":")"
      R"(fb-a0b1c2d3e4f5"}},{"key":"foosball.role","value":{"stringValue":"goal"}},{"key":"foosball.table)"
      R"(_id","value":{"stringValue":"table-1"}},{"key":"foosball.goal","value":{"stringValue":"home"}}]})"
      R"(,"scopeLogs":[{"scope":{"name":"foosball.firmware","version":"0.1.0","attributes":[{"key":"foosb)"
      R"(all.log.dropped_total","value":{"intValue":"3"}}]},"logRecords":[{"timeUnixNano":"17920069235120)"
      R"(00000","observedTimeUnixNano":"1792006930000000000","severityNumber":9,"severityText":"INFO","bo)"
      R"(dy":{"stringValue":"connected"},"attributes":[{"key":"foosball.tag","value":{"stringValue":"wifi)"
      R"("}},{"key":"foosball.log.seq","value":{"intValue":"0"}},{"key":"foosball.wake","value":{"intValu)"
      R"(e":"37"}},{"key":"foosball.uptime_ms","value":{"intValue":"1200"}},{"key":"ms","value":{"intValu)"
      R"(e":"640"}},{"key":"rssi","value":{"intValue":"-61"}}]},{"timeUnixNano":"0","observedTimeUnixNano)"
      R"(":"1792006930000000000","severityNumber":13,"severityText":"WARN","body":{"stringValue":"stuck"})"
      R"(,"attributes":[{"key":"foosball.tag","value":{"stringValue":"beam"}},{"key":"foosball.log.seq",")"
      R"(value":{"intValue":"1"}},{"key":"foosball.wake","value":{"intValue":"37"}},{"key":"foosball.upti)"
      R"(me_ms","value":{"intValue":"9000"}}]}]}]}]})",
      otlp::logsJson(res(), e, n, 3, 1792006930000LL).c_str());
}

void test_otlp_metrics_json() {
  otlp::Metrics m;
  m.battery_mv = 3870, m.reset_reason = "deepsleep", m.uptime_ms = 4200, m.free_heap = 182000;
  m.min_free_heap = 151000, m.rssi = -61, m.wifi_connect_ms = 640, m.wakes = 37, m.goals = 412;
  m.rejected_blocks = 3, m.wifi_retries = 1;
  std::string s = otlp::metricsJson(res(), m, 1792006930000LL, 1791900000000LL);
  TEST_ASSERT_EQUAL_STRING(
      R"({"resourceMetrics":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"foo)"
      R"(sball-goal-counter"}},{"key":"service.version","value":{"stringValue":"0.1.0"}},{"key":"service.)"
      R"(instance.id","value":{"stringValue":"fb-a0b1c2d3e4f5"}},{"key":"device.id","value":{"stringValue)"
      R"(":"fb-a0b1c2d3e4f5"}},{"key":"foosball.role","value":{"stringValue":"goal"}},{"key":"foosball.ta)"
      R"(ble_id","value":{"stringValue":"table-1"}},{"key":"foosball.goal","value":{"stringValue":"home"})"
      R"(}]},"scopeMetrics":[{"scope":{"name":"foosball.firmware","version":"0.1.0"},"metrics":[{"name":")"
      R"(foosball.battery.voltage","unit":"V","gauge":{"dataPoints":[{"timeUnixNano":"1792006930000000000)"
      R"(","asDouble":3.87}]}},{"name":"foosball.battery.low","unit":"1","gauge":{"dataPoints":[{"timeUni)"
      R"(xNano":"1792006930000000000","asInt":"0"}]}},{"name":"foosball.uptime","unit":"ms","gauge":{"dat)"
      R"(aPoints":[{"timeUnixNano":"1792006930000000000","asInt":"4200"}]}},{"name":"foosball.reset","uni)"
      R"(t":"1","gauge":{"dataPoints":[{"timeUnixNano":"1792006930000000000","asInt":"1","attributes":[{")"
      R"(key":"foosball.reset.reason","value":{"stringValue":"deepsleep"}}]}]}},{"name":"foosball.wifi.rs)"
      R"(si","unit":"dBm","gauge":{"dataPoints":[{"timeUnixNano":"1792006930000000000","asInt":"-61"}]}},)"
      R"({"name":"foosball.wifi.connect_time","unit":"ms","gauge":{"dataPoints":[{"timeUnixNano":"1792006)"
      R"(930000000000","asInt":"640"}]}},{"name":"foosball.queue.depth","unit":"{event}","gauge":{"dataPo)"
      R"(ints":[{"timeUnixNano":"1792006930000000000","asInt":"0"}]}},{"name":"foosball.beam.blocked","un)"
      R"(it":"1","gauge":{"dataPoints":[{"timeUnixNano":"1792006930000000000","asInt":"0"}]}},{"name":"fo)"
      R"(osball.heap.free","unit":"By","gauge":{"dataPoints":[{"timeUnixNano":"1792006930000000000","asIn)"
      R"(t":"182000"}]}},{"name":"foosball.heap.min_free","unit":"By","gauge":{"dataPoints":[{"timeUnixNa)"
      R"(no":"1792006930000000000","asInt":"151000"}]}},{"name":"foosball.wakes","unit":"{wake}","sum":{")"
      R"(aggregationTemporality":2,"isMonotonic":true,"dataPoints":[{"startTimeUnixNano":"179190000000000)"
      R"(0000","timeUnixNano":"1792006930000000000","asInt":"37"}]}},{"name":"foosball.goals","unit":"{go)"
      R"(al}","sum":{"aggregationTemporality":2,"isMonotonic":true,"dataPoints":[{"startTimeUnixNano":"17)"
      R"(91900000000000000","timeUnixNano":"1792006930000000000","asInt":"412"}]}},{"name":"foosball.beam)"
      R"(.rejected_blocks","unit":"{block}","sum":{"aggregationTemporality":2,"isMonotonic":true,"dataPoi)"
      R"(nts":[{"startTimeUnixNano":"1791900000000000000","timeUnixNano":"1792006930000000000","asInt":"3)"
      R"("}]}},{"name":"foosball.beam.stuck_events","unit":"{event}","sum":{"aggregationTemporality":2,"i)"
      R"(sMonotonic":true,"dataPoints":[{"startTimeUnixNano":"1791900000000000000","timeUnixNano":"179200)"
      R"(6930000000000","asInt":"0"}]}},{"name":"foosball.wifi.retries","unit":"{retry}","sum":{"aggregat)"
      R"(ionTemporality":2,"isMonotonic":true,"dataPoints":[{"startTimeUnixNano":"1791900000000000000","t)"
      R"(imeUnixNano":"1792006930000000000","asInt":"1"}]}},{"name":"foosball.queue.dropped","unit":"{eve)"
      R"(nt}","sum":{"aggregationTemporality":2,"isMonotonic":true,"dataPoints":[{"startTimeUnixNano":"17)"
      R"(91900000000000000","timeUnixNano":"1792006930000000000","asInt":"0"}]}},{"name":"foosball.log.dr)"
      R"(opped","unit":"{record}","sum":{"aggregationTemporality":2,"isMonotonic":true,"dataPoints":[{"st)"
      R"(artTimeUnixNano":"1791900000000000000","timeUnixNano":"1792006930000000000","asInt":"0"}]}}]}]}])"
      R"(})",
      s.c_str());
  // the parts a collector cares about, spelled out
  JsonDocument d;
  deserializeJson(d, s);
  JsonArray ms = d["resourceMetrics"][0]["scopeMetrics"][0]["metrics"];
  JsonObject v = ms[0];
  TEST_ASSERT_EQUAL_STRING("foosball.battery.voltage", v["name"]);
  TEST_ASSERT_EQUAL_STRING("V", v["unit"]);
  TEST_ASSERT_FLOAT_WITHIN(0.0001, 3.87, v["gauge"]["dataPoints"][0]["asDouble"].as<float>());
  for (JsonObject x : ms)
    if (x["name"] == "foosball.goals") {
      TEST_ASSERT_EQUAL_INT(2, x["sum"]["aggregationTemporality"]);  // CUMULATIVE since power-on
      TEST_ASSERT_TRUE(x["sum"]["isMonotonic"]);
      TEST_ASSERT_EQUAL_STRING("412", x["sum"]["dataPoints"][0]["asInt"]);  // int64 as a string
      TEST_ASSERT_EQUAL_STRING("1791900000000000000", x["sum"]["dataPoints"][0]["startTimeUnixNano"]);
    }
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_status_json_beam);
  RUN_TEST(test_ring_drops_oldest_and_counts);
  RUN_TEST(test_ring_survives_sleep_but_not_new_build_or_garbage);
  RUN_TEST(test_ring_truncates_and_caps_kv);
  RUN_TEST(test_heartbeat_schedule);
  RUN_TEST(test_detector_counts_rejected_blocks);
  RUN_TEST(test_vbat_scale_config);
  RUN_TEST(test_status_json_v2);
  RUN_TEST(test_otlp_logs_json);
  RUN_TEST(test_otlp_metrics_json);
  return UNITY_END();
}
