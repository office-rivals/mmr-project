// The status LED while the main core is in deep sleep (ux/status-led-2026-10-18.md §2), on the C6's LP core.
// Built by tools/lp_build.py into lp_blink.h; src/goal/device.cpp loads it, sets `blinks` and starts it.
// Each run sets the LED for one edge and re-arms the LP timer for the next; GPIO5 HIGH = green, LOW = red,
// Hi-Z = off (electronics: red + green in series).
#include <stdint.h>

#include "ulp_lp_core_gpio.h"
#include "ulp_lp_core_lp_timer_shared.h"
#include "ulp_lp_core_memory_shared.h"

#define LED LP_IO_NUM_5

volatile uint32_t blinks = 0;  // per group: 1 = green, 2-3 = red; 0 = dark, halt (set by the main core)
volatile uint32_t blink_ms = 30, gap_ms = 150, period_ms = 5000;
static uint32_t step;  // even: the next blink starts, odd: it ends

int main(void) {
  uint32_t n = blinks, next_ms = 0;
  if (n && step % 2 == 0) {
    ulp_lp_core_gpio_set_level(LED, n == 1);
    ulp_lp_core_gpio_output_enable(LED);
    next_ms = blink_ms;
  } else {
    ulp_lp_core_gpio_output_disable(LED);
    if (n) next_ms = step / 2 + 1 < n ? gap_ms - blink_ms : period_ms - (n - 1) * gap_ms - blink_ms;
  }
  if (n) step = (step + 1) % (2 * n);
  ulp_lp_core_memory_shared_cfg_get()->sleep_duration_ticks =
      next_ms ? ulp_lp_core_lp_timer_calculate_sleep_ticks(next_ms * 1000ULL) : 0;  // 0: no re-arm, stays halted
  return 0;
}
