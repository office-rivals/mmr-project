#include "http.h"

#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>

static const bool DEBUG = getenv("TWIN_HTTP_DEBUG");

namespace net {

static size_t onData(char* p, size_t sz, size_t n, void* ud) {
  static_cast<std::string*>(ud)->append(p, sz * n);
  return sz * n;
}

Http::Http() {
  curl_global_init(CURL_GLOBAL_DEFAULT);
  m_ = curl_multi_init();
}

Http::~Http() {
  for (auto& [h, x] : xfers_) {
    curl_multi_remove_handle(m_, h);
    curl_easy_cleanup(h);
    curl_slist_free_all((curl_slist*)x->hdrs);
    delete x;
  }
  curl_multi_cleanup(m_);
}

uint64_t Http::send(const Request& r, Done done) {
  auto* x = new Xfer{next_++, curl_easy_init(), nullptr, r.body, "", std::move(done)};
  curl_slist* hl = nullptr;
  for (auto& h : r.headers) hl = curl_slist_append(hl, h.c_str());
  if (!r.body.empty() || r.method == "POST") hl = curl_slist_append(hl, "Content-Type: application/json");
  x->hdrs = hl;
  CURL* h = x->h;
  curl_easy_setopt(h, CURLOPT_URL, r.url.c_str());
  curl_easy_setopt(h, CURLOPT_CUSTOMREQUEST, r.method.c_str());
  if (r.method == "POST") {
    curl_easy_setopt(h, CURLOPT_POSTFIELDS, x->body_out.c_str());
    curl_easy_setopt(h, CURLOPT_POSTFIELDSIZE, (long)x->body_out.size());
  }
  curl_easy_setopt(h, CURLOPT_HTTPHEADER, hl);
  curl_easy_setopt(h, CURLOPT_TIMEOUT_MS, (long)r.timeout_ms);
  curl_easy_setopt(h, CURLOPT_WRITEFUNCTION, onData);
  curl_easy_setopt(h, CURLOPT_WRITEDATA, &x->body_in);
  curl_easy_setopt(h, CURLOPT_NOSIGNAL, 1L);
  if (DEBUG) fprintf(stderr, "http> #%llu %s %s\n", (unsigned long long)x->id, r.method.c_str(), r.url.c_str());
  curl_multi_add_handle(m_, h);
  xfers_[h] = x;
  return x->id;
}

void Http::forget(uint64_t id) {
  for (auto& [h, x] : xfers_)
    if (x->id == id) x->done = nullptr;
}

void Http::poll(int max_wait_ms) {
  int running;
  curl_multi_perform(m_, &running);
  if (max_wait_ms > 0) {
    curl_multi_poll(m_, nullptr, 0, max_wait_ms, nullptr);
    curl_multi_perform(m_, &running);
  }
  int left;
  while (CURLMsg* msg = curl_multi_info_read(m_, &left)) {
    if (msg->msg != CURLMSG_DONE) continue;
    CURL* h = msg->easy_handle;
    Xfer* x = xfers_[h];
    long code = -1;
    if (msg->data.result == CURLE_OK) curl_easy_getinfo(h, CURLINFO_RESPONSE_CODE, &code);
    if (DEBUG) fprintf(stderr, "http< #%llu %ld (curl %d)\n", (unsigned long long)x->id, code, (int)msg->data.result);
    curl_multi_remove_handle(m_, h);
    curl_easy_cleanup(h);
    curl_slist_free_all((curl_slist*)x->hdrs);
    xfers_.erase(h);
    if (x->done) x->done((int)code, x->body_in);  // may send() again: we're done with x
    delete x;
  }
}

}  // namespace net
