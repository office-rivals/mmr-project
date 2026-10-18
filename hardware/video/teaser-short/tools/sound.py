"""The short teaser's sound: effects only (no voice, no music), from the goal-counter film's synthesizers.

    python3 tools/sound.py      # -> assets/cues.js (cue times for index.html) + assets/audio/sfx.wav

T holds every cue time; index.html reads the same times from assets/cues.js, so each picture lands with its sound.
About -16 LUFS (the long teaser: -14.5) in the stereo MP4, -1.5 dBTP.
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "film/tools"))
import sound as S  # noqa: E402

LUFS, TP = -19.0, -1.5   # mono; the MP4 plays it on both channels (+3 LU -> -16): sparse and dark, so a little under the long teaser
T = dict(
    beam=0.5,                       # IR beam flickers on: on/off/on/off/on
    shadow=1.55, cross=2.05,        # the ball's shadow comes up the tunnel and breaks the beam: ding
    paper=2.75, refresh=3.2, snap=3.5,  # e-paper sliver at 9:7; refresh flashes; 10:7
    key=4.3, glow=4.55,             # one key; its light comes on
    badge=5.5, tap=5.95, joined=6.2,    # a badge tapped on the plate
    black=6.85,                     # hard cut to black, silence
    title=7.35, end=9.2, total=11.0,
)
FLICKER = [0, 0.08, 0.16, 0.22, 0.3]   # beam on at even steps, off at odd ones (relative to T.beam)


def drone(dur):   # a low, slow-breathing sine chord under the dark shots; cut hard at the black
    t = np.arange(int(dur * S.SR)) / S.SR
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((55, 1), (82.4, 0.5), (110, 0.35), (164.8, 0.12)))
    breath = 0.8 + 0.2 * np.sin(2 * np.pi * 0.35 * t)
    return x * breath * np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 0.01)


def tick():       # an electrical tick as the beam strikes
    return 0.6 * S.tone(3200, 0.06, 0.004, 0.0005) + 0.4 * S.tone(120, 0.06, 0.02, 0.001)


def swell(f=880, dur=0.9):   # the key light warming up: a soft rising sine
    t = np.arange(int(dur * S.SR)) / S.SR
    return np.sin(2 * np.pi * (f * t + 30 * t * t)) * np.minimum(1, t / 0.35) * np.exp(-np.maximum(0, t - 0.35) / 0.2)


ROWS = [  # (time, clip, gain)
    (0, drone(T["black"]), 0.5),
    *[(T["beam"] + d, tick(), 0.5) for d in FLICKER[::2]],
    (T["shadow"], S.sfx_roll(0.6), 0.35),
    (T["cross"], S.earcon("goal"), 1.0),
    *[(T["refresh"] + d, S.sfx_key(), 0.45) for d in (0, 0.12, 0.22)],
    (T["snap"], S.sfx_thud(), 0.8),
    (T["glow"] - 0.2, S.sfx_key(), 0.5),
    (T["glow"], swell(), 0.25),
    (T["tap"], S.earcon("scan"), 1.0),
    (T["joined"], S.earcon("joined"), 0.8),
    (T["title"], S.sfx_thud(), 1.0),
    (T["end"], S.sfx_ding(), 0.35),
]


def loudness(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)[-1])


if __name__ == "__main__":
    (ROOT / "assets/cues.js").write_text(f"window.__T = {json.dumps(dict(T, flicker=FLICKER))};\n")
    buf = np.zeros(int(T["total"] * S.SR), np.float32)
    for at, clip, gain in ROWS:
        S.place(buf, clip / (np.max(np.abs(clip)) or 1) * gain, at)
    assert not buf[int(T["black"] * S.SR) + 50:int(T["title"] * S.SR)].any(), "the black must be silent"
    raw, out = ROOT / "assets/audio/sfx.raw.wav", ROOT / "assets/audio/sfx.wav"
    S.write(raw, buf / np.max(np.abs(buf)) * S.db(-1))
    i, _ = loudness(raw)
    x = S.read(raw) * S.db(LUFS - i)
    x = x * min(1, S.db(TP) / np.max(np.abs(x)))   # ponytail: linear gain + peak guard, as in the long teaser
    S.write(out, x); raw.unlink()
    i, p = loudness(out)
    if p > TP:   # true peak sits above the sample peak: take the difference off once
        S.write(out, S.read(out) * S.db(TP - 0.1 - p)); i, p = loudness(out)
    assert i > LUFS - 2.5 and p <= TP + 0.1, (i, p)
    print(f"ok: sfx.wav {T['total']} s, {len(ROWS)} rows, {i:.1f} LUFS, peak {p:.1f} dBFS; assets/cues.js")
