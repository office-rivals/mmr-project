"""The buzzer fallback (ux/SOUNDS-V2.md, "Buzzer fallback"), rendered the way the board plays it:

  1. the firmware's own note table (firmware/lib/core/sound.h, from ux/sounds.py) through a port of
     snd::Player::tick() (same file), evaluated every 1 ms like the firmware's loop;
  2. duty = asin(amp x volume) / pi, rounded to 0.01 % (duty_bp, lib/core/goal_app.cpp) and then to the LEDC's 13 bits (src/goal/device.cpp);
  3. a band-limited LEDC square (pulse) wave at that pitch and duty, one tone at a time, phase-continuous;
  4. a model of the CMT-1209-390T magnetic transducer: resonant at 2048 Hz, steep roll-off either side.

    python3 tools/buzzer.py      # -> buzzer/NN-<name>.wav + .mp3, buzzer/tour.wav + .mp3

Volume: the default, Medium (-9 dB), because on a buzzer the volume step changes the duty and so the timbre.
The set is then scaled once so Goal peaks at -3 dBFS (ux's anchor), keeping the sounds' relative levels.

Since the firmware cleanup (2026-10-18) the tree has only the goal counter's four sounds (goal, undo, scan,
not joined). Won, joined and saved were the parked scoreboard's: their WAVs stay as rendered on 2026-10-17 from its
firmware (same player, same scale), and the tour reuses them.
"""
import re, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, iirpeak, lfilter

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "buzzer"
FW = HERE.parents[2] / "firmware"
sys.path.insert(0, str(HERE))
import render as R  # noqa: E402
from render import S  # noqa: E402

NAMES = ["goal", "won", "undo", "scan", "joined", "not_joined", "saved"]   # snd::Id order
VOLUME_DB = -9            # include/board.h SOUND_VOLUME_DB[2] (Medium, the default)
BITS = 13                 # src/goal/device.cpp BUZZER_BITS
RAMP_MS = 5               # sound.h RAMP_MS
F0 = 2048                 # CMT-1209-390T rated frequency
# ponytail: a generic resonant model (2nd-order peak at F0, Q 3, plus 2nd-order high-pass 1 kHz / low-pass 5 kHz for
# the steep skirts), not the datasheet curve; replace with the measured curve if the bench records one.


def table():
    """{name: (notes, level10)} for the sounds the firmware still has (sound.h: B_<NAME>[] and BUZZER's levels)."""
    h = (FW / "lib/core/sound.h").read_text()
    levels = {c.lower(): int(lv) for c, lv in re.findall(r"\{B_(\w+), \d+, (-?\d+)\}", h)}
    out = {}
    for name in NAMES:
        m = re.search(rf"B_{name.upper()}\[\] = \{{(.*?)\}};\n", h)
        if m:
            notes = [(int(a), int(b), int(d), s) for a, b, d, s in re.findall(r"\{(\d+), (\d+), (-?\d+), Shape::(\w+)\}", m.group(1))]
            out[name] = (notes, levels[name])
    return out


def tick(notes, level10, now):
    """snd::Player::tick() for a sound started at 0: (hz, amp) at `now` ms."""
    at, i = 0, 0
    while i < len(notes) and now - at >= notes[i][1]:
        at += notes[i][1]; i += 1
    if i == len(notes):
        return 0, 0.0
    hz, ms, db10, shape = notes[i]
    t, left = now - at, ms - (now - at)
    db = (level10 + db10) / 10
    if shape == "Hit":
        db -= 30 * t / ms
    if shape == "Swell":
        db -= 30 * (100 - t) / 100 if t < 100 else 30 * (t - 100) / (ms - 100 if ms > 100 else 1)
    amp = 10 ** (db / 20)
    if i == 0 and t < RAMP_MS:
        amp *= (t + 1) / RAMP_MS
    if i == len(notes) - 1 and left <= RAMP_MS:
        amp *= left / (RAMP_MS + 1)
    return hz, amp


def ledc(amp):
    """goal_app.cpp: duty_bp = lround(duty(amp x volume) x 10000); device.cpp: ledcWrite((2^13 - 1) x duty_bp / 10000)."""
    a = min(1.0, amp * 10 ** (VOLUME_DB / 20))
    bp = round(np.arcsin(a) / np.pi * 10000)
    return ((1 << BITS) - 1) * bp // 10000 / (1 << BITS)


def pulse(steps):
    """Band-limited pulse wave: steps = [(hz, duty)] per 1 ms; phase runs on across pitch changes (legato)."""
    n = S.SR // 1000
    out, phase = [], 0.0
    for hz, d in steps:
        if not hz or not d:
            out.append(np.zeros(n)); continue
        ph = phase + 2 * np.pi * hz * np.arange(n) / S.SR
        k = np.arange(1, int(20000 // hz) + 1)[:, None]          # harmonics up to 20 kHz: no aliasing
        x = (2 / (k * np.pi) * np.sin(k * np.pi * d) * np.cos(k * (ph - np.pi * d))).sum(0)
        out.append(x)
        phase = (phase + 2 * np.pi * hz * n / S.SR) % (2 * np.pi)
    return np.concatenate(out + [np.zeros(int(0.08 * S.SR))])   # room for the transducer's ring-out


def transducer(x):
    b, a = iirpeak(F0, 3, fs=S.SR)
    x = lfilter(b, a, x)
    for btype, fc in (("highpass", 1000), ("lowpass", 5000)):
        b, a = butter(2, fc, btype, fs=S.SR)
        x = lfilter(b, a, x)
    return x


def render(notes, level10):
    total = sum(ms for _, ms, _, _ in notes)
    steps = [(hz, ledc(amp)) for hz, amp in (tick(notes, level10, t) for t in range(total))]
    return transducer(pulse(steps)), steps


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    tab = table()
    assert "goal" in tab, "the scale is anchored on Goal"
    raw = {name: render(*tab[name]) for name in tab}
    g = S.db(-3) / np.max(np.abs(raw["goal"][0]))
    files = {f"{NAMES.index(n):02d}-{n}": (x * g).astype(np.float32) for n, (x, _) in raw.items()}
    kept = [f"{NAMES.index(n):02d}-{n}" for n in NAMES if n not in tab]     # the parked scoreboard's (see above)
    sounds = {b: files[b] if b in files else S.read(OUT / f"{b}.wav") for b in (f"{i:02d}-{n}" for i, n in enumerate(NAMES))}
    gap = np.zeros(S.SR, np.float32)
    tour = np.concatenate([np.concatenate([x, gap]) for x in sounds.values()])
    for base, x in list(files.items()) + [("tour", tour)]:
        w = OUT / f"{base}.wav"
        R.write(w, x)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(w), "-c:a", "libmp3lame", "-q:a", "2", str(w.with_suffix(".mp3"))], check=True)
    # self-check: the duty law and the lengths match the spec; everything fits and ends quiet
    assert ledc(10 ** (9 / 20)) > 0.499 and abs(np.arcsin(10 ** (-6 / 20)) / np.pi - 0.1676) < 1e-3
    for name, (x, steps) in raw.items():
        assert len(steps) == sum(ms for _, ms, _, _ in tab[name][0]), name
        assert steps[-1][1] < 0.02, name                          # the last 5 ms ramps out
    assert max(np.max(np.abs(x)) for x in sounds.values()) < 1
    goal_duty = max(d for _, d in raw["goal"][1])
    print(f"ok: {len(files)} buzzer sounds from the firmware + {len(kept)} kept ({', '.join(kept)}) + tour -> {OUT}"
          f"  (Goal's peak duty at Medium: {goal_duty:.1%})")
