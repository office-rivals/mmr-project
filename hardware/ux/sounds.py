# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Scoreboard earcons v2: the reference render of SOUNDS-V2.md (one source for previews and samples).

    uv run sounds.py      # self-check + out/sounds/<name>.wav (48 kHz mono 16-bit) + family.wav

Every number here is the spec. Video renders previews from these WAVs (or re-synthesises from the
table); firmware converts them to the speaker's sample format. Notes are D major pentatonic, A4 = 440.
BUZZER is the fallback build's version of the same family: one square-wave tone at a time (no WAVs).
"""
import wave
from pathlib import Path

import numpy as np

RATE = 48_000
KEY = {"D": 2, "E": 4, "F#": 6, "A": 9, "B": 11}         # D major pentatonic, semitones above C
REF_PEAK_DBFS = -3.0                                       # Goal's peak; every level below is relative to it
TRANSPOSE = 0                                              # speaker calibration knob: +5 = up a fourth (to G) if the
                                                           # speaker is > 10 dB down at 600-700 Hz on the bench


def hz(note):
    name, octave = note[:-1], int(note[-1])
    assert name in KEY, f"{note} is outside the key"
    return 440.0 * 2 ** ((KEY[name] - 9) / 12 + octave - 4)


# Voices: attack ms (raised cosine, never a click), partials (ratio, amplitude, decay factor of t40).
# "bell": warm mallet with a faint inharmonic glint (4.07), the family's main voice.
# "felt": the same mallet, darker (no glint, weaker 2nd): undo / not joined.
# "tick": very short, for the scan receipt; plus a 3 ms noise click (the tactile part).
# "pad":  slow swell, two unequal copies detuned +-2 cents (a slow shimmer, never a full-depth warble).
VOICES = {
    "bell": (5, [(1, 1.0, 1.0), (2, 0.30, 0.5), (3, 0.10, 0.33), (4.07, 0.08, 0.12)]),
    "felt": (8, [(1, 1.0, 1.0), (2, 0.25, 0.5)]),
    "tick": (1.5, [(1, 1.0, 1.0), (2, 0.20, 0.5)]),
    "pad": (60, [(1, 1.0, 1.0), (2, 0.15, 0.8)]),
}

# name: (relative level dB at the peak, total ms, [(start ms, note, voice, note dB, t40 ms)]).
# t40 = time for that note to fall 40 dB. The total includes the tail; the last 20 ms fade out.
SOUNDS = {
    "goal": (0, 450, [(0, "A5", "bell", -3, 200), (70, "D6", "bell", 0, 380), (70, "D7", "bell", -16, 150)]),
    "won": (2, 1400, [(0, "A5", "bell", -3, 200), (70, "D6", "bell", 0, 300), (140, "F#6", "bell", -1, 300),
                      (210, "A6", "bell", -2, 300),
                      (300, "D6", "bell", -4, 1000), (300, "F#6", "bell", -4, 1000), (300, "A6", "bell", -4, 1000),
                      (300, "D7", "bell", -14, 400), (300, "D5", "pad", -10, 1100), (300, "A5", "pad", -10, 1100)]),
    "undo": (-4, 450, [(0, "D6", "felt", 0, 220), (120, "A5", "felt", -2, 320)]),
    "scan": (-10, 70, [(0, "D7", "tick", 0, 60)]),
    "joined": (-6, 350, [(0, "F#6", "bell", -2, 120), (45, "A6", "bell", -1, 120), (90, "D7", "bell", 0, 260)]),
    "not_joined": (-8, 200, [(0, "E5", "felt", 0, 180), (0, "B5", "felt", -4, 160)]),
    "saved": (-10, 650, [(0, "D6", "pad", 0, 600), (0, "F#6", "pad", -2, 600), (30, "A6", "bell", -16, 300)]),
}
CAP_MS = {"won": 1500}                 # every other sound <= 700 ms


def render(name):
    level, total, notes = SOUNDS[name]
    out = np.zeros(int(RATE * total / 1000))
    for start, note, voice, db, t40 in notes:
        attack, partials = VOICES[voice]
        t = np.arange(len(out) - int(RATE * start / 1000)) / RATE
        rise = np.clip(t / (attack / 1000), 0, 1)
        env = 0.5 - 0.5 * np.cos(np.pi * rise)
        tone = np.zeros_like(t)
        for ratio, amp, decay in partials:
            k = np.log(100) / (t40 / 1000 * decay)              # -40 dB after t40 * decay
            for cents, share in (((-2, 0.62), (2, 0.38)) if voice == "pad" else ((0, 1),)):
                f = hz(note) * ratio * 2 ** ((cents + 100 * TRANSPOSE) / 1200)
                tone += share * amp * np.exp(-k * t) * np.sin(2 * np.pi * f * t)
        if voice == "tick":
            n = int(RATE * 0.003)
            click = np.random.default_rng(1).standard_normal(n) * np.hanning(n)
            tone[:n] += 0.12 * np.diff(click, prepend=0)        # differentiated noise = bright, no low thump
        out[len(out) - len(t):] += 10 ** (db / 20) * env * tone
    fade = int(RATE * 0.02)
    out[-fade:] *= np.linspace(1, 0, fade)
    return out / np.abs(out).max() * 10 ** ((REF_PEAK_DBFS + level) / 20)


# Buzzer fallback (CMT-1209, resonant at 2048 Hz): same notes and contours, moved up near 2 kHz.
# name: (level dB, [(note, ms, note dB, shape)]), notes back to back (legato: the frequency changes
# without a gap). Shapes: "hold" = steady; "hit" = falls to -30 dB by its end; "swell" = rises over
# 100 ms, then falls to -30 dB by its end. The first note starts with a 5 ms ramp; the last ends with one.
_ROLL = [(n, 30, -30 * i / 20, "hold") for i, n in enumerate(["A6", "D7", "F#7"] * 7)]   # the Won chord, rolled
BUZZER = {
    "goal": (0, [("A6", 60, -2, "hold"), ("D7", 160, 0, "hit")]),
    "won": (0, [("A6", 60, -2, "hold"), ("D7", 60, 0, "hold"), ("F#7", 60, 0, "hold")] + _ROLL),
    "undo": (-4, [("D7", 100, 0, "hold"), ("A6", 200, -2, "hit")]),
    "scan": (-10, [("D7", 30, 0, "hit")]),
    "joined": (-6, [("F#6", 35, -2, "hold"), ("A6", 35, -1, "hold"), ("D7", 100, 0, "hit")]),
    "not_joined": (-8, [("E6", 140, 0, "hit")]),
    "saved": (-10, [("D7", 400, 0, "swell")]),
}
BUZZER_CAP_MS = {"won": 1000}          # every other buzzer sound <= 450 ms


def duty(db):
    """dB (sound + note + volume) -> PWM duty: the square wave's fundamental scales with sin(pi * duty)."""
    return float(np.arcsin(min(1.0, 10 ** (db / 20))) / np.pi)


