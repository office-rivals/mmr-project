#include "event_queue.h"

#include <stdio.h>

static void slotKey(char* key, uint32_t seq) { snprintf(key, 8, "e%u", (unsigned)(seq % EventQueue::CAP)); }

void EventQueue::load(uint32_t fresh_epoch) {
  if (!kv_.getU32("epoch", epoch_)) {
    epoch_ = fresh_epoch;
    kv_.setU32("epoch", epoch_);  // if this write is lost, the next boot picks another: still unique
  }
  if (!kv_.getU32("drops", dropped_)) dropped_ = 0;
  if (!kv_.getU32("next", next_)) next_ = 0;
  if (!kv_.getU32("ack", acked_)) acked_ = 0;
  if (next_ - acked_ > CAP) acked_ = next_ - CAP;  // also catches ack > next (wraps huge)
}

bool EventQueue::push(uint32_t uptime_ms, int64_t epoch_ms, Event* out, uint32_t undoes) {
  if (size() >= CAP) {  // full: drop the oldest so the newest goal is kept
    if (!kv_.setU32("ack", acked_ + 1)) return false;
    acked_++;
    countDrop();
  }
  Event e{next_, uptime_ms, epoch_ms, undoes};
  char key[8];
  slotKey(key, e.seq);
  if (!kv_.setBlob(key, &e, sizeof e)) return false;
  if (!kv_.setU32("next", next_ + 1)) return false;
  next_++;
  if (out) *out = e;
  return true;
}

bool EventQueue::peek(Event& out) {
  char key[8];
  while (size() > 0) {
    slotKey(key, acked_);
    if (kv_.getBlob(key, &out, sizeof out) && out.seq == acked_) return true;
    acked_++;  // unreadable slot: skip it rather than wedge the queue
  }
  return false;
}

bool EventQueue::pop(uint32_t seq, bool dropped) {
  if (size() == 0 || seq != acked_) return false;
  if (!kv_.setU32("ack", acked_ + 1)) return false;
  acked_++;
  if (dropped) countDrop();
  return true;
}

void EventQueue::countDrop() {
  if (kv_.setU32("drops", dropped_ + 1)) dropped_++;
}
