# Status LED: firmware part (2026-10-18)

This is for ux's proposal `ux/status-led-2026-10-18.md` §4. **BUILT 2026-10-18** (lead DECIDE: green + red, user), host-checked, not on hardware; as built: README *Status LEDs*.
Numbers marked EST are unmeasured (rule 11). The LED currents are electronics' to set; below, I_led = 1 mA while lit.

## 1. Blinking in deep sleep: three ways

| Way | How | Extra current asleep (1 blink every 5 s) | Effort / risk |
|---|---|---|---|
| **A. LP core** (recommended) | The C6's LP RISC-V core keeps running while the main core is in deep sleep. The LP timer wakes it at each blink edge (on, then 30 ms later off). It drives GPIO5 through LP IO and halts again. The main core writes the blink count into LP memory before it sleeps | LP core ≈ 1 µA EST (2 wakes per group of ≪ 1 ms each), plus the LED | ~1–2 days EST. Build risk: the Arduino build needs `CONFIG_ULP_COPROC_ENABLED` / `ULP_COPROC_TYPE_LP_CORE` in `custom_sdkconfig` (we already rebuild the IDF libs). The LP program is compiled separately and embedded as a blob (`ulp_lp_core_load_binary`). **A half-day spike first**: does it link in pioarduino? |
| B. LP-timer wakes of the main core | Each blink edge is a wake from deep sleep: either a full boot (~50–100 ms × ~25 mA EST) or a deep-sleep wake stub (~1–2 ms × ~15 mA EST, twice per blink) | Full boot: ≈ 300–500 µA → **7–12 mAh/day**, which doubles the budget: no. Wake stub: ≈ 10 µA + the LED | Wake stub: ~1 day, fragile (it re-arms the timer with register writes, beside the motion, button and VBUS wakes) |
| C. Only while awake | `GoalApp` blinks it like any other deadline, in light sleep. Dark in deep sleep | 0 | ½ day. But dark means "asleep **or** dead", and that is the question the user asked. It doesn't meet the ask |

**Recommendation: A**, if the spike links. If it doesn't, C now plus electronics' view on a hardware blinker. B is a fallback only.

## 2. µA and mAh/day (I_led 1 mA, 30 ms per blink)

| | 1 blink (OK) | 3 blinks (battery low) |
|---|---|---|
| Asleep, every 5 s: LED | 6 µA → 0.12 mAh/day (20 h) | 18 µA → 0.36 mAh/day |
| Asleep: LP core (A) | ≈ 1 µA EST → 0.02 mAh/day | the same |
| Awake, every 2 s: LED (+ a light-sleep wake per group, ≈ 2 µA EST) | 17 µA → 0.08 mAh/day (4.7 h) | 47 µA → 0.22 mAh/day |
| **Total** | **≈ 0.2 mAh/day** of ~12 (≈ +2 %) | ≈ 0.6 mAh/day, only while low |

The deep-sleep floor rises from ~15 to ~22 µA. That is visible on the PPK2, but it is small next to ACTIVE.
The cost scales linearly with I_led and with the period (5 s → 10 s halves the asleep part).

## 3. One health state for the LED and the display

- **One function in `GoalApp`.** It computes the faults once: no table, Wi-Fi off, server error, beam
  blocked/dead/ambient/low, battery low, queue > 5.
  - The display's verdict line (B5a order) uses it.
  - The LED maps it to a count: battery low → **3** (it wins, as ux says); any other fault → **2**; none → **1**.
  - So the two never disagree about *whether* something is wrong; the display says *what*.
- **Asleep, the count freezes** at the last wake's value. The main core writes it to LP memory just before deep
  sleep, after the final status.
  - So "2 every 5 s" means "the last session ended with a fault" (e.g. Wi-Fi failed at the report).
  - The next wake re-measures.
- **No blink:** at battery cutoff (the LP core is stopped: dark = flat, ux §1), and on a wrong board (not our pins).
  It keeps blinking while the OLED is on (they share no pin).
- **USB powered:** the awake rhythm (it never deep-sleeps).

## 4. Firmware work if it's OK'd

1. **Spike (½ day):** does an LP-core blink link in pioarduino? Bench µA on the PPK2.
2. **`GoalApp`:**
   - the shared fault function (refactors `view()`'s verdict);
   - `Hal::statusLed(bool)` with an awake blink deadline;
   - `Hal::sleepBlink(count, period_s)` before deep sleep.
3. **Glue:**
   - the LP program (~40 lines);
   - load and start it once at boot;
   - GPIO5 as LP IO, held LOW while it isn't blinking.
4. **Checks:**
   - native tests for the count mapping, the awake rhythm and "no blink at cutoff / wrong board";
   - the twin captures `statusLed` / `sleepBlink`;
   - bench: the period, the 30 ms width, µA asleep.
5. **Knobs in `board.h`:** `PIN_STATUS_LED 5`, `LED_BLINK_MS 30`, `LED_GAP_MS 150`, `LED_PERIOD_AWAKE_MS 2000`,
   `LED_PERIOD_ASLEEP_S 5`.
