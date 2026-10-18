"""Build the three audio tracks from assets/audio/timing.json (written by retime.py).

  assets/audio/<lang>/vo.wav     every VO line placed at its time
  assets/audio/<lang>/sfx.wav    synthesized SFX (no samples: all generated here)
  assets/audio/<lang>/music.wav  generated pizzicato bed, ducked under the VO, silent before the punchline

Everything is synthesized by this script (seeded, deterministic), so the audio carries no third-party licence.
    python3 tools/sound.py en            # build assets/audio/<lang>/{vo,sfx,music}.wav
    python3 tools/sound.py en --check    # self-check: levels + ducking
"""
import json, subprocess, sys, wave
from pathlib import Path
import numpy as np
from vo import ROOT
A = ROOT / "assets/audio"  # per language: set in main()
SR = 48000
rng = np.random.default_rng(7)

# Levels (peak, dBFS). The VO is always the loudest thing.
VO_PEAK, SFX_PEAK = -3.0, -12.0
MUSIC_FREE, MUSIC_UNDER_VO = -12.0, -23.0   # music peak level between / under VO lines
db = lambda x: 10 ** (x / 20)


def read(p):
    with wave.open(str(p)) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, p
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def write(p, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def place(buf, clip, t):
    i = int(t * SR)
    n = min(len(clip), len(buf) - i)
    if n > 0:
        buf[i:i + n] += clip[:n]


def env(n, attack=0.002, decay=0.1):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def noise(n):
    return rng.standard_normal(n).astype(np.float32)


def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):  # ponytail: per-sample one-pole; fine for short SFX
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y


def tone(f, dur, decay, attack=0.002):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * env(n, attack, decay)


# ---- SFX -----------------------------------------------------------------------------
def sfx_click():   # wooden bead snapping home
    n = int(0.06 * SR)
    return 0.6 * tone(2400, 0.06, 0.012) + 0.5 * lowpass(noise(n), 3000) * env(n, 0.0005, 0.006)

def sfx_key():
    n = int(0.05 * SR)
    return 0.5 * tone(1500, 0.05, 0.008) + 0.4 * lowpass(noise(n), 5000) * env(n, 0.0005, 0.004)

def sfx_thud():
    n = int(0.3 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (95 - 40 * t / 0.3) * t) * env(n, 0.003, 0.08) + 0.2 * lowpass(noise(n), 400) * env(n, 0.001, 0.03)

def sfx_bip():     # the beam: a clean little "bip"
    return tone(1760, 0.11, 0.05, 0.003) + 0.25 * tone(3520, 0.11, 0.03, 0.003)

def sfx_roll(dur):  # ball on wood: low rumble with a fast flutter
    n = int(dur * SR); t = np.arange(n) / SR
    x = lowpass(noise(n), 260) * (0.7 + 0.3 * np.sin(2 * np.pi * 17 * t))
    fade = np.minimum(1, np.minimum(t / 0.15, (dur - t) / 0.2))
    return 3.0 * x * fade

def sfx_rattle():  # table bump: a few loose clicks
    out = np.zeros(int(0.5 * SR), np.float32)
    for k, dt in enumerate([0.0, 0.06, 0.13, 0.17, 0.26, 0.31, 0.42]):
        place(out, (0.7 if k % 2 else 1.0) * sfx_key(), dt)
    return out

def sfx_whoosh():
    n = int(0.5 * SR); t = np.arange(n) / SR
    x = noise(n); y = np.empty_like(x); acc = 0.0
    for i in range(n):  # cutoff sweeps up then down
        fc = 400 + 3600 * np.sin(np.pi * t[i] / 0.5)
        a = np.exp(-2 * np.pi * fc / SR); acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return y * np.sin(np.pi * t / 0.5) ** 2

def sfx_ding():
    return tone(1318.5, 1.0, 0.35, 0.002) + 0.35 * tone(2637, 1.0, 0.18) + 0.12 * tone(3956, 1.0, 0.1)

def sfx_pop():
    n = int(0.08 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (650 - 4500 * t) * t) * env(n, 0.001, 0.025)

