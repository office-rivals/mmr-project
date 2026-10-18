"""Teaser audio: sound effects only (no voice, no music), synthesized by the goal-counter film's tools/sound.py.

    python3 tools/sound.py      # tools/cues.json -> assets/cues.js (cue times for index.html) + assets/audio/sfx.wav

cues.json "sfx" rows: [at, cue[:seconds], gain=1, repeat=1, step=0]; "at" is a cue name from "t", optionally "+/-seconds".
The mix is brought to the other films' loudness: about -14.5 LUFS integrated in the stereo MP4, -1.5 dBTP.
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "film/tools"))
import sound as S  # noqa: E402

LUFS, TP = -17.5, -1.5   # mono track; the MP4 plays it on both stereo channels, which measures +3 LU (-> -14.5)
cfg = json.loads((ROOT / "tools/cues.json").read_text())


def think():   # the server "thinks": dry relay/disk ticks on the light-blink grid (0.08 s) + three rising blips
    out = np.zeros(int(0.85 * S.SR), np.float32)
    for k in (0, 1, 2, 4, 5, 7, 8, 9):
        S.place(out, 0.5 * S.tone(2800, 0.012, 0.002, 0.0005) + 0.25 * S.tone(5200, 0.012, 0.001, 0.0005), k * 0.08)
    for t, f in ((0.16, 1568), (0.40, 2093), (0.64, 2637)):
        S.place(out, 0.6 * S.tone(f, 0.07, 0.03, 0.003), t)
    return out


def sneak(dur):   # the ball tiptoes up to the laser: soft low plucks
    out = np.zeros(int(dur * S.SR), np.float32)
    for k, f in enumerate((196, 247, 196, 247)):
        S.place(out, S.tone(f, 0.18, 0.06, 0.004) + 0.3 * S.tone(2 * f, 0.18, 0.03, 0.004), k * dur / 4)
    return out


def zip_(f0, f1, dur=0.16):   # a packet over Wi-Fi: a pure sine sweep
    t = np.arange(int(dur * S.SR)) / S.SR
    f = f0 + (f1 - f0) * t / dur
    return np.sin(2 * np.pi * np.cumsum(f) / S.SR) * np.minimum(1, np.minimum(t / 0.01, (dur - t) / 0.04))


# Foley for the gags (not board sounds), all tonal (no hiss). "name:arg" passes a duration.
SFX = dict(S.SFX, alarm=lambda: S.buzz(*[(1760, 110), (1319, 110)] * 3), think=think, sneak=sneak,
           zipup=lambda: zip_(900, 2400), zipdown=lambda: zip_(2400, 900))
T, total = cfg["t"], cfg["total"]


def at(spec):
    m = re.fullmatch(r"(\w+)([+-][\d.]+)?", spec)
    return T[m[1]] + float(m[2] or 0)


def loudness(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)[-1])


if __name__ == "__main__":
    (ROOT / "assets/cues.js").write_text(f"window.__T = {json.dumps(dict(T, total=total))};\n")
    buf = np.zeros(int(total * S.SR), np.float32)
    for row in cfg["sfx"]:
        spec, cue, gain, rep, step = (row + [1, 1, 0][len(row) - 2:])[:5]
        name, _, arg = cue.partition(":")
        clip = SFX[name](float(arg)) if arg else SFX[name]()
        clip = clip / (np.max(np.abs(clip)) or 1) * gain
        for k in range(rep):
            S.place(buf, clip, at(spec) + k * step)
    raw, out = ROOT / "assets/audio/sfx.raw.wav", ROOT / "assets/audio/sfx.wav"
    S.write(raw, buf / np.max(np.abs(buf)) * S.db(-1))
    # ponytail: one linear gain to the target loudness, then a hard peak guard; a limiter if square waves ever clip
    i, _ = loudness(raw)
    g = S.db(LUFS - i)
    x = S.read(raw) * g
    x = x * min(1, S.db(TP) / np.max(np.abs(x)))
    S.write(out, x); raw.unlink()
    i, p = loudness(out)
    assert i > LUFS - 2.5 and p <= TP + 0.1, (i, p)
    print(f"ok: sfx.wav {total} s, {len(cfg['sfx'])} cue rows, {i:.1f} LUFS, peak {p:.1f} dBFS; assets/cues.js")