def write(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(RATE)
        w.writeframes((x * 32767).astype("<i2").tobytes())


if __name__ == "__main__":
    out = Path(__file__).parent / "out/sounds"
    out.mkdir(parents=True, exist_ok=True)
    gap = np.zeros(int(RATE * 0.6))
    family = []
    for name, (level, total, notes) in SOUNDS.items():
        x = render(name)
        assert total <= CAP_MS.get(name, 700), name
        assert all(hz(n) >= 587 for _, n, *_ in notes), name                      # small speaker: nothing below D5
        assert abs(20 * np.log10(np.abs(x).max()) - (REF_PEAK_DBFS + level)) < 0.01 and np.abs(x).max() < 1, name
        assert abs(x[-1]) < 1e-3, name                                             # ends in silence, no click
        write(out / f"{name}.wav", x)
        family += [x, gap]
    write(out / "family.wav", np.concatenate(family))
    assert max(SOUNDS[n][0] for n in SOUNDS) == SOUNDS["won"][0]                  # Won is the loudest, once a game
    assert BUZZER.keys() == SOUNDS.keys()
    for name, (level, notes) in BUZZER.items():
        assert sum(ms for _, ms, *_ in notes) <= BUZZER_CAP_MS.get(name, 450), name
        assert all(1300 <= hz(n) <= 3000 for n, *_ in notes), name                # near the 2048 Hz resonance
    assert duty(0) == 0.5 and abs(duty(-6) - 0.1676) < 1e-3 and duty(-200) < 1e-4
    size = sum(SOUNDS[n][1] for n in SOUNDS) / 1000 * 22_050 * 2
    print(f"ok: {len(SOUNDS)} sounds -> {out}/  (all at 22.05 kHz 16-bit: {size / 1024:.0f} KiB)")
