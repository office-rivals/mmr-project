// `twin selftest`: checks the sim layer itself (clock, power-pull NVS, HTTP).
#include <stdio.h>

#include <string>

#include "event_queue.h"
#include "http.h"
#include "sim.h"
#include "sim_kv.h"

int selftest(const char* url) {
  int fails = 0;
#define CHECK(c) (c) ? (void)0 : (void)(fprintf(stderr, "FAIL %s:%d %s\n", __FILE__, __LINE__, #c), fails++)
  // clock: ordered, FIFO on ties
  sim::Clock clk;
  std::string order;
  clk.at(20, [&] { order += 'b'; });
  clk.at(10, [&] { order += 'a'; });
  clk.at(20, [&] { order += 'c'; });
  while (clk.step(1000)) {}
  CHECK(order == "abc");
  // power pull on a queue write: earlier events survive, seq is never reused
  sim::NvsKv kv;
  {
    EventQueue q(kv);
    q.load(7);
    q.push(1, 0);
    bool pulled = false;
    kv.on_pull = [&] { pulled = true; };
    kv.pullAfter(1);  // slot lands, "next" doesn't
    CHECK(!q.push(2, 0) && pulled);
  }
  kv.dead = false;  // power back
  EventQueue q2(kv);
  q2.load(9);
  CHECK(q2.epoch() == 7 && q2.size() == 1 && q2.nextSeq() == 1);
  if (url) {
    net::Http http;
    int got = 0;
    http.send({"GET", url}, [&](int code, const std::string&) { got = code; });
    while (!http.idle()) http.poll(50);
    printf("GET %s -> %d\n", url, got);
    CHECK(got != 0);
  }
  puts(fails ? "selftest FAILED" : "selftest ok");
  return fails ? 1 : 0;
}
