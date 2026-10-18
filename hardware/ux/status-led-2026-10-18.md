# Status LED on the goal counter (joint proposal, 2026-10-18)

Owner: `ux` (compiles). The user, via lead: "a tiny LED (or maybe two) to indicate if it is turned on,
sleeping or similar, without having to wake the display." The battery range must stay basically
unchanged.

Inputs, all in (2026-10-18): electronics (part, pin, mAh/day), firmware (blinking in deep sleep),
mechanical (placement).

**APPROVED by lead 2026-10-18, with the user's pick: GREEN + RED. Owners build now.**

**Summary:**
- Two 3 mm diffused LEDs, green and red, side by side under the display, both on GPIO5 (a series
  pair: HIGH = green, LOW = red, Hi-Z = off).
- They blink from the LP core:
  - **green × 1 = OK**;
  - **red × 2 = needs attention**;
  - **red × 3 = battery low**.
- Every 2 s awake, every 5 s asleep. Dark = off or flat.
- ≈ 0.2–0.4 mAh/day, so the §0 battery range is unchanged.

## 1. What it answers (ux)

A glance into the drawer should answer one question: **"Is it alive, and is it OK?"** Anything more
detailed is the display's job (a short press, B5a in `goal-counter-phase1-2026-10-17.md`).

| State | Worth showing? | Why |
|---|---|---|
| Alive (awake or asleep) | **yes** | The main ask. No light at all = off, cells flat, or dead |
| Awake vs asleep | **yes, but only by rhythm** | It explains "why didn't it count?" (it should wake on the first bump) without pressing |
| Needs attention: no Wi-Fi / server error / not assigned / beam blocked or dead | **yes, one "something's wrong" sign** | The display says which |
| Battery low (below warn, §3) | **yes** | It's the one fault someone can fix on the spot, with the drawer |
| A goal counted | no | The buzzer and the phone cover it. A flash during play just distracts |
| Battery at cutoff | no | Nothing to drive it with. Dark = flat, which is honest |

## 2. Blink language (ux)

- **Short blinks only, never steady.** Each blink is 30 ms. Groups are 150 ms apart. Steady light
  costs power and reads as "stuck".
- **The number of blinks in a group = the state:**
  - **1 blink = fine.**
  - **2 = needs attention:** look at the display.
  - **3 = battery low:** swap the cells. 3 wins over 2, because it's the one you can act on at once.
- **The rhythm = awake or asleep:** a group **every 2 s when awake** (counting), and **every 5 s
  when asleep**. Waiting 5 s at most is fine for a glance.
