"""Sounds preview: cue data for index.html + the sound track, for one version.

    python3 tools/build.py master|speaker|buzzer    # -> assets/cues.js, assets/audio/track.wav

The sounds are ../<version>/NN-<name>.wav: tools/render.py (ux's reference WAVs, as-is or through the
mini-speaker model) or tools/buzzer.py (the fallback buzzer), placed at the cue times without any level change.
"""
import json, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOUNDS = ROOT.parent
sys.path.insert(0, str(SOUNDS / "tools"))
import render as R  # noqa: E402  (exact 16-bit write)
from render import S  # noqa: E402
from earcons import EARCONS  # noqa: E402

TAGS = {"master": "FULL RANGE", "speaker": "MINI SPEAKER · 30–40 mm", "buzzer": "BUZZER (fallback)"}
SUBS = {"master": "Seven sounds, one family. A proposal by ux.", "speaker": "Seven sounds, one family. A proposal by ux.",
        "buzzer": "The fallback: the same family on the buzzer, one tone at a time."}


def wav(ver, name):
    i = list(EARCONS).index(name)
    return S.read(SOUNDS / ver / f"{i:02d}-{name}.wav")


def envelope(x, span=1.5, bins=150):   # |x| peaks in fixed time bins, so a longer sound draws wider
    n = int(span * S.SR / bins)
    x = np.pad(x, (0, max(0, bins * n - len(x))))[: bins * n]
    return [round(float(v), 4) for v in np.abs(x).reshape(bins, n).max(1)]


if __name__ == "__main__":
    ver = sys.argv[1]
    c = json.loads((ROOT / "tools/cues.json").read_text())
    plays = [(c["card0"] + i * c["card_step"] + c["card_sound"], k[0]) for i, k in enumerate(c["cards"])]
    plays += [(t, s) for t, _, s, _ in c["story"] if s]
    buf = np.zeros(int(c["total"] * S.SR), np.float32)
    plays.sort()
    for (t, name), nxt in zip(plays, plays[1:] + [(c["total"], None)]):
        x = wav(ver, name)[: int((nxt[0] - t) * S.SR)].copy()   # a new sound cuts the old one with a 5 ms fade (spec rule 2)
        f = min(len(x), int(0.005 * S.SR)); x[len(x) - f:] *= np.linspace(1, 0, f)
        i = int(t * S.SR); buf[i:i + len(x)] += x
    (ROOT / "assets/audio").mkdir(parents=True, exist_ok=True)
    R.write(ROOT / "assets/audio/track.wav", buf)
    clips = {k: wav(ver, k) for k in EARCONS}
    env = {k: envelope(x) for k, x in clips.items()}
    if ver == "buzzer":   # the cards name the buzzer's own notes
        c["cards"] = [[k, name, what, c["music_buzzer"][k]] for k, name, what, _ in c["cards"]]
    peak = max(max(v) for v in env.values())
    data = dict(c, version=ver, tag=TAGS[ver], sub=SUBS[ver], plays=plays, durs={k: len(v) / S.SR for k, v in clips.items()},
                env={k: [round(v / peak, 3) for v in e] for k, e in env.items()})
    (ROOT / "assets/cues.js").write_text(f"window.__P = {json.dumps(data, ensure_ascii=False)};\n")
    assert np.max(np.abs(buf)) < 1, "clipping"
    print(f"ok: {ver}: {len(plays)} sounds placed, {c['total']} s -> assets/audio/track.wav, assets/cues.js")
