# Goal counter phase 1: firmware part (2026-10-17)

For ux's joint proposal `ux/goal-counter-phase1-2026-10-17.md` (lead ACTION, DECISIONS 2026-10-17).
Status: **BUILT** (lead approved Part B, DECISIONS 2026-10-17); host-checked, not yet on hardware. Numbers marked EST are
unmeasured. As built: see README "Undo button + buzzer". Deviations: no `LowBatt` sound (ux B3); a press from
deep sleep plays "no" at once; refusals are not counted in `dropped_events`; a held key pin is left out of the
deep-sleep wakes in the glue (both images), with the 60 s stuck re-check timer.
**Debug OLED (ux B5, BUILT 2026-10-17, host-checked):** see README "Debug OLED". Changed from B1: a press from
deep sleep now shows the screen and plays nothing unless held to 1 s (then "no" + `Undo: too late`).

## 1. Wake on press

- **Pin (electronics picks, firmware needs):**
  - The button must be on an LP GPIO, because only GPIO 0–7 can wake the C6 from deep sleep.
  - Taken on the goal counter: GPIO0 battery, GPIO1 motion, GPIO2 beam ADC, GPIO3 RF switch, GPIO6 VBUS.
  - Free: **GPIO4 (MTMS) or GPIO5 (MTDI)** on the back pads. GPIO7 (MTDO) is better kept for the buzzer, as on the scoreboard.
  - MTMS and MTDI only act as straps when the JTAG eFuse is burned, which it isn't on stock XIAOs.
- **Wiring:** pull-up to 3V3, the button pulls the pin to GND, active LOW. This is the scoreboard's key wake, already in `lib/device` (ext1 per-pin levels next to motion's active-HIGH, `WakeCause::Key`). An external pull-up of about 100 k draws nothing while released.
- **From deep sleep:**
  - A press boots the chip in about 0.3 s (EST). The hold time counts from the wake.
  - If the pin is still LOW once the hold time is reached, that is an undo. A shorter press just wakes the counter, like table motion: harmless, it idles out.
- **In a session (auto light sleep):** a GPIO edge wakes it, then a timer checks the hold. The beam ISR is untouched.
- **Guard against accidents:**
  - **Long press `UNDO_HOLD_MS` 1000** (a board.h knob; tune on the bench). A ball can't hold a button for 1 s, and a bump can't either.
  - **One undo per press.** Release and press again for the next one.
  - **Stuck button:** if the pin is still LOW after 10 s, log `button stuck` (warn), do nothing more, and leave the button out of the deep-sleep wake sources until it is released. Otherwise a level wake would loop and drain the cells. This is the same idea as clearing the motion latch.

## 2. The undo call

**Firmware proposal: the undo is an event in the same NVS queue as the goals**, not an interactive call.

- **Order:** it is sent after the goal it undoes, even if that goal is still queued offline.
- **Durability:** it survives power loss and is retried with the same backoff.
- **Retries are safe:** it has its own `event_id` (the same scheme and shared `seq`), so the server dedupes it and a retry never undoes two goals.
- **What it undoes (DECIDE, lead 2026-10-17, user): only a goal this counter counted, within `undo_window_s` of it** (server config, default 10 s, enforced by the server).
  - The undo carries **`undoes_event_id`**: this counter's newest goal that it hasn't undone yet. A small ring of the last 4 goals is kept, each with its seq and uptime.
  - **Local check before queueing:** if no goal is left that is younger than `undo_window_s` (uptime since its detection), nothing is queued and the "no" buzz plays at once. A second press undoes the goal before, if that one is still inside the window too, e.g. after a double count.
  - **Server check:** an undo that reaches the server outside the window, a target that isn't this counter's, or one already undone → 422 → "no" buzz (if the counter is still awake). So an undo held up in the offline queue past the window is refused, by design.
  - This rule removes the cross-goal race, so no `expected_version` is needed.
  - **For backend: dedupe on `event_id` before the window check.** Otherwise the retry of an undo that worked, but whose 201 was lost, arrives late and gets 422, and the counter buzzes "no" after a good undo. A seen `event_id` → 409 (done).
  - **For backend:** the window runs from the goal's arrival at the server to the undo's arrival. Device clocks may be unsynced, so `occurred_at` is null.
