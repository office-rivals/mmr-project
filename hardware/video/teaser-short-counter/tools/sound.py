"""The goal-counter short teaser's sound: effects only (no voice, no music), from the goal-counter film's synthesizers.

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
    shadow=1.35, cross=1.85,        # a ball's shadow comes up the tunnel and breaks the beam: the counter's chirp
    shadow2=2.55, cross2=2.9,       # a second one, faster: chirp
    black=3.9,                      # hard cut to black, silence
    title=4.4, end=6.3, total=8.2,
)
FLICKER = [0, 0.08, 0.16, 0.22, 0.3]   # beam on at even steps, off at odd ones (relative to T.beam)


def drone(dur):   # a low, slow-breathing sine chord under the dark shots; cut hard at the black
    t = np.arange(int(dur * S.SR)) / S.SR
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((55, 1), (82.4, 0.5), (110, 0.35), (164.8, 0.12)))
    breath = 0.8 + 0.2 * np.sin(2 * np.pi * 0.35 * t)
    return x * breath * np.minimum(1, t / 1.2) * np.minimum(1, (dur - t) / 0.01)


def tick():       # an electrical tick as the beam strikes
    return 0.6 * S.tone(3200, 0.06, 0.004, 0.0005) + 0.4 * S.tone(120, 0.06, 0.02, 0.001)


ROWS = [  # (time, clip, gain)
    (0, drone(T["black"]), 0.5),
    *[(T["beam"] + d, tick(), 0.5) for d in FLICKER[::2]],
    (T["shadow"], S.sfx_roll(0.6), 0.35),
    (T["cross"], S.buzzer("00-goal"), 1.0),        # the goal counter's own buzzer (CMT-1209 model), not a speaker
    (T["shadow2"], S.sfx_roll(0.4), 0.35),
    (T["cross2"], S.buzzer("00-goal"), 1.0),
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