def buzz(*notes):
    """Square-wave buzzer notes, (Hz, ms) with (0, ms) = gap (the teaser's vault alarm gag)."""
    out = []
    for f, ms in notes:
        n = int(ms / 1000 * SR); t = np.arange(n) / SR
        ramp = np.minimum(1, np.minimum(t, ms / 1000 - t) / 0.002)
        out.append(np.sign(np.sin(2 * np.pi * f * t)) * ramp if f else np.zeros(n))
    return lowpass(np.concatenate(out).astype(np.float32), 7000)

# The board's own sounds: ux's v2 earcons (ux/SOUNDS-V2.md), ux's reference WAVs as they are (`cd ux && uv run
# sounds.py`), scaled so Goal = 1. build() keeps their relative levels (Won +2 dB, Scan -10 dB, ...).
UX_SOUNDS = Path(__file__).resolve().parents[3] / "ux/out/sounds"
EARCONS = {"goal": "goal", "won": "won", "undo": "undo", "scan": "scan", "joined": "joined", "notjoined": "not_joined", "saved": "saved"}


def earcon(name):
    return read(UX_SOUNDS / f"{name}.wav") / db(-3)   # ux masters: Goal peaks at -3 dBFS


# The goal counter's own buzzer (phase 1): ux's BUZZER sounds as the CMT-1209 plays them (video/sounds/tools/buzzer.py),
# scaled so its Goal = 1 like the earcons, so build() keeps their relative levels too.
BUZZER_DIR = Path(__file__).resolve().parents[2] / "sounds/buzzer"
BUZZER = {"bzgoal": "00-goal", "bzundo": "02-undo", "bzscan": "03-scan", "bzno": "05-not_joined"}
EARCONS = {**EARCONS, **{cue: None for cue in BUZZER}}   # not normalised per clip (see build())


def buzzer(name):
    return read(BUZZER_DIR / f"{name}.wav") / db(-3)   # buzzer.py: Goal peaks at -3 dBFS


SFX = {"click": sfx_click, "key": sfx_key, "thud": sfx_thud, "bip": sfx_bip, "roll": sfx_roll,
       "rattle": sfx_rattle, "whoosh": sfx_whoosh, "ding": sfx_ding, "pop": sfx_pop,
       **{cue: (lambda f=f: earcon(f)) for cue, f in EARCONS.items() if f},
       **{cue: (lambda f=f: buzzer(f)) for cue, f in BUZZER.items()}}


# ---- music: Karplus-Strong pizzicato over C - Am - F - G at 96 bpm -----------------------
def pluck(f, dur, damp=0.996, bright=0.5):
    N = max(2, int(SR / f)); n = int(dur * SR)
    y = np.zeros(n + N, np.float32)
    y[:N] = lowpass(rng.uniform(-1, 1, N).astype(np.float32), 2000 + 6000 * bright)
    for k in range(1, (n + N) // N):  # vectorised per period
        a, b = k * N, min((k + 1) * N, n + N)
        prev = y[a - N:b - N]; nxt = y[a - N + 1:b - N + 1] if b - N + 1 <= len(y) else prev
        m = min(len(prev), len(nxt))
        y[a:a + m] = damp * 0.5 * (prev[:m] + nxt[:m])
    return y[N:N + n] * env(n, 0.003, dur)

def note(m):
    return 440 * 2 ** ((m - 69) / 12)

def music(total):
    beat = 60 / 96; bar = 4 * beat
    chords = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]]   # C Am F G (bass + triad)
    out = np.zeros(int((total + 2) * SR), np.float32)
    motif = [0, None, 2, 1, None, 3, 2, None]  # eighth-note slots -> chord-tone index (None = rest)
    nbars = int(np.ceil(total / bar))
    for b in range(nbars):
        bass, *tri = chords[b % 4]; t0 = b * bar
        place(out, 0.9 * pluck(note(bass), 1.4, 0.995, 0.2), t0)
        place(out, 0.6 * pluck(note(bass + 12 if b % 2 else bass), 0.9, 0.994, 0.2), t0 + 2 * beat)
        if b == 0:
            continue  # intro bar: bass only
        for k, idx in enumerate(motif):
            if idx is None or rng.random() < 0.25:
                continue
            m = tri[idx % 3] + 12 + (12 if idx == 3 else 0)
            place(out, 0.35 * pluck(note(m), 0.5, 0.993, 0.6), t0 + k * beat / 2 + rng.uniform(-0.008, 0.008))
    # final chord, let it ring
    fin = max(0.0, total - 2.4)
    for m in [48, 60, 64, 67, 72]:
        place(out, 0.5 * pluck(note(m), 2.4, 0.997, 0.4), fin)
    return out[: int(total * SR)]


