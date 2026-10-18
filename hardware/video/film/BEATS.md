> **Superseded by v4 (voice-over):** see `tools/beats.json` + `SCRIPT.md`. Kept for history.

# Revised beat list (v3: less text)

Rules (user, via lead): at most **one line on screen**, ≤ 6 words. Hold each line ≥ words/3 + 1 s.
Each line appears only **after** its motion settles, and no new motion beat starts while it is being read.
No kickers, no spec footers and no mono chips. A label appears only while the animation points at its thing.
Ambient drift (grid, glow) keeps running.

Format: `time | animation (no text) → the one line (words, hold)`.

## 1. How we do it today (0–17 s)
| t | animation → line |
|---|---|
| 0.0–1.3 | Table's bead score counter slides in; one bead snaps home with a little burst |
| 1.3–4.3 | → **"We count goals by hand."** (5 w, 3.0 s) |
| 4.3–5.5 | Magnifier swoops over a bead stuck halfway; the bead wobbles |
| 5.5–8.3 | → **"Was that 5 or 6?"** (5 w, 2.8 s) |
| 8.3–11.0 | Bare score card (two boxes): types 6, deletes, types 5, deletes, gives up at "10 – ?" |
| 11.0–13.4 | → **"Typed in from memory."** (4 w, 2.4 s) |
| 13.4–14.0 | Card slumps sideways |
| 14.0–17.0 | → **"There must be a lazier way."** (6 w, 3.0 s) |

## 2. The beam (17–33 s)
| t | animation → line |
|---|---|
| 17.0–19.0 | Top-view drawer and insert draw themselves; the IR beam flickers on across the gate |
| 19.0–22.2 | Ball drops in, rolls down the funnel and cuts the beam; the beam goes dark, a big counter pops 0 → 1 |
| 22.2–25.0 | → **"Ball blocks the beam: goal."** (5 w, 2.8 s) |
| 25.0–26.0 | Camera pushes into the gate: LED dot, beam, sensor dot, the ball's centre on the beam |
| 26.0–28.6 | → **"Infrared, right at ball height."** (5 w, 2.6 s) |
| 28.6–30.0 | Second ball, faster: beam cut, counter 1 → 2 |
| 30.0–33.0 | → **"The ball does the bookkeeping."** (5 w, 3.0 s) |

## 3. The hardware (33–46 s)
| t | animation → line |
|---|---|
| 33.0–34.5 | 70 × 30 perfboard drops in; the XIAO, LIS3DH and resistors snap onto it |
| 34.5–35.5 | Wi-Fi arcs pulse from the XIAO |
| 35.5–37.8 | → label on the XIAO: **"ESP32-C6: brain and Wi-Fi"** (4 w, 2.3 s) |
| 37.8–38.8 | The board shakes (table bump), and a ripple runs out from the LIS3DH |
| 38.8–41.6 | → label on the LIS3DH: **"Motion sensor wakes it up."** (5 w, 2.8 s) |
| 41.6–42.6 | Wires draw out to the beam LED, the sensor and a battery pack |
| 42.6–45.6 | → **"No custom PCB. We said lazy."** (6 w, 3.0 s) |

## 4. The printed insert (46–58 s)
| t | animation → line |
|---|---|
| 45.6–47.0 | `1_closed` render rises into the drawer outline |
| 47.0–49.8 | → **"Printed. Taped into the drawer."** (5 w, 2.8 s) |
| 49.8–51.0 | Crossfade to `4_top`; a ball glides along the path through the funnel |
| 51.0–53.8 | → **"The funnel steers every ball."** (5 w, 2.8 s) |
| 53.8–54.6 | A strip of duct tape slaps across the render |
| 54.6–57.6 | → **"Tape. Yes, really. Tape."** (4 w, 2.6 s, held to 3.0) |

