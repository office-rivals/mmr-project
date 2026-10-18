# Scoreboard sounds v2: a premium earcon family

Owner: `ux`. User request 2026-10-15: sounds that feel premium, not "tiny buzzer, one tone". **User
decision 2026-10-15: v2 on a cheap mini speaker is the build; the buzzer stays as a fallback build**
(its version of the family: Buzzer fallback, below). `SCOREBOARD-UI.md` §Sound keeps the *when*
rules, which apply to both builds; this file says *what it sounds like*.

**Reference render:** `uv run sounds.py` writes `out/sounds/<name>.wav` (48 kHz, mono, 16-bit) plus
`family.wav` (all seven sounds with 0.6 s gaps). Every number below lives in its `SOUNDS` and `VOICES` tables, so the
previews, the device samples and this page can't drift apart.

## The family: one instrument, one key, one grammar

- **One instrument:** a soft mallet bell, warm rather than piercing. A sine fundamental carries
  most of the energy, with a gentle 2nd and 3rd harmonic for body and a faint inharmonic glint at
  4.07× that dies in ~25 ms. Every note starts with a 5 ms rounded attack (no click) and decays
  exponentially, and its upper partials fade first, like a struck bar.
  - Variants: **felt** (the same mallet, darker: no glint, softer 2nd), **tick** (very short) and
    **pad** (a slow 60 ms swell, two slightly detuned copies for a gentle shimmer).
- **One key: D major pentatonic** (D E F♯ A B, A4 = 440 Hz, equal temperament). Five notes with no
  half-steps, so any two of them sound good together. A sound cut off by the next one, or a blip
  followed by a chirp, is never dissonant. `sounds.py` refuses a note outside the key.
- **One register rule:** game sounds sit in the middle (A5–A6, 880–1760 Hz), where they carry
  ~1.5 m across a table. Badge sounds sit higher and lighter (F♯6–D7), because the person
  tapping stands 30 cm away. **Nothing goes below D5 (587 Hz).** A small speaker can't reproduce
  real bass, and pushing it there only buzzes. Warmth comes from the harmonics, not from low notes.
- **One grammar:**
  - **up** = something good happened (goal, joined);
  - **down** = taken back (undo);
  - **flat and low** = no, nothing happened (not joined);
  - **a swell with no attack** = settled (saved);
  - **up, then a chord that blooms** = we won.

  Contour plus register tell them apart, even at Low volume or from across the room.

## The sounds

Levels are peak dB relative to Goal (Goal = −3 dBFS in the masters). Each length includes the tail,
which decays to −40 dB, and the last 20 ms fade to silence.

| Sound | Purpose (when) | Length | Character | Music | Level | Tells it apart |
|---|---|---|---|---|---|---|
| **Goal** | A new goal reaches the board (either team: the board is shared and mono, so the screen shows whose) | 450 ms | Bright, quick, upbeat: "ba-ding!" | A5 → D6 (rising fourth, 70 ms apart). The A rings under the D (legato, not two beeps). D7 doubles the top note at −16 dB for sparkle. Bell. | **0 dB** (the anchor) | The one sound everyone hears every game: two notes, up, mid register |
| **Won** | The goal that ends the game (instead of Goal) | 1.4 s | A short celebration that finishes warm, not a fanfare | It starts as the Goal motif and keeps climbing: A5, D6, F♯6, A6 every 70 ms. At 300 ms it blooms into a **D major chord** (D6 F♯6 A6, ringing ~1 s), with a D7 sparkle and a soft pad underneath (D5 + A5, 60 ms swell) for body. | **+2 dB** (the loudest, once a game) | The only sound with a chord and the only one over 0.7 s: "Goal… and more" |
| **Undo** | The server confirms this board's own Undo | 450 ms | Soft, "taken back", not sad | D6 → A5: the Goal interval reversed, 120 ms apart (slower than Goal). Felt mallet, so it's darker. | **−4 dB** | Falling, darker, slower than Goal |
| **Scan** | A badge touches the target (local, instant, the receipt) | 70 ms | A tiny precise tick, like a premium card reader | One D7 tick (dies in 60 ms) plus a 3 ms bright noise click you almost feel | **−10 dB** | Shortest and highest; one event |
| **Joined** | The server says `joined` / `already_in` | 350 ms | Light, friendly "you're in": ti-ti-ting | F♯6 → A6 → D7, 45 ms apart, rising onto the **same D7 as the Scan tick**, so the receipt resolves. Bell. | **−6 dB** | Three fast notes, high, ending where the tick was |
| **Not joined** | Any other scan result, or "Not sent" | 200 ms | Neutral "hm", a soft knock, never a buzz | E5 + B5 together (an open fifth, the lowest notes in the family), felt mallet, short | **−8 dB** | Flat and lowest: no melody means "nothing happened"; the screen says why |
| **Saved to MMR** | Recommended. The auto-submit lands while 12d's countdown is on screen | 650 ms | A quiet settling glow: "done, it counts" | D6 + F♯6 pad swelling in over 60 ms (no attack transient), with an A6 bell at −16 dB, 30 ms in | **−10 dB** | The only sound with no attack. Quiet, and 10 s after Won, so it never collides |

