#pragma once
// Real HTTP for every virtual device (libcurl multi, one thread). Requests are async: the
// completion runs from poll(). Each device has its own keep-alive connection pool.
#include <stdint.h>

#include <functional>
#include <map>
#include <string>
#include <vector>

typedef void CURLM;
typedef void CURL;

namespace net {

struct Request {
  std::string method, url, body;
  std::vector<std::string> headers;  // "Name: value"
  uint32_t timeout_ms = 5000;
};
// code <= 0: network error / timeout (what the firmware sees as a failed request).
using Done = std::function<void(int code, const std::string& body)>;

class Http {
 public:
  Http();
  ~Http();
  uint64_t send(const Request& r, Done done);
  // Power pull: the device never sees the answer. The request still finishes (it may already
  // have reached the server, which is the point of the dedupe scenarios).
  void forget(uint64_t id);
  bool idle() const { return xfers_.empty(); }
  void poll(int max_wait_ms);

 private:
  struct Xfer {
    uint64_t id;
    CURL* h;
    void* hdrs;
    std::string body_out, body_in;
    Done done;
  };
  CURLM* m_;
  std::map<CURL*, Xfer*> xfers_;
  uint64_t next_ = 1;
};

}  // namespace net
