"""The two UI flow films' timing and sound, from admin-ui's recorded steps.

    python3 tools/build.py player|admin   # -> <film>/assets/cues.js (window.__T) + <film>/assets/audio/sfx.wav

The footage is one continuous recording (assets/footage/<film>-flow.json: [{step, t_action, t_settled}], seconds in the
clip). Film time = INTRO + clip time, so every caption and sound below is placed from a step's own time: a caption
lands with its step (or up to 0.3 s before it), a counter's chirp just before the phone shows the goal (it plays at
the table first). Sounds: the goal counter's own buzzer (video/sounds/buzzer), soft taps, a quiet music bed.
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent / "film/tools"))
import sound as S  # noqa: E402

LUFS, TP = -19.0, -1.5   # mono; the MP4 plays it on both channels (+3 LU -> about -16)
BED = {"player": 0.16, "admin": 0.6}   # the music bed's peak against the loudest sound (admin has only clicks)
INTRO, OUTRO = 4.0, 4.5


def steps(film):
    rows = json.loads((HERE / f"assets/footage/{film}-flow.json").read_text())
    return rows, {r["step"]: r for r in rows}


def player():
    rows, st = steps("player")
    a = lambda name: INTRO + st[name]["t_action"]   # noqa: E731
    goals = [INTRO + r["t_action"] for r in rows if r["step"].startswith("6 goal-")]
    picks = [INTRO + r["t_action"] for r in rows if r["step"].startswith("7 pick")]
    caps = [  # [film time in, kicker, line]; each runs until the next one
        [INTRO + 0.2, "01 · SCAN", "Tap the sticker: the live score."],
        [a("2 goal for Red") - 0.3, "02 · GOAL", "A goal: a chirp, a pulse."],
        [a("2b 20 s later") - 0.2, "02 · GOAL", "The last goal, and when."],
        [a("3 counter undo") - 1.6, "03 · UNDO", "Wrong goal? Hold the counter's key."],
        *([[a("4 phone undo") - 0.3, "03 · UNDO", "Or undo it on the phone."]] if "4 phone undo" in st else []),   # removed (user)
        [a("5 new game sheet") - 0.3, "04 · NEW GAME", "Save it, or throw it away."],
        [goals[0] - 0.3, "05 · PLAY", "First to ten."],
        [a("6 win: saving") - 0.2, "05 · PLAY", "Game over: saving in seconds."],
        [a("6 saved") - 0.3, "05 · PLAY", "Saved to MMR."],
        [a("7 table 2: who played?") - 0.3, "06 · WHO PLAYED?", "No players yet? Pick them."],
        [a("7 save") - 0.3, "06 · WHO PLAYED?", "Save: the game is rated."],
    ]
    taps = [a(k) for k in ("4 phone undo",) if k in st] + [a("5 new game sheet"), a("5b cancel"), *picks, a("7 save"), a("7 table 2: who played?")]
    hold = a("3 counter undo") - 1.5   # the player holds the counter's key for 1 s; the undo sound, then the phone
    T = dict(intro=INTRO, chirps=[a("2 goal for Red") - 0.3] + [g - 0.3 for g in goals],
             hold=hold, undo=hold + 1.0, taps=taps, caps=caps, end=INTRO + rows[-1]["t_settled"] + 2.8)
    sfx = [(t, S.buzzer("00-goal"), 1.0) for t in T["chirps"]]
    sfx += [(hold, S.sfx_key(), 0.6), (hold, S.buzzer("03-scan"), 0.5), (T["undo"], S.buzzer("02-undo"), 0.9)]
    sfx += [(t, S.sfx_click(), 0.35) for t in taps]
    sfx += [(INTRO - 0.9, S.sfx_bip(), 0.4)]   # the sticker's NFC tap
    return T, sfx


def admin():
    rows, st = steps("admin")
    a = lambda name: INTRO + st[name]["t_action"]   # noqa: E731
    caps = [
        [INTRO + 0.2, "01 · CLAIM", "A new goal counter checks in."],
        [a("1 guarded by White") - 0.3, "01 · CLAIM", "Whose goalkeeper guards this goal?"],
        [a("1 claim → already guarded") - 0.2, "01 · CLAIM", "One counter per goal."],
        [a("1 pick Table 3") - 0.3, "01 · CLAIM", "Pick the free goal. Claim."],
        [a("2 edit Table 3") - 0.3, "02 · LEAGUE · TEAMS", "One league, two different team names."],
        [a("3 overview banner") - 0.3, "03 · HEALTH", "Trouble shows up first."],
        [a("3 Table 1 rows") - 0.3, "03 · HEALTH", "Every device, its health."],
        [a("4 beam settings") - 0.3, "04 · BEAM", "Tune the beam per device."],
        [a("4 edit Table 1") - 0.3, "05 · SOUND", "Table sound: off to high."],
        [a("5 Table 2 unclaimed match") - 0.3, "06 · MATCHES", "Games waiting for players."],
    ]
    clicks = [INTRO + r["t_action"] for r in rows if any(k in r["step"] for k in
              ("claim", "pick", "guarded", "edit", "save", "fix", "→ device", "mode", "advanced", "sound"))]
    # zoom-ins on the page, from one step to another: [film from, film to, page x, page y (1280 x 800), scale]; each
    # centre is chosen so the whole control stays in view (checked on the frames)
    zooms = [[a("1 guarded by White") - 0.3, a("1 pick Table 3") - 0.2, 1248, 330, 1.3],     # question, live line, error
             [a("2 clash") - 0.1, a("2 fix + save") - 0.1, 1280, 430, 1.6],                  # League + both team fields + error
             [a("5 Table 2 unclaimed match") + 0.2, INTRO + rows[-1]["t_settled"] + 2.6, 652, 420, 1.8]]
    T = dict(intro=INTRO, caps=caps, clicks=clicks, zooms=zooms, end=INTRO + rows[-1]["t_settled"] + 3.4)
    sfx = [(t, S.sfx_click(), 0.35) for t in clicks]
    return T, sfx


def loudness(path):
    out = subprocess.run(["ffmpeg", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1]), float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)[-1])


if __name__ == "__main__":
    film = sys.argv[1]
    T, sfx = {"player": player, "admin": admin}[film]()
    T["total"] = round(T["end"] + OUTRO, 2)
    root = HERE / film
    (root / "assets/audio").mkdir(parents=True, exist_ok=True)
    (root / "assets/cues.js").write_text(f"window.__T = {json.dumps(T)};\n")
    n = int(T["total"] * S.SR)
    buf = np.zeros(n, np.float32)
    for at, clip, gain in sfx:
        S.place(buf, clip / (np.max(np.abs(clip)) or 1) * gain, at)
    bed = S.music(T["total"])
    bed = bed / (np.max(np.abs(bed)) or 1) * BED[film] * np.minimum(1, np.minimum(np.arange(n) / S.SR / 1.5,
                                                                           (T["total"] - np.arange(n) / S.SR) / 2.0))
    raw, out = root / "assets/audio/sfx.raw.wav", root / "assets/audio/sfx.wav"
    S.write(raw, (buf + bed) / np.max(np.abs(buf + bed)) * S.db(-1))
    i, _ = loudness(raw)
    x = S.read(raw) * S.db(LUFS - i)
    x = x * min(1, S.db(TP) / np.max(np.abs(x)))   # ponytail: linear gain + peak guard, as in the teasers
    S.write(out, x); raw.unlink()
    i, p = loudness(out)
    if p > TP:
        S.write(out, S.read(out) * S.db(TP - 0.1 - p)); i, p = loudness(out)
    assert all(a[0] < b[0] for a, b in zip(T["caps"], T["caps"][1:])), "captions out of order"
    assert i > LUFS - 2.5 and p <= TP + 0.1, (i, p)
    print(f"ok: {film} {T['total']} s, {len(T['caps'])} captions, {len(sfx)} sounds, {i:.1f} LUFS, peak {p:.1f}")
