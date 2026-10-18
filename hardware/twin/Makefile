# Digital twin: firmware lib/core on the host + simulated hardware + real HTTP (libcurl).
#   make            build ./build/twin (first run downloads ArduinoJson into build/deps)
#   make test       build + run every scenario against firmware's mock server (run-ci.sh)
FW      := ../firmware
CORE    := $(FW)/lib/core
AJSON   := build/deps/ArduinoJson-7.4.2
CXX     ?= c++
CXXFLAGS ?= -std=c++20 -O1 -g -Wall -Wno-unused-function
SRCS    := $(wildcard src/*.cpp) $(wildcard $(CORE)/*.cpp)
# Same version as firmware/platformio.ini; ArduinoJson on std::string like the native tests
AJSON_OFF := -DARDUINOJSON_ENABLE_ARDUINO_STRING=0 -DARDUINOJSON_ENABLE_ARDUINO_STREAM=0 \
             -DARDUINOJSON_ENABLE_ARDUINO_PRINT=0 -DARDUINOJSON_ENABLE_PROGMEM=0

build/twin: $(SRCS) $(AJSON)/src/ArduinoJson.h $(wildcard src/*.h) $(wildcard $(CORE)/*.h)
	$(CXX) $(CXXFLAGS) $(AJSON_OFF) -Isrc -I$(CORE) -I$(AJSON)/src $(SRCS) -lcurl -o $@

$(AJSON)/src/ArduinoJson.h:
	mkdir -p build/deps && curl -fsSL https://github.com/bblanchon/ArduinoJson/archive/refs/tags/v7.4.2.tar.gz | tar xz -C build/deps

test: build/twin
	./run-ci.sh

clean:
	rm -rf build/twin

.PHONY: test clean
