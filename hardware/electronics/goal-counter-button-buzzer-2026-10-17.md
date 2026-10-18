# Goal counter, phase 1: undo button + buzzer (electronics' part of ux's joint proposal), 2026-10-17

Status: **APPROVED and designed 2026-10-17** (lead, DECISIONS; ux's `ux/goal-counter-phase1-2026-10-17.md` §B4). Drawn in schematic.svg, perfboard.png (right of the LIS3DH, clear of C1), wiring.svg, bom.md, ASSEMBLY §3/§4/§6. **The button's 1 k moved into the lead at the switch**, so a button lead plugged onto J_BAT by mistake can't short the pack. All values are EST
(rule 11). The buzzer is the parked scoreboard's sound option B, moved to the goal counter, so it's already designed and in
the cart.

## 1. Pins

Only the XIAO's **back pads** are free on the goal counter: MTMS (GPIO4), MTDI (GPIO5) and MTDO (GPIO7). Each gets a wire
**pre-soldered before the XIAO is mounted**, like the MTCK wire.

| Pad | GPIO | Use | Why |
|---|---|---|---|
| **MTMS** | 4 | **BTN** undo button, active LOW | An LP GPIO, so it's an **ext1 wake source from deep sleep**: LOW, alongside the LIS3DH INT1 (HIGH) and the USB sense GPIO6 (HIGH). The C6 sets the level per pin; the scoreboard already does it. MTMS only straps SDIO-slave timing, which we don't use (README), so a press during boot is harmless |
| **MTDO** | 7 | **BZ** buzzer, LEDC PWM | The same pin and driver as the scoreboard's option B, so firmware reuses the code. Not a strapping pin |
| MTDI | 5 | spare | |

## 2. Circuit

```
3V3 ──100k──┬── GPIO4 (MTMS)          button: SPST-NO momentary, 2 wires to J_BTN
            └──────── J_BTN ──1k── SW ── GND    (1 k in the lead at the switch: ESD guard, and a mis-plug can't short a pack)

VSYS ──┬── BZ (CMT-1209-390T, 16 Ω) ──┐          J_BZ: 2 wires to the buzzer
       └── 1N5817 (flyback, K at VSYS) ┘
                                       └── C  BC337-40  E ── GND
GPIO7 (MTDO) ──1k── B ──100k── GND     (base pull-down: silent at boot and in deep sleep)
```

- **Button:** the external 100 k pull-up holds the pin HIGH in deep sleep, so there's no RTC pull-up to keep alive.
  Released, it draws 0 µA; held, 33 µA. Debouncing is firmware's (≥ 20 ms). A long press makes accidental undos
  unlikely; that's ux's and firmware's call.
- **Buzzer:** low-side from VSYS (the pack after D1), not from the 3V3 rail. The existing **470 µF** covers the pulses, as it
  does for Wi-Fi. The volume is the PWM duty (the scoreboard's table: 50 % High, ~12 % Medium, ~3 % Low, 0 Off).
- **Parts:** BC337-40, 1N5817, 2 × 1 k, 2 × 100 k, 2 × 2-pin headers (J_BTN, J_BZ), placed right of the LIS3DH, clear of C1 (perfboard.py).
- **Leads:** ≈ 60–100 mm each to L's front face (mechanical places the button and the buzzer).

## 3. Placement asks for mechanical

- **Button:** e.g. a 12 × 12 tactile switch with a round cap, or a 7 mm panel pushbutton (mechanical picks the mount).
  It sits on L's front face, reachable through the frame's ~35 tube. It must be outside the ball path; balls queue in
  the channel at y < −81.4, so anywhere on L's face is clear. Plastic cap (ESD).
- **Buzzer** (Ø12 × 9): its sound port faces the frame opening, behind a grille, with nothing taped over the holes.
  It goes **≥ 15 from the LIS3DH** (board x ≈ 26–49 → s 63–86), **≥ 10 from the antenna** (s 55–59, y −43 to −25), and
  not against the cells.
- **As placed (mechanical's swap, 2026-10-17, checked by electronics):** buzzer under the mouth bay at y −62.7, z 17
  (7-hole grille): **≈ 31 from the LIS3DH**, **≈ 17 from the antenna**, ≈ 65 from the cells ✓. Button above the USB-C.
  Both leads ≈ 110 (J_BTN/J_BZ along the board's channel edge), unchanged.

## 4. Battery and cost

| | mAh/day (EST) | Note |
|---|---|---|
| Button, idle | 0 | open circuit, pull-up only |
| Button press from deep sleep | ≈ 0.05 per wake (boot + Wi-Fi ≈ 1–2 s at ≈ 80 mA) | rare: undo is mostly pressed while ACTIVE |
| Buzzer, ~50 short beeps/day (goal chirp ≈ 100 ms, undo double chirp) | **≈ 0.1–0.3** | the duty decides; < 2 % of the goal counter's 13–25 mAh/day |
| **Total** | **≈ 0.1–0.4** | §0 battery (≈ 2–4 months) is unchanged within its range |

**Cost per goal counter:** buzzer ≈ 16 + BC337 ≈ 2 + passives/diode/headers ≈ 3 + button + cap ≈ 5–10 → **≈ 25–30 kr**.
**§0 updated 2026-10-17:** goal counter ≈ 170 kr (bom.md counts ≈ +30); phase 1 first table ≈ 800–830 kr, three tables ≈ 1,550–1,700 kr.

## 5. Bench checks (when built)

- Loaded rail at 3.45 V with the buzzer at High during a Wi-Fi burst: no brown-out.
- A button press wakes from deep sleep (ext1) every time; holding it through boot doesn't hang.
- Buzzer audible from the playing position with the sled in place (the tunnel muffles it). If it's too quiet, mechanical opens
  the grille; Low/Medium/High stay firmware's.