## 5. Online (58–76 s)
| t | animation → line |
|---|---|
| 59.1–62.3 | Icons only: the table shakes, the device wakes and **joins Wi-Fi** (the link stays up in power-save mode), a ball cuts the beam, and the packet flies to the server **instantly** (lead fact change) |
| 62.3–64.7 | → **"One goal, one message."** (4 w, 2.4 s) |
| 64.8–65.6 | The server stacks packets into a tally (built: starts after "One goal, one message." clears at 64.7) |
| 63.6–66.4 | → **"The server keeps the score."** (5 w, 2.8 s) |
| 66.4–67.8 | Four more tables pop in, each with its own line to the server; a dashed line between two devices gets crossed out |
| 67.8–70.6 | → **"Devices don't talk. No gossip."** (5 w, 2.8 s) |
| 70.6–72.4 | The battery yanks out; the queued goal waits in a flash box; the battery goes back and the packet resends |
| 72.4–75.2 | → **"Pull the batteries: nothing lost."** (5 w, 2.8 s) |

## 6. Power (75–85 s)
| t | animation → line |
|---|---|
| 75.2–77.0 | `5_battery_swap` render; three AA cells drop in, and a month bar fills past a tick mark to about 4 |
| 77.0–79.8 | → **"3 × AA, ~4 months (est.)"** (5 w, 2.8 s) |
| 79.8–80.8 | "z z z" floats up off the device |
| 80.8–83.6 | → **"Sleeps more than we do."** (5 w, 2.8 s) |

## 7. After the match (84–97 s)
| t | animation → line |
|---|---|
| 83.6–86.0 | Bare score card: the fields auto-fill **10 – 5** with a shimmer, a cursor clicks ✓, the card flips to saved |
| 86.0–88.8 | → **"The app suggests the score."** (5 w, 2.8 s) |
| 88.8–91.2 | → **"Why? Because we're lazy."** (4 w, 2.4 s) |
| 91.2–93.6 | → **"And because we can."** (4 w, 2.4 s) |
| 93.6–94.2 | E-paper-style refresh flash (black/white blink); text only, no scoreboard hardware |
| 94.2–97.2 | → **"Coming soon: scoreboards."** (3 w, 2.0 s, held to 3.0) |

**Built: 101.1 s.** Scene 5 grew by 0.8 s for the wake-then-join-Wi-Fi order, so the times after 59 s shifted (exact times: the `CAPS` table in `index.html`). What gets cut: all kickers, footers, step lists, part cards, the JSON card and the chips.
The specs that remain are only those inside a line (35/40 mm are dropped; ~4 months stays, marked est.).

## As built (exact caption windows, from `index.html`)

No motion beat starts while a line is on screen; ambient drift and the pointer leaders tied to a line are the only motion during reading.

| scene | on screen (s) | line |
|---|---|---|
| s1 | 1.3–4.3 | We count goals by hand. |
| s1 | 5.4–8.1 | Was that 5 or 6? |
| s1 | 11.0–13.4 | Typed in from memory. |
| s1 | 14.0–17.0 | There must be a lazier way. |
| s2 | 22.9–25.6 | Ball blocks the beam: goal. |
| s2 | 26.8–29.5 | Infrared, right at ball height. |
| s2 | 31.0–33.7 | The ball does the bookkeeping. |
| s3 | 36.2–38.5 | ESP32-C6: brain and Wi-Fi. |
| s3 | 39.5–42.3 | Motion sensor wakes it up. |
| s3 | 43.3–46.4 | No custom PCB. We said lazy. |
| s4 | 48.1–50.9 | Printed. Taped into the drawer. |
| s4 | 52.4–55.1 | The funnel steers every ball. |
| s4 | 55.9–59.1 | Tape. Yes, really. Tape. |
| s5 | 62.3–64.7 | One goal, one message. |
| s5 | 65.9–68.7 | The server keeps the score. |
| s5 | 70.1–72.9 | Devices don't talk. No gossip. |
| s5 | 74.8–77.6 | Pull the batteries: nothing lost. |
| s6 | 79.6–82.4 | 3 × AA, ~4 months (est.) |
| s6 | 83.4–86.2 | Sleeps more than we do. |
| s7 | 89.2–91.9 | The app suggests the score. |
| s7 | 92.1–94.5 | Why? Because we're lazy. |
| s7 | 94.7–97.1 | And because we can. |
| s7 | 98.0–101.1 | Coming soon: scoreboards. |