def smooth(mask, sec):
    k = max(1, int(sec * SR)); kern = np.ones(k) / k
    return np.convolve(mask, kern, mode="same")


def duck_curve(n, vo, silence):
    under = np.zeros(n, np.float32)
    for v in vo:
        under[int((v["start"] - 0.15) * SR): int((v["end"] + 0.25) * SR)] = 1
    g_db = MUSIC_FREE + (MUSIC_UNDER_VO - MUSIC_FREE) * smooth(under, 0.3)
    g = db(g_db).astype(np.float32)
    mute = np.zeros(n, np.float32)
    for a, b in silence:
        mute[int(a * SR): int(b * SR)] = 1
    return g * (1 - smooth(mute, 0.4))


def norm(x, peak_db):
    p = np.max(np.abs(x)) or 1.0
    return x * (db(peak_db) / p)


def build():
    T = json.loads((A / "timing.json").read_text())
    n = int(T["total"] * SR)
    vo = np.zeros(n, np.float32)
    for v in T["vo"]:
        place(vo, read(A / "vo" / f"{v['id']}.wav"), v["start"])
    vo = norm(vo, VO_PEAK)
    sfx = np.zeros(n, np.float32)
    for c in T["sfx"]:
        clip = SFX[c["cue"]](c["dur"]) if c["dur"] else SFX[c["cue"]]()
        place(sfx, clip if c["cue"] in EARCONS else clip / (np.max(np.abs(clip)) or 1), c["t"])
    sfx = norm(sfx, SFX_PEAK)
    m = music(T["total"])
    m = m / (np.max(np.abs(m)) or 1) * duck_curve(n, T["vo"], T["silence"])
    write(A / "vo.wav", vo); write(A / "sfx.wav", sfx); write(A / "music.wav", m)
    # Speech to web loudness (-16 LUFS, -1.5 dBTP); music/SFX levels above are set relative to it.
    tmp = A / "vo.norm.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(A / "vo.wav"), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", str(SR), "-ac", "1", str(tmp)], check=True)
    tmp.replace(A / "vo.wav")
    return T, vo, sfx, m


def check():
    T = json.loads((A / "timing.json").read_text())
    vo, sfx, m = (read(A / f) for f in ("vo.wav", "sfx.wav", "music.wav"))
    peak = lambda x: 20 * np.log10(np.max(np.abs(x)) + 1e-9)
    assert peak(sfx) < peak(vo) and peak(m) < peak(vo), "SFX/music must stay under the VO"
    v = T["vo"][len(T["vo"]) // 2]
    mid = int((v["start"] + v["end"]) / 2 * SR)
    assert np.max(np.abs(m[mid - SR // 4: mid + SR // 4])) <= db(MUSIC_UNDER_VO) * 1.05, "music not ducked under VO"
    for a, b in T["silence"]:
        c = int((a + b) / 2 * SR)
        assert np.max(np.abs(m[c - SR // 10: c + SR // 10])) < db(-60), "punchline silence not silent"
    print(f"ok: vo {peak(vo):.1f} dBFS, sfx {peak(sfx):.1f}, music {peak(m):.1f}; ducked and silent where asked")


if __name__ == "__main__":
    A = ROOT / "assets/audio" / sys.argv[1]
    if "--check" in sys.argv:
        check()
    else:
        T, *_ = build(); print(f"built {T['total']} s: vo.wav sfx.wav music.wav"); check()