- **Contract (mine, `openapi.yaml` + check_openapi payloads; backend mirrors it in `api/docs/hardware-api.md`):**
  - `POST /undo-events`, schema `UndoEvent`: `event_id, device_id, seq, occurred_at, uptime_ms, table_id, goal, undoes_event_id (string, never null: the local check always finds a target), battery_mv, firmware_version`.
  - The response table is the same as `/goal-events`. A 422 means "nothing to undo / stale" and is dropped like any permanent rejection.
  - `GoalEvent.seq` description: "+1 per event (goal or undo)". The gap check stays valid across both endpoints.
  - `sound_volume` (DeviceConfig) now applies to the goal role too (0 = silent).
  - New DeviceConfig key `undo_window_s` (integer, default 10). The device uses it for the local check, and the server enforces the same value.
- **Queue change:** `Event` gets `undoes` (0 = a goal, otherwise the target seq + 1). After the firmware update, events still queued in the old layout fail the size check and are skipped. That is fine before launch.

## 3. Buzzer patterns

- **Hardware:** reuse the scoreboard's option B as is: LEDC square wave on GPIO7 → BC337 → CMT-1209-390T, ux's `BUZZER` table (`ux/sounds.py` → `tools/make_sounds.py`), with the volume in dB from `sound_volume`.
- **Light sleep:** the counter holds a no-light-sleep PM lock while a sound plays, because LEDC stops in light sleep. That is ≤ 0.3 s per sound.

| When | Sound | Notes |
|---|---|---|
| A goal is counted | `Goal` (0.22 s) | Played at detection, locally, never waiting for the server. On by default (ux B2). `sound_volume: 0` silences everything |
| Button pressed down while awake (in a session) | `Scan` tick (0.03 s) | ux B2: means "keep holding". Not after a deep-sleep wake: the chip is still booting |
| The undo hold is reached | `Undo` (0.3 s) | Means "undo queued", so the player can let go. Played before any network |
| No goal of this counter inside the window (local check) | `NotJoined` ("no", 0.14 s) | At once; nothing is queued |
| The server refuses the undo (422/404: late, not ours, already undone), while still awake | `NotJoined` ("no") | About 1–3 s later. If the counter is offline, only the phone shows the truth later |
| Button stuck | none | Log only; a stuck button that beeps would be worse |

Not proposed: beam-health beeps, and a low-battery sound (ux B3: the phone's device line and the admin alert cover it). Every 422 plays the same `NotJoined` knock. `ux/sounds.py` is unchanged: no new pattern.

## 4. Power (firmware side; electronics owns the circuit's mAh and kr)

- Button: idle current is 0 (pull-up, released). An undo wake costs the same as a motion wake.
- Buzzer: an awake PM lock of ≤ 0.3 s per sound plus the transducer current (electronics). At about 30 goals/day this is about 0.01 mAh/day of awake time (EST), not counting the transducer.

## 5. What it would take (after the OK)

- **Code:**
  - `goal_app`: the button state machine (hold, one per press, stuck).
  - `event_queue`: `undoes`. `api`: `UndoEvent`.
  - The sound driver is moved into the goal image. Board knobs `PIN_UNDO`, `UNDO_HOLD_MS`, `PIN_SOUND`.
- **Checks:** about 8 native tests (hold/short/stuck, the undo after a queued goal, the window and the ring, a local refusal, 422 → "no"), plus check_openapi payloads.
- **Twin:** a button and an undo scenario. No goal is lost and no undo is doubled on a retry.
- **The scoreboard was parked**, then removed from firmware/ on 2026-10-18 (lead ACTION; backup and branch kept by lead).

## Open for ux / lead

None. Settled: the undo rule (lead DECIDE 2026-10-17); goal chirp on; a 1 s hold; the press tick; no LowBatt (ux 2026-10-17, ux/goal-counter-phase1-2026-10-17.md B2/B3).
