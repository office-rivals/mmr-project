# Interfaces (the contract between disciplines)

The single source of truth for anything two disciplines must agree on. The **owner of a row edits it** and
tells the affected agents; lead reviews the diff (PROTOCOL rule 3). `TBD(<owner>)` = owner must fill in.
`EST` = not yet measured. Build against what's here, not against what's in someone's head. The device API
contract is `firmware/openapi.yaml` + `api/docs/hardware-api.md`.

## 0. Numbers (cite these; don't copy them)

Other docs write e.g. "≈ 4.4 months (INTERFACES §0)". The owner updates the row when the number changes.
**Copied on purpose** into GUIDE.html + the deck (presenter) and the films (video), because those are standalone pages: whoever changes a row also messages presenter and video.

| Number | Value (2026-10-15; costs 2026-10-18) | Owner |
|--------|--------------------|-------|
| Ball diameter | 31 mm usual, 31–36 mm supported | lead (user) |
| Goal counter battery, 3 × AA NiMH | **≈ 1.7–3.4 months EST** (pessimistic–typical, beam mode `a`, the default; 3.65 V cutoff since review 2, RF-switch pull-up, 300 s telemetry; bench decides). A table switched to `a_boost`/`b` (only if it needs it): ≈ 1.2 months while selected | electronics |
| Scoreboard battery, 3 × AA NiMH | **≈ 2.3–3.3 months EST** (speaker, Medium); ≈ 2.6–3.8 (buzzer); 320 goal updates/day | electronics |
| Cost per goal counter | **≈ 245 kr** at fleet quantity (review-2 parts with lead's cuts and round 3: wired battery lead on a JST-PH pair + fuse, AliExpress OLED, clone LIS3DH); the first table's units ≈ 350 (SparkFun LIS3DH, Waveshare OLED, qty-1 prices). Was ≈ 185 before review 2. Excl. AA cells, filament, tape, tools | electronics |
| Cost per scoreboard (**parked**, phase 1) | ≈ 610 kr (speaker option A + window, diffuser, USB-C panel extension; ≈ 630 with the buzzer fallback parts; same exclusions) | electronics |
| First table | **phase 1 (2 counters, scoreboard parked): ≈ 1,400–1,500 kr** (the counted cart in `electronics/bom.md`, incl. shipping, spares and FPC antennas bought ahead; charger only if none) · later with its scoreboard: ≈ 2,000–2,150 *est.* | electronics |
| Three tables | **phase 1 (6 counters): ≈ 1,900–2,200 kr** *est.* · later with 3 scoreboards: ≈ 3,750–4,100 *est.* | electronics |
| End shelf: flat top depth / free length at the right end | 95 mm (measured) / ≈ 170 mm | mechanical |
| Scoreboard v5 footprint | 151 W × 91 D × 103 H mm (incl. cover, window + rim), face 50°; at the shelf's right end, ≈ 17 mm from the bead counter | mechanical |
| Drawer: frame opening / floor step / tunnel width | 130 × **57** (height: user 2026-10-18, bar top to the opening's top edge; was ~55; width approx; R ≈ 10), its left edge ≈ 10–15 in from the left (user 2026-10-17; the sled is checked at both ends) / wooden floor ≈ 10 below the frame's bottom bar (user 2026-10-16) / ≈ 139.5 EST (roll-test fit 1, 2026-10-16; was ≈ 150) | mechanical |
| Goal → sound delay (beam to sound) | ≈ 0.24 s typical (fast RX off; the speaker adds ≈ 0.02 s settle + amp turn-on); EST until the bench | firmware |
| Test counts | firmware native 55 · contract payloads 30 · API 294 · twin 19 · assembly gate 139 | firmware · backend · twin · assembly-review |

## 1. System overview

One device per goal, two per table. Each device is a self-contained,
battery-powered unit inside the goal's ball drawer:

```
 table vibration ──► [motion sensor] ──wake──► [ESP32] ◄── [IR break-beam across ball channel]
                                                  │
                                         Wi-Fi (STA only)
                                                  ▼
                                       REST server (TBD, HTTPS)
```

States:

| State      | What's powered                                  | Leaves when                                        |
|------------|-------------------------------------------------|----------------------------------------------------|
| `SLEEP`    | Motion sensor only (µA). ESP32 deep sleep.      | Motion interrupt → `ACTIVE`                        |
| `ACTIVE`   | Beam on, goal detection running, Wi-Fi as needed | No motion **and** no goal for `idle_timeout_s` (default 300 s; matches last 10–15 min) → `SLEEP` |

- A goal is counted **when the beam has been blocked for ≥ `min_block_ms`** (don't
  wait for it to clear — a slow ball may stop in the gate). The detector re-arms
  only after the beam is clear again **and** `lockout_ms` has passed (the ball can
  bounce/roll back). If the beam stays blocked > `stuck_after_s` (default 10 s),
  report it in the status payload (`beam_blocked: true`) — a ball is stuck or the
  collector is full. All tunable via config — the physical world needs calibration knobs.
- The ball arrives **slowly** on a slightly tilted floor (user), so it blocks the
  beam for ~100 ms or more; speed is not a sensing problem, but stalling is a
  mechanical one.
- Wi-Fi within `ACTIVE`: **connect on wake, stay associated with power save (listen interval 3) + auto light
  sleep** (user + lead, DECISIONS); fallback build `xiao_c6_per_goal` reconnects per goal. Firmware's call,
  justified by the power budget (§3).
- **Radio rule:** Wi-Fi station mode only. No AP/hotspot, no ESP-NOW, no
  BLE advertising, no mDNS/SSDP/broadcast discovery. A device only ever talks
  to the configured REST server (plus DHCP/DNS/NTP, which are unavoidable).

## 2. Electronics ↔ firmware

Pin map v1 (electronics, 2026-10-14; datasheet verification pending — electronics flags changes).

| Item                     | Value |
|--------------------------|-------|
| MCU board                | Seeed XIAO ESP32-C6. 3×AA → 1N5817 Schottky → XIAO BAT pads (onboard buck, Iq 2.3 µA; diode blocks the onboard Li-ion charger from charging AAs, so USB with cells in is safe) |
| Motion sensor            | LIS3DH **clone board** (user, 2026-10-15; chip C3H, no LED, regulator bypassed; fallback SparkFun SEN-13963), I²C **0x19 or 0x18, auto-detected** (at 0x18 firmware sets SDO_PU_DISC), SDA GPIO22/D4, SCL GPIO23/D5. Spring-switch alternative documented in `electronics/motion-wake-options.md` (not adopted) |
| Motion wake              | LIS3DH INT1 → GPIO1/D1, push-pull, active-HIGH, **latched**, ext1 deep-sleep wake |
| Beam receiver pull-ups   | A: GPIO21/D3 → R_PU 220 k (socketed); B: GPIO16/D6 → R_PU_B 68 k (review 2, was 22 k). HIGH = on, LOW in deep sleep (beam health 2026-10-16, `electronics/beam-health-2026-10-16.md`) |
| Beam LED drive           | GPIO20/D9 → R_LED 2.2 k (≈ 0.93 mA, every mode); boost GPIO18/D10 → R_LED_B 270 Ω (review 2, socketed; ≈ 6.3 mA total); R_LS 47 Ω inline at the LED. LOW = off |
| Beam receiver input      | Counting: GPIO19/D8, health: GPIO2/D2 (ADC1_CH2), each through its own 1 kΩ (R_S8 / R_S2, review 2) from the node; C_RX 1 nF at the node. TEFT4300 phototransistor |
| Beam modes (server `beam_mode`) | `a` = D3 + D9 (220 k, ≈ 0.93 mA; **the default**) · `a_boost` = + D10 (220 k, ≈ 6.3 mA; per table, only if needed) · `b` daylight = D3 + D6 + D9 + D10 (52 k, ≈ 6.3 mA; ≈ 1.35× at minimum parts, ambient ceiling 4.2× mode `a`) · `auto` (firmware). Margins: `electronics/README.md` *Daylight margin* |
| USB VBUS sense (goal)    | GPIO6, XIAO back pad MTCK (LP GPIO, deep-sleep wake), 5 V → 6.8 k / 10 k divider (review 2, was 68 k / 100 k); firmware turns the RTC pulls off before sleep and ignores VBAT while it is HIGH |
| Undo button (goal, phase 1) | GPIO4, XIAO back pad MTMS: 100 k pull-up to 3V3, 100 nF to GND (review 2), 1 k (in the lead) + an MX blue switch to GND (2026-10-18). **Active LOW**, ext1 deep-sleep wake (per-pin LOW). 0 µA released (2026-10-17, ux phase-1 §B4) |
| Buzzer (goal, phase 1)   | GPIO7, XIAO back pad MTDO: LEDC PWM → 470 Ω (review 2) → BC337-40 (100 k base pull-down) → CMT-1209-390T from VSYS, 1N5817 flyback. HIGH = coil on; volume = duty (`sound_volume`, as the scoreboard's option B) |
| Status LEDs (goal, 2026-10-18) | GPIO5, XIAO back pad MTDI (LP GPIO): 3V3 → 680 Ω → red → **pin** (via R_S 100 Ω on the board) → InGaN green → 220 Ω → GND; the 680 sits on the board at J_STAT (the lead carries no raw 3V3, round 3), the 220 inline at the green LED (Kingbright WP710A10SURDK / WP710A10ZGDK). **LOW = red, HIGH = green, Hi-Z = both off** (leak negligible on paper; the bench measures the off-state current). 30 ms blinks (ux/status-led-2026-10-18.md), driven by the LP core in deep sleep. Resistors socketed (brightness) |
| Status OLED (goal, phase 1) | 0.91" 128 × 32 white Waveshare 14657 (fleet: AliExpress, same outline), SSD1306, **I²C 0x3C on D4/D5**, shared with the LIS3DH (0x19/0x18); J_OLED keyed 5-way, cavities **1 SCL, 2 GND, 3 SDA, 4 V, 5 plugged**; wires soldered into the module's left-end holes, `OLED_FLIP` 0. Never power-gated: panel off (0xAE, charge pump off) through deep sleep (user 2026-10-17) |
| Beam receiver polarity   | **BLOCKED = HIGH** |
| Beam LED current         | ≈ 0.93 mA in mode `a` (TSAL6200, socketed R_LED 2.2 k + R_LS 47); ≈ 6.3 mA in `a_boost` / `b` (≈ +5.3 mA while selected, ≈ +25 mAh/day). Full-width beam / TSAL6100: not adopted |
| RF switch GPIO3          | Has a 10 k pull-up on the XIAO — firmware releases it outside Wi-Fi (0.33 mA if held low) |
| Battery voltage sense    | GPIO0/D0 (ADC), 1 M / 1 M divider (×2), 100 nF |
| Status LED               | Onboard user LED GPIO15, active-low (verifying) |

## 3. Power budget

Target: **≥ 1 month** on one battery set, swappable. Electronics owns the
budget; firmware owns meeting it. Assumed usage for the budget (lead): **4 h
active play per day**, ~**40 goals per active hour** per goal, 7 days/week.

| Item                         | Value             |
|------------------------------|-------------------|
| Battery chemistry & capacity | **3×AA, NiMH or alkaline only** (user's own cells; low-self-discharge NiMH recommended; **never lithium L91**: > 5 V on VSYS) → slack-loop lead → JST-PH on J_BAT → 1N5817 → XIAO BAT pads (onboard buck; no buck-boost) |
| SLEEP current                | Goal ~22 µA EST (XIAO 15 + LIS3DH 3 + divider 2 + cap ~2); acceptance (review 2): **base ≤ 25 µA** with the OLED unplugged and blinks off, then the full device averaged over ≥ 4 blink cycles incl. an attention double-blink (≈ 40–55 µA), ≥ 10 min after sleep. Scoreboard 35–55 µA EST |
| ACTIVE average current       | Typical / pessimistic per day, EST (`electronics/README.md` *Power budget*, both boards): goal ≈ 13.9 / 27.6 mAh (beam 1.0–2.2 mA, Wi-Fi 1–2 mA, RF-switch pull-up 1.55 mAh, telemetry 0.6–2.4 mAh, buzzer 0.1–0.4 mAh, OLED 0.2–0.9 mAh, status LEDs 0.4–0.85 mAh, phase 1); scoreboard (parked) ≈ 16.5 / 23.3 mAh with the speaker, ≈ 14.1 / 20.8 with the buzzer (listen interval 3; fast RX while live optional, not approved) |
| Projected life               | See §0 (target 1 month) |
| Low-battery thresholds (3×AA pack, radio off) | **warn 3750, cutoff 3650, resume 3950 mV** (hardware review 2 R1.5, lead 2026-10-18; firmware `board.h`; the contract's optional `batt_*_mv` config keys are not served by backend, so the board.h values apply): the full path drops ≈ 0.55–0.7 V at TX, so on paper 3650 gives only ≈ 2.95–3.10 V at 15 dBm: **3650 is provisional and the bench sets the cutoff** (warn/resume follow at +100/+300 in board.h; 11 dBm below warn). Brown-out reset at 2.76 V is a safety net only. Bench gate: ≥ 3.1 V on 3V3 across the whole sweep at both TX powers with max sound + OLED (`electronics/README.md` *Low battery*) |

## 4. Electronics ↔ mechanical

**Source of truth: `electronics/dimensions.md`** (goal board 70×30 perfboard, 2 × Ø3.2 pin holes at x 66.5 / y 3.5 & 26.5, held by printed pins + clips, no screws; supports only in the keep-out zones — ≤ 3.0 mm under the board elsewhere; battery lead via JST-PH disconnect; DFRobot FIT0610 3×AA holder; TSAL6200 Ø5 emitter; TEFT4300 Ø3 receiver; scoreboard parts listed there too).

Electronics provides, per part: outline dimensions (L×W×H mm), mounting
(holes / snap / glue), connector & wire exit side, and clearance needed.

| Part                     | Dimensions / mounting |
|--------------------------|-----------------------|
| MCU board                | XIAO ESP32-C6 21 × 17.8 mm, on the 70 × 30 perfboard (`electronics/dimensions.md`); USB-C at the board's end, reachable for flashing |
| Battery holder           | DFRobot FIT0610 3×AA, 68 × 47 × 17 mm, sliding cover, slide switch bridged, in a pull-out drawer: **F1 2 A fuse** in its + lead at the holder, then a **slack-loop lead** (Adafruit 6181 pair, ≈ 260) to a **polarized, latching JST-PH pair on J_BAT** (Adafruit 1131 halves). The counter stays on while the drawer is out: off = unplug J_BAT or take a cell out |
| Motion sensor            | LIS3DH clone hot-glued flat on the perfboard (SparkFun fallback soldered on 12 pins); the board is held rigidly by printed pins + clips |
| Beam emitter             | TSAL6200: body Ø5.0, flange Ø5.8, 8.7 flange underside → dome tip; tip 12 behind its Ø3 aperture (`electronics/dimensions.md`) |
| Beam receiver            | TEFT4300: body Ø3.0, flange Ø3.9 (keying flat 3.2), 4.5 flange underside → dome tip; tip 4.4 behind its Ø3 aperture (mechanical, review 2) (`electronics/dimensions.md`) |
| Wire routing             | Shielded from the ball path; overhang per user's front-view drawing |

**Sled placement (agreed 2026-10-17):** `electronics/dimensions.md` 'Placement in the goal-counter sled' = `mechanical/sled.py` (asserted there: keep-outs, plug and antenna clearances, USB-C in the opening, socket hole 14 × 14). Mechanical owns this line.

Also required by mechanical:
- USB port of the MCU reachable for reflashing without disassembly.
- Beam elements recessed into the channel walls so the ball can't hit them,
  and shrouded so room light/sunlight doesn't reach the receiver directly.

## 5. Mechanical ↔ drawer (user's table)

| Item                         | Value |
|------------------------------|-------|
| Ball diameter                | **31 mm usual, 31–36 mm supported** (user 2026-10-15; was 35) |
| Drawer frame opening / step / tunnel | §0 (photos + user, 2026-10-15; tunnel width EST until measured) |
| Tunnel height / length / goal entrance | ≈ 46 EST / ≈ 490 / s ≈ 285–490, full width (`mechanical/drawer-v4-concept.md` §1) |
| Drawer slope | not measured (videos can't give it); design for 1.6°, roll test measures it |
| Ball speed in the tunnel | 0.55–0.95 m/s at the beam position (slow-mo videos, EST ±20 %) |
| Mounting method              | Duct tape or double-sided tape (user). Flat, wide base pads; no screw tabs |
| Ball channel inner width     | 40 mm (36 mm ball + 4 mm play) |
| Beam height above floor      | ~17 mm (ball centre — longest blocked chord) |
| Drawer floor                 | Bare wood (user); felt only behind the goal entrance — tape to floor OK |
| Print volume                 | ≤ 256 × 256 × 256 mm, multi-part allowed |
| Goal counter (v4 concept)    | A **sled** in 2 units that each pass the frame opening and lock together inside (left, s 36–275, one print, 52 high: electronics + V-wall 45° under a roof, ≥ 37 high, 2 mm slide ribs to the left wall; right, s 44–293: PTFE skin + receiver pod with a receiver cartridge loaded from the back, held by the tunnel wall; L has a lid over its box), captive dovetail rail, **beam at s 194** (fit 1, 2026-10-16; was 240): 4 × 36 / 5 × 31 balls queue clear of it from the frame's bar, channel along the right wall; roll test v2 (`mechanical/ROLL-TEST.md`). **The real sled (2026-10-17): `mechanical/sled.py`** (imports roll_test.py; L with a flat top (54, from the 57 opening), a front-loading AA battery drawer (a wired lead to a JST-PH J_BAT pair, rolling in a U-loop channel under the rail, right of the lane, with a nonconductive cord as the travel stop; swap with the sled in place), a separate dash (MX undo key, 0.91" OLED upright, 2 status LEDs, receiver bay, buzzer), a service grip in the lane wall, the board behind the drawer (USB-C via the empty lane; leads kept off the XIAO's antenna end), a flat lid with a stick-on spot for an FPC antenna; R = roll test v2 + a lead rebate on its front bridge), build guide `mechanical/SLED-ASSEMBLY.md`; opening offset e_L ≈ 10–15 (user 2026-10-17; USB-C + button OK to ~23). Insert v3 is FROZEN (superseded) |

## 6. Firmware ↔ REST server

**Source of truth: [`firmware/openapi.yaml`](../firmware/openapi.yaml)** (OpenAPI 3.1, owner: firmware,
kept in lock-step with `firmware/lib/core/api.*` by `firmware/tools/check_openapi.py`).
Summary only — the spec wins on any difference:

- `GET  /devices/{device_id}/config` — pulled on every wake; cached; 404 = unassigned (keep counting).
  Goal counters also take `beam_*`: `beam_mode` (`a`/`a_boost`/`b`/`auto`) plus health thresholds in µA
  and the fitted resistor values (beam health, DECISIONS 2026-10-16).
- `POST /goal-events` — one per goal; `event_id = device_id-epoch-seq`, server dedupes on it.
  2xx/409 done · 400/404/410/422 dropped · network/5xx/408/429/401/403 retried with backoff.
- `POST /undo-events` — goal counters' undo button (phase 1): `UndoEvent` = the goal-event fields +
  `undoes_event_id` (this counter's own goal), queued behind its goal, shared `seq`. Server: dedupe on
  `event_id` first (409), then 422 `code` not_yours / too_late / already_undone / closed; the window is
  `undo_window_s` (config, default 10, server arrival times). Config `sound_volume` now also drives the
  goal counters' buzzer (goal chirp, undo, "no").
- `POST /devices/{device_id}/status` — on entering SLEEP (= "table idle" hint for closing abandoned
  matches; best effort, not retried — backend should also time out), battery + queue + beam health.
  Goal counters add a `beam` object (`health` ok/low_margin/ambient_high/blocked/sensor_dead, `mode`, light
  in µA, `margin`, baselines) and also POST mid-session with `reason: beam` when the health gets worse.
- Scoreboard: `GET /devices/{device_id}/scoreboard?since=<version>&wait=25` (long-poll: the server answers
  at a change or after `wait`, 304 = no change) and `POST /devices/{device_id}/scoreboard/actions`
  (undo, new game, assign scorer, swap sides, scan, remove player, generate teams `fair|random|manual`;
  `expected_version`, 409 = stale view).
- Auth on every request: `X-Device-Id: <device_id>` + `Authorization: Device <64 hex secret>` (created on the
  device, kept in NVS) + `X-Enrolment-Token` (only matters while the device is unknown); see
  `api/docs/hardware-api.md` *Device auth*. 401/403 are retried with backoff (a fixable token).
  `device_id = fb-<wifi mac hex>`. The goal device is match-agnostic (DECISIONS).

## 7. Power-loss safety (user requirement)

Power can vanish at any instant (AA cells pulled). Firmware must:
- Persist `seq` and the event queue with atomic/journaled writes (NVS or a wear-levelled FS);
  a torn write must never brick the device or lose earlier queued events.
- Accept that an event in flight at power loss may be resent — the server dedupes on `event_id`,
  so `seq` must never be reused (persist before sending, never after).
- Boot cleanly from any state with no manual intervention.
Electronics: brown-out behaviour as cells run flat must be clean (no flash writes during brown-out;
consider a low-battery cutoff/report threshold).

## 8. Scoreboard (draft — new subsystem)

**One per table** (user), on one end shelf, facing along the table. Separate unit: XIAO ESP32-C6 + e-paper + physical soft-key
buttons + AA. Talks only to the REST server (radio rule §1 applies). Holds no match state.

| Item | Value |
|------|-------|
| Display | **4.2" B/W e-paper** (user, final), 400×300, partial refresh; holds the last image at 0 W |
| Buttons (owner: ux layout, electronics circuit) | **4 MX-style keys** (user's own) on a printed plate in one row under the display, 20.32 mm pitch, centred on the active area; each sits under its on-screen label with the LED bar between (`ux/PHYSICAL-UX.md`, Keys). Resistor ladder on D2 (K1 0 Ω, K2 4.7 k, K3 10 k, K4 22 k, 100 k pull-up), ext1 wake LOW |
| Actions (owner: ux) | Undo · New game (mid-match: **Save / Discard / Cancel**) · Pick scorer · Swap sides (0 : 0) · scan-in: Remove player, make teams **Choose / Random / Fair** (1v1: Make teams), Again (random teams) · Rematch. Screens and keys: `ux/SCOREBOARD-UI.md`; API: `firmware/openapi.yaml` |
| Team size | From the server (config / scoreboard state), 1v1 or 2v2 — never hard-coded |
| Facing (owner: ux) | Along the table from the **right end** of the end shelf, beside the bead counter (v5), face **50°**, square to the rail. Badge target on the face, right of the screen; phone NFC tag in the left (inner) wall. Footprint: §0. A mirrored build for the left end flips both (`BADGE_SIDE` in `ux/mockups.py`) |
| Wake | Key press (D2), table motion (LIS3DH INT1, D1), USB plugged (VBUS sense, MTCK/GPIO6); all ext1 |
| Live updates | Long-poll (§6): the held request is answered at the change, so a goal shows within the goal → sound delay (§0) plus the e-paper refresh (~0.4 s partial). Optional fast RX while a match is live (`FAST_RX_WHILE_LIVE`, off: not approved) |
| Power | 3 × AA (same path as the goal device); life: see §0 |
| Mounting (owner: mechanical) | On the end shelf's flat top at its **right end**, beside the bead counter, **tape only**: 3 × 19 mm foam-tape strips across the full width, all on the flat; centre of mass over the middle of the flat (asserted). Shelf flat, free length and footprint: §0. `mechanical/README.md` Scoreboard, `mechanical/shelf_fit.py` |
| Service (owner: mechanical) | Battery: back cover off, holder slides out backwards. **USB-C: socket in the back cover** (panel-mount C-C extension to the XIAO; electronics picks the part), flash without opening. Protective window: 3 mm anti-glare PC on the face, black-masked back, symmetric aperture (active + 2.8 mm) |
| Power loss | Power can vanish any instant (battery swap). No match state on the device; reboot → re-fetch state. Unconfirmed button presses are dropped, never replayed. Atomic NVS writes (§7) |
| Power save | Deep sleep when idle (e-paper keeps the last score at 0 W), wake on button/motion; ACTIVE = light sleep + Wi-Fi PS + long-poll; redraw only on state change |
| Sound (owner: ux sounds, electronics hardware) | Two assembly options on GPIO7 (MTDO pad), selected by a socketed 1 kΩ: **A speaker** (user's pick: PDM → RC → PAM8302A clone **on VSYS (after D1)**, enable = PCA9685 ch 15 → 40 mm 8 Ω; **firmware mutes A while USB VBUS is present**) or **B buzzer** (BC337 → CMT-1209-390T); firmware `SOUND_HW`. `electronics/premium-sound.md`. **7 sounds**: goal, won (instead of goal), undo (own undo confirmed), scan, joined, not joined, saved (the 12d countdown ends in a save). What they sound like: `ux/SOUNDS-V2.md` (A: samples rendered by `ux/sounds.py`; B: its `BUZZER` tone table). When they play: `ux/SCOREBOARD-UI.md` §Sound (Goal/Won only if `last_goal.id` is new and `age_s` ≤ 3). Volume + mute are remote: per-table `FoosballTable.sound_volume` int **0–3** (0 = off, 1 low, 2 medium, 3 high; default 2) → device config field **`sound_volume`** (missing = 2), admin control "Scoreboard sound: Off / Low / Medium / High". Firmware sets loudness by digital gain (A, −18/−9/0 dB) or PWM duty (B); the amp pot or attenuator R_A3 / R_SND sets the max. No on-board mute |
| Pin map (electronics) | D0 VBAT sense · D1 LIS3DH INT1 · D2 KEYS ladder · D3 EPD BUSY · D4/D5 I²C (LIS3DH 0x19/0x18, PCA9685 0x40) · D6 EPD RST · D7 EPD DC (no strap = scoreboard) · D8 SCK · D9 EPD CS · D10 MOSI · MTDO/GPIO7 sound · MTMS/GPIO4 RC522 MISO · MTDI/GPIO5 RC522 CS · MTCK/GPIO6 VBUS sense. Full table: `electronics/README.md`, scoreboard *Pin map* |
| Card reader + LEDs | RC522 (shares SCK/MOSI, RST tied high, polled only on scan screens); PCA9685 drives 5 RGB LEDs (LED n = ch 3(n−1)..+2, LED5 = 12–14, ch 15 = amp enable). Keep-outs round the loop: `electronics/README.md` *Card reader* |
| API | `firmware/openapi.yaml` (§6): scoreboard state (version, score, players, last goal, roster, summary, auto-submit countdown, `teams_mode`) + actions. Device identity, auth and config pull as §6 |

## 9. One firmware image (goal counter); no role strap

- One image, **`goal-counter`** (`firmware/`, envs `xiao_c6*`); the scoreboard image was removed 2026-10-18.
- **No D7 strap** (hardware review 2, F-C1, lead): R_STRAP and the boot check are gone, D7 is free. Status
  reason `wrong_board` is no longer sent (kept in the contract's enum for older firmware).
- The server config `role` should be `goal`; anything else is logged (`config_role`), never acted on.
- Battery sense: calibrated ADC, 8-sample radio-off average, trimmed per unit at assembly over USB serial
  (`cal <meter mV>`, stored in the device's NVS; no server needed; a config `vbat_scale` would override it).
  On USB (VBUS sense HIGH) the pack isn't read for the status.

## 10. Telemetry: logs, metrics, battery (user requirement)

- **Transport: OpenTelemetry OTLP/HTTP, JSON encoding** (user): `POST {otlp_base}/v1/logs` and
  `{otlp_base}/v1/metrics`, endpoint + auth header from the secrets file (separate from the REST base URL).
  Resource attributes: `service.name` = `foosball-goal-counter` | `foosball-scoreboard`,
  `service.version`, `device.id`, `foosball.role`, `foosball.table_id`, `foosball.goal`/`end` when known.
  Target: the `grafana` (otel-lgtm) resource in the AppHost, `:4318`, LAN only with `FOOSBALL_OTLP_LAN=true`
  (owner observability, see `observability/README.md`). No traces for now.
- **Logs**: structured events (ts, level, tag, msg, kv), ring buffer in RTC memory (survives deep
  sleep, not power loss). Shipped in batches as OTLP logs whenever the device is already online (end of session, with status, and
  every 5 min while associated; 60 s in the bench builds). Never blocks detection; drops the oldest when full, and reports the drop count.
  No secrets (SSID, password, token) ever logged.
- **Metrics** (in status/heartbeat): battery_mv, low_batt, reset reason, uptime, wake count, goals
  counted, beam glitches/short blocks rejected, stuck-beam events, Wi-Fi connect time + RSSI + retries,
  queue depth/drops, firmware version, role, free heap; goal counters: beam health (`foosball.beam.health`,
  `.mode`, `.ambient`/`.lit`/`.ball` in µA, `.margin`), plus a `beam` log record per health or mode change and
  a summary (worst ambient and ball light) every `beam_report_s` and at each session end.
- **Metrics** are also exported as OTLP metrics (gauges/counters, e.g. `foosball.battery.voltage` in
  V, `foosball.goals`, `foosball.beam.rejected_blocks`, `foosball.wifi.rssi`), with each heartbeat/status.
- **Heartbeat**: a status POST (REST) + OTLP metrics export at least every **24 h** (timer wake) even
  with no play, plus on every SLEEP. Alerting lives in the observability stack (owner observability,
  `observability/grafana/provisioning/alerting/foosball.yaml`): battery below the warn level (§3),
  **no metrics from a device for > 36 h**, wrong board, repeated abnormal resets; beam: `ambient_high` within 2 h
  of the same clock time two days running, `blocked` ≥ 10 min in one session, `sensor_dead`, `low_margin` > 1 day
  (these rules match the `beam` log text `health <state>` / `idle, reporting before sleep`). Ambient-by-hour panel:
  `<grafana>/d/foosball-device?var-device=<device_id>&viewPanel=panel-15`. Contact point: placeholder
  until the channel is decided. REST status keeps `low_batt` for the app.

## 11. Backend (MMR API) — device domain, table matches, admin API (owner: backend)

Implements `firmware/openapi.yaml` (device side, owner firmware) inside `api/`; the full backend contract
(app + admin endpoints, shapes, config) is `api/docs/hardware-api.md` (owner backend). Summary only:

- **Entities** (org-scoped): `FoosballTable` (name, default league, end labels A/B, short code),
  `Device` (`fb-<12 hex>`, role goal|scoreboard, table, end A|B, claimed, secret hash, last seen/status,
  battery), `TableMatch` + `TableGoal`, `PlayerCard` (badge UID as HMAC), roster entries, `DeviceWake`.
- **Device auth**: `X-Device-Id` + `Authorization: Device <64 hex secret>` + `X-Enrolment-Token`
  (hardware-api.md "Device auth"). Unknown device + valid org token → registered **unclaimed**; an admin
  claims it and assigns table/role/end. Unclaimed devices' goals are stored without match effect. Storage
  wipe → 401 → admin **reset** → re-enrols.
- **Table match**: created on the first goal at a table with no running match; score per end, goals
  deduped by event_id, undo; ends at the league's winning score, "New game" or a 30-min idle sweep.
  Never drops a goal. Claimed in the app (players per end, league) → normal rated match
  (`MatchSource.Table`); a linked match won outright auto-submits after `Hardware:AutoSubmitDelaySeconds`.
- **Linked match**: an active (matchmaking) match linked to a table; the scoreboard shows names, swap sides.
- **Scan-in**: badges tapped on the scoreboard fill a roster; `generate_teams` with mode fair | random |
  manual (hardware-api.md "Scan-in").
- **Scoreboard state**: long-poll per openapi, derived from the table's current match.
- **Occupancy + stats**: `occupancy` on table responses, `/tables/stats`, `/tables/{tableId}/stats`
  (spec: `analytics/METRICS.md` §8).
- **Admin API** (Moderator/Owner): tables CRUD + short codes, device list/claim/assign/reset,
  enrolment token (Owner), badges.
- **Telemetry**: devices send OTLP straight to the collector (§10); the API keeps only the REST status
  snapshot for the admin view.