**Why Saved is worth it:** the countdown asks people to watch for 10 s. The glow ends that wait and
tells them Undo is gone, without anyone looking. It plays **only** when the countdown the board is showing
(`submit_in_s` set) ends in a save (`needs_claim == false`), straight from 12d to 12c.
It does not play for a claim or confirm made later in the app: nobody may be at the table then.
Drop it if the previews feel like one sound too many; nothing depends on it.

## Never annoying (the old rules, plus three for samples)

1. Sound only for what just happened (goal age ≤ 3 s, Undo only on this board's own request).
   Each goal sounds once. Never in Idle, Waking, offline, Not set up, Change batteries or boot.
   Every sound is also on the screen. The silent list is unchanged (`SCOREBOARD-UI.md`).
2. **A new sound cuts the one playing with a 5 ms fade**, never a hard cut (that clicks). No queue,
   no overlap. Sound never delays the screen or a key.
3. **Short:** Won ≤ 1.5 s, everything else ≤ 0.7 s. Most of each length is a soft tail; what you
   actually notice is over in ≤ 0.3 s (Won: 0.6 s).
4. **Soft attacks only** (≥ 1.5 ms; 5 ms on the bell), no square waves, nothing above ~10 kHz.
   That's what made the buzzer sound cheap: its instant square-wave start and its harsh overtones.
5. **Badge sounds are 6–10 dB under the game sounds**: the tapper is close, and a lobby of four
   taps mustn't feel like four goals.
6. **Volume:** the same per-table setting (Off / Low / Medium / High, default Medium). Suggested
   steps: Low −18 dB, Medium −9 dB, High 0 dB from a bench-set maximum. Tune them on the real
   speaker: High is clearly audible at ~1.5 m over play, not across the office.

## What this asks of electronics and firmware

- **Speaker (electronics, `electronics/premium-sound.md`):** a 40 mm speaker (PUI AS04008PO) on a
  PAM8302 amp, fed by PDM on GPIO7, with the enable on PCA9685 channel 15. No new pins. It is usable
  from ~450 Hz; in its sealed back, 600–700 Hz is only ~3–6 dB under 1–2 kHz, so **no transposition**.
  A 20–28 mm speaker would be > 10 dB down there, and a speaker on the existing BC337 only works as a
  toy, so it's this amp or nothing. Peaks reach ~76–78 dB SPL at 1 m on High (the buzzer manages
  67–72 dBA); Medium ≈ today's High. If the final speaker is a different, smaller part and the bench
  shows it > 10 dB down at 600–700 Hz, set `TRANSPOSE = 5` in `sounds.py` (up a fourth, to G) and
  re-render. Every sound keeps its shape.
