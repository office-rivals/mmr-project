"""Listenable previews of the scoreboard's sounds: each sound as WAV + MP3, plus a 'tour' (all in order, 1 s gaps),
in two versions:
    master/   full range, as designed
    speaker/  as a ~30-40 mm mini speaker plays it: band-limited ~300 Hz-8 kHz, small-speaker EQ, gentle limiting

    python3 tools/render.py [OUT_DIR]       # default: this folder (video/sounds)

The sounds come from earcons.py (EARCONS: ordered name -> mono float32 at 48 kHz): ux's own reference renders
(ux/sounds.py, local synthesis, nothing downloaded), used as-is so the preview is what the board will play.
"""
import subprocess, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "film/tools"))
import sound as S  # noqa: E402  (read(), SR)
import wave  # noqa: E402


def write(path, x):   # exact inverse of S.read (x * 32768), so ux's 16-bit masters round-trip bit for bit
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(S.SR)
        w.writeframes(np.clip(np.round(x * 32768), -32768, 32767).astype(np.int16).tobytes())

# ponytail: a generic small full-range driver (fs ~550 Hz bump, rolled-off lows and highs, slight presence, no compression);
# swap in the real speaker's measured curve once electronics picks the part.
SPEAKER = ",".join([
    "volume=-3dB",                                                # headroom for the EQ boosts, so the limiter never acts
    "highpass=f=300:poles=2", "highpass=f=300:poles=2",          # ~24 dB/oct below 300 Hz: no bass
    "equalizer=f=550:t=q:w=1.4:g=4",                              # the cone's resonance
    "equalizer=f=3000:t=q:w=1.0:g=2",                             # presence
    "lowpass=f=8000:poles=2", "lowpass=f=8000:poles=2",          # ~24 dB/oct above 8 kHz
    "alimiter=limit=0.89:level=false",                           # safety only: keeps ux's level steps
])


def render(earcons, out, gap=1.0):
    g = 1.0                                 # ux's masters as they are (levels included); the master WAVs are bit-identical
    for ver in ("master", "speaker"):
        (out / ver).mkdir(parents=True, exist_ok=True)
    silence = np.zeros(int(gap * S.SR), np.float32)
    tour = np.concatenate([np.concatenate([x * g, silence]) for x in earcons.values()])
    items = dict(earcons, **{"tour": None})
    for i, name in enumerate(items):
        base = f"{i:02d}-{name}" if name != "tour" else "tour"
        m = out / "master" / f"{base}.wav"
        write(m, tour if name == "tour" else earcons[name] * g)
        sp = out / "speaker" / f"{base}.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(m), "-af", SPEAKER, "-ar", str(S.SR), "-ac", "1", str(sp)], check=True)
        for w in (m, sp):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(w), "-c:a", "libmp3lame", "-q:a", "2", str(w.with_suffix(".mp3"))], check=True)
    return len(earcons)


if __name__ == "__main__":
    from earcons import EARCONS
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent
    n = render(EARCONS, out)
    # self-check: every file exists and decodes, the tour is the sum of the parts + gaps
    for ver in ("master", "speaker"):
        files = sorted((out / ver).glob("*.mp3"))
        assert len(files) == n + 1, (ver, len(files))
    tour = S.read(out / "master/tour.wav")
    assert abs(len(tour) - sum(len(x) + S.SR for x in EARCONS.values())) < 10
    print(f"ok: {n} sounds + tour, master/ and speaker/ (WAV + MP3) -> {out}")
