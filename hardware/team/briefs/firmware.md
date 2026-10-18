# Brief: firmware

You are `firmware`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md`, `team/INTERFACES.md`.

## Goal
ESP32 firmware for one goal device, per INTERFACES §1 (states), §2 (pins — from electronics),
§3 (power budget) and §6 (REST contract).

## Deliverables (in `firmware/`)
1. A PlatformIO project (Arduino or ESP-IDF — your call; prefer what makes deep sleep, ULP/LP-core
   or GPIO wake, and low-power Wi-Fi straightforward). Builds with `uvx platformio run` (or document
   the exact command). Board target follows electronics' MCU choice — start with a sensible default
   and switch when electronics confirms.
2. Features:
   - SLEEP/ACTIVE state machine with motion wake and `idle_timeout_s`.
   - Goal detection with `min_block_ms` + `lockout_ms` (config-tunable), interrupt or tight sampling;
     never miss a goal while Wi-Fi is busy (detection must not block on networking).
   - Wi-Fi STA only; obey the radio rule in INTERFACES §1 (no AP, ESP-NOW, BLE, mDNS).
   - Config pull (cached in NVS), goal-event POST with persisted queue + retry/backoff, status POST
     before sleep, NTP time for `occurred_at`, monotonic persisted `seq`.
   - All endpoint paths/payloads in one place for when the real server is designed.
   - Secrets (SSID, password, base URL, token) from a **gitignored** file with a checked-in `.example`.
   - Power-loss safety per INTERFACES §7 (power can vanish any instant; prove it with a test where you can).
   - Serial log for bench debugging; optional status LED.
3. Host-side tests for the pure logic (debounce/lockout state machine, event queue, payload JSON) —
   e.g. PlatformIO `native` env with Unity. Keep them small.
4. A tiny mock REST server (e.g. one Python file) so the device can be tested end to end on a LAN.
5. `README.md`: build, flash, configure secrets, test, and the power strategy you chose with numbers.

## Working with others
- Get the pin map and sensor behaviour from `electronics`; push back with numbers if a hardware
  choice makes the power budget impossible.
- Interface changes → message lead (lead edits INTERFACES.md).
- Report progress and completion to `lead`. Questions for the user → lead.
