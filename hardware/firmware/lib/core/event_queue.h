#pragma once
#include <stddef.h>
#include <stdint.h>

#include <string>

// Minimal key/value store. On the device this is NVS, where each single write is
// atomic across power loss (old value survives until the new one is committed).
// A write returning false means "it may or may not have happened".
struct Kv {
  virtual bool getU32(const char* key, uint32_t& out) = 0;
  virtual bool setU32(const char* key, uint32_t v) = 0;
  virtual bool getBlob(const char* key, void* buf, size_t len) = 0;
  virtual bool setBlob(const char* key, const void* buf, size_t len) = 0;
  virtual bool getStr(const char* key, std::string& out) { return false; }
  virtual bool setStr(const char* key, const std::string& v) { return false; }
  virtual void remove(const char* key) {}
  virtual ~Kv() = default;
};

struct Event {
  uint32_t seq;
  uint32_t uptime_ms;
  int64_t epoch_ms;  // 0 = clock not synced when the goal happened
  uint32_t undoes;   // 0 = a goal; else an undo (button) of this device's goal seq undoes - 1
};

// Persistent FIFO of goal events (and the button's undos, in order behind their goals). Pending = seqs in [acked, next).
// Each event lives in slot "e<seq % CAP>" and carries its seq, so a slot is only
// trusted when its seq matches. Write order makes every crash point safe:
//   push: (drop oldest if full: write "ack") -> write slot -> write "next"
//   pop:  write "ack" (then the "drops" counter, best effort, when dropping)
// A seq becomes visible to the sender only after "next" is written, so a sent
// seq is always persisted and never reused. Crash before "next" loses only the
// in-flight goal; crash before "ack" means a resend the server dedupes.
class EventQueue {
 public:
  static constexpr uint32_t CAP = 128;  // ~3 h of goals offline before dropping oldest

  explicit EventQueue(Kv& kv) : kv_(kv) {}
  // fresh_epoch: random value, stored only if NVS has none yet (first boot / wiped)
  void load(uint32_t fresh_epoch);
  bool push(uint32_t uptime_ms, int64_t epoch_ms, Event* out = nullptr, uint32_t undoes = 0);
  bool peek(Event& out);  // oldest pending; skips unreadable slots
  bool pop(uint32_t seq, bool dropped = false);  // ack seq if it is the oldest
  uint32_t size() const { return next_ - acked_; }
  uint32_t nextSeq() const { return next_; }
  uint32_t epoch() const { return epoch_; }      // goes into event_id with seq
  uint32_t dropped() const { return dropped_; }  // lifetime count: overflow + rejected

 private:
  Kv& kv_;
  uint32_t next_ = 0;
  uint32_t acked_ = 0;
  uint32_t epoch_ = 0;
  uint32_t dropped_ = 0;
  void countDrop();
};