- **Battery (electronics, with these lengths: ~0.55 s average):** sound costs ~1.4 mAh/day at
  Medium (the buzzer: ~0.4). Battery life for the speaker and buzzer builds: INTERFACES §0. Each extra second of average length would cost ~2.6 mAh/day, which is why the tails stay
  short.
- **Sound mount (mechanical):** see `PHYSICAL-UX.md`, Speaker opening.
- **Samples (firmware):** convert `out/sounds/*.wav` to the device format (≥ 22.05 kHz, so the
  partials survive; 16-bit or good 8-bit). All seven take ~154 KiB at 22.05 kHz 16-bit. Play from
  flash in the background. Volume is a digital gain on the samples (the PAM8302 has no gain pins; its trim pot sets the bench maximum).
  Implement the 5 ms fade on cut-off.
- **The old pitch constant** (`SOUND_OCTAVE_SHIFT`) is not needed on the speaker build.

## Buzzer fallback (the CMT-1209 build)

The same family on a single-tone buzzer resonant at 2048 Hz: **the same notes and contours, moved up
near 2 kHz** (1319–2960 Hz, where it is loud) and played **one tone at a time** (chords are rolled).
The **duty cycle** shapes each note, so nothing starts or stops with a click. The table is
`BUZZER` in `sounds.py` (self-checked: in key, near the resonance, within length). It replaces the
old v1 note table in `SCOREBOARD-UI.md`.

| Sound | Notes (Hz · ms, back to back) | Length | Level |
|---|---|---|---|
| **Goal** | A6 1760 · 60 (−2 dB), D7 2349 · 160 hit | 220 ms | 0 dB |
| **Won** | A6 · 60, D7 · 60, F♯7 2960 · 60, then the chord rolled: A6 D7 F♯7 at 30 ms each, 7 times, fading steadily from 0 to −30 dB (630 ms) | 810 ms | 0 dB |
| **Undo** | D7 · 100, A6 · 200 hit (−2 dB) | 300 ms | −4 dB |
| **Scan** | D7 · 30 hit | 30 ms | −10 dB |
| **Joined** | F♯6 1480 · 35 (−2), A6 · 35 (−1), D7 · 100 hit: ends on the Scan pitch | 170 ms | −6 dB |
| **Not joined** | E6 1319 · 140 hit (the lowest note, flat) | 140 ms | −8 dB |
| **Saved** | D7 · 400 swell (no attack) | 400 ms | −10 dB |

- **Shapes:**
  - *hold*: steady.
  - *hit*: falls exponentially to −30 dB by the note's end.
  - *swell*: rises over 100 ms (raised cosine), then falls to −30 dB by its end.
  - The first note of a sound ramps in over 5 ms, and the last ramps out over 5 ms.
  - Notes follow each other with no gap (legato). The frequency changes; the tone doesn't stop.
- **Duty, not volume steps:** the buzzer's fundamental scales with sin(π × duty), so
  duty = asin(10^(dB/20)) / π, where dB = sound level + note dB + the volume step (Low −18, Medium −9,
  High 0, tuned on the bench). 0 dB = 50 % duty. Update the duty every ~1 ms (or use LEDC's
  hardware fade).
- Won drops its +2 dB here: 50 % duty is already the buzzer's maximum.
- `SOUND_OCTAVE_SHIFT` stays for this build only, in case the bench prefers a whole-octave shift.

## To check on the bench

- Speaker build: the first-week sound check (`SCOREBOARD-UI.md`, Hallway test). If the speaker
  differs from electronics' part, check 600–700 Hz first (`TRANSPOSE`).
- Buzzer build: check that the duty steps are evenly spaced in loudness. A resonant buzzer may
  not follow sin(π × duty) exactly; adjust the volume steps, not the table.
- Cheap alternatives, if anyone wants to compare: a different key, the felt voice everywhere for a
  softer family, or no Saved sound.