- **Colour (user's pick, 2026-10-18): green = OK, red = something's wrong.**
  - Red's blink count still tells which: **2 = needs attention, 3 = battery low.**
  - Colour gives the verdict at a glance; the count is for whoever wants the detail.
- Brightness: just visible in the drawer's shadow in a lit room, from the playing position. The
  bench sets the current. Nothing should glow out of the opening during play.

| Pattern | Means |
|---|---|
| green · every 2 s | awake, counting, all OK |
| green · every 5 s | asleep, all OK (it wakes on the next bump) |
| red ·· every 2 s / 5 s | needs attention (press the button: the display says what) |
| red ··· every 2 s / 5 s | battery low |
| nothing | off, cells flat, or dead |

## 3. Electronics (answered 2026-10-18: `electronics/status-led-2026-10-18.md`)

- **GPIO5** (an MTDI pad wire, pre-soldered), an LP GPIO.
- **A 3 mm diffused through-hole LED, green InGaN 525 nm**, via 220 Ω (≈ 1.5–2 mA). The resistor goes
  in a socket as the brightness knob.
- **It must blink from the LP core.** Waking the main CPU every 5 s would cost ≈ 4–5 mAh/day.
- **Red + green on GPIO5 alone works** (no Hi-Z leak), if the green is InGaN (series Vf ≈ 4.1 V > 3.3 V):
  - LOW = red, HIGH = green, Hi-Z = off.
  - It costs one more LED, one socket and a 3rd wire. **Never a yellow-green**: it leaks and glows.
  - It takes **two separate LEDs** (a series pair), so mechanical needs a second hole.

**Built as green + red (user's pick):**
- Electronics: the InGaN green + a red as a series pair on GPIO5, with a socketed resistor per LED
  as the brightness knob. The two should look about equally bright.
- Never a yellow-green (it leaks).

## 4. Firmware (answered 2026-10-18: `firmware/status-led-firmware-2026-10-18.md`)

- **Blinking in deep sleep = the LP core** (recommended): ≈ 1 µA EST of its own. A half-day spike
  first, to check that it links in pioarduino.
- The rejected options:
  - Waking the main core on the LP timer costs 300–500 µA (a full boot doubles the budget), or
    ~10 µA with a fragile wake stub.
  - Blinking only while awake would make dark mean "asleep or dead", which misses the ask.
- Cost at 1 mA / 30 ms:
  - Asleep (1 blink / 5 s): 6 µA for the LED + ~1 µA for the LP core.
  - Awake (1 blink / 2 s): ~17 µA.
  - That's **≈ 0.2 mAh/day (+2 %)**, and 0.6 while showing 3 blinks.
- **One fault function** in GoalApp feeds both the display's B5a verdict and the LED count (battery
  low 3 > any other fault 2 > OK 1), so they never disagree.
- **Asleep, the count freezes at the last wake's value.** "2 blinks every 5 s" then means "it had a
  problem last time it was awake": a bump or a button press wakes it and refreshes it.
- No blink at cutoff or on a wrong board.
- **Built (2026-10-18)** as §2: green × 1 / red × 2 / red × 3, every 2 s awake and 5 s asleep, from the
  LP core.
  - Red × 2 always means the display's line 1 shows a fault.
  - At boot, a counter with **no cached config** shows red × 2 (`NO TABLE`) for its first group,
    until the config arrives. ux accepts this: that's only a new or wiped counter, and it isn't
    assigned yet anyway.

## 5. Mechanical (answered 2026-10-18, EST until built)

- **A 3 mm diffused LED** in the dash front, centre r 45 (y −45), z 36.
  - It sits ~6 under the OLED window's bottom edge, centred on it, so the eye finds both together.
  - Its face is recessed 0.5 in a Ø3.1 hole through the solid block under the OLED, with no light
    pipe. The leads go back and up into the space behind the OLED.
- It's inside the opening at e_L 10–15 with > 15 to spare, and visible straight on and at ±20°.
- It's clear of the button (r 17–27), the bay (r 59–68) and R's pair.
- ux: good. Under the screen and centred on it, it reads as the screen's "pilot light". The
  diffused lens helps at ±20°.
- **With green + red: two holes side by side,** both under the OLED window and centred on it as a
  pair, ~6 between centres, so they read as two lights from 50 cm. Which colour goes left is
  mechanical's call.
- **Built (2026-10-18):** green left, red right, 6 apart, centred under the OLED window (r 42.5 / 48.5,
  z 36). ux checked `mechanical/out/sled_eye_0.png` and `sled_eye_left20.png` (the worst side): both
  LEDs are visible under the screen. Right 20° is asserted by mechanical. Brightness and glare get
  checked on the print.

## 6. Battery (electronics, at 2 mA, 30 ms blinks)

| Pattern | mAh/day |
|---|---|
| OK (1 blink) | ≈ 0.37 |
| Needs attention (2 blinks) | ≈ 0.75 |
| Battery low (3 blinks) | ≈ 1.1 |

- At 1 mA it's about half that. The OK pattern is the normal case.
- Against 13–25 mAh/day, the **§0 goal-counter range stays unchanged.**
- This only holds with the LP core (§4). Waking the main CPU to blink would add ≈ 4–5 mAh/day, so
  that's out.
