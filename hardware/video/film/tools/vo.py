"""Generate one VO file per script line, 48 kHz mono, into assets/audio/<lang>/vo/<id>.wav.

    python3 tools/vo.py en [L5 L12]   # SCRIPT.md -> Kokoro bm_george (via `npx hyperframes tts`)
    FILM_DIR=../scoreboard python3 tools/vo.py en     # another film's SCRIPT.md (all tools take FILM_DIR)
{markers} in the script are sync points for retime.py and are stripped before synthesis.
Needs the local venv: uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python kokoro-onnx soundfile
English only (user, 2026-10-18): the Danish version and its Chatterbox path are archived outside the repo.
"""
import os, re, subprocess, sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent.parent          # this project: the tools and their .venv
ROOT = Path(os.environ.get("FILM_DIR") or TOOLS).resolve()   # the film being built (FILM_DIR=../scoreboard)
PY = TOOLS / ".venv/bin/python"
SCRIPTS = {"en": "SCRIPT.md"}   # in FILM_DIR


def lines(lang):
    """{line id: text with markers}"""
    out, cur = {}, None
    for l in (ROOT / SCRIPTS[lang]).read_text().splitlines():
        m = re.match(r"## Line (\d+)", l)
        if m:
            cur = f"L{m.group(1)}"
        elif cur and l.startswith("    ") and l.strip():
            out[cur] = l.strip()
    return out


def spoken(text):
    return re.sub(r"\{\w+\}", "", text)


def to48k(src, dst):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "48000", "-ac", "1", str(dst)], check=True)


def kokoro(text, raw):
    subprocess.run(["npx", "hyperframes", "tts", text, "-v", "bm_george", "-s", "1.0", "-o", str(raw)], check=True, cwd=ROOT,
                   env={**os.environ, "HYPERFRAMES_PYTHON": str(PY)}, stdin=subprocess.DEVNULL)


DRAWL = re.compile(r"(\w*?)([aeiou])\2{2,}(\w*)\W*$")   # a last word like "Nooope." is said drawn out


def tts_en(text, raw):
    """Kokoro can't drawl, so a "Nooope." at the end is "Nope." with its vowel stretched (one o = 1x)."""
    m = DRAWL.search(text)
    if not m:
        return kokoro(text, raw)
    import numpy as np, soundfile as sf
    head = text[:m.start()].strip()
    n = len(re.match(rf"{m.group(2)}+", text[m.start(2):]).group(0))
    kokoro(m.group(1) + m.group(2) + m.group(3) + ".", raw)
    word, sr = sf.read(raw)
    env = np.array([np.sqrt(np.mean(word[i:i + sr // 50] ** 2)) for i in range(0, len(word), sr // 50)])
    loud = np.flatnonzero(20 * np.log10(env + 1e-9) > 20 * np.log10(env.max()) - 12)
    run = loud[: (np.flatnonzero(np.diff(loud) > 1).tolist() + [len(loud) - 1])[0] + 1]
    a, b = (run[0] + 3) * sr // 50, (run[-1] - 3) * sr // 50   # the vowel, clear of the consonants
    tempo = ",".join(["atempo=0.5"] * int(np.log2(n)) + [f"atempo={2 ** int(np.log2(n)) / n:.4f}"])
    stretched = raw.with_suffix(".drawl.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-filter_complex",
                    f"[0]atrim=0:{a / sr},asetpts=N/SR/TB[a];[0]atrim={a / sr}:{b / sr},asetpts=N/SR/TB,{tempo}[b];"
                    f"[0]atrim={b / sr},asetpts=N/SR/TB[c];[a][b][c]concat=n=3:v=0:a=1", str(stretched)], check=True)
    kokoro(head, raw)
    lead, lead_sr = sf.read(raw)
    assert lead_sr == sr
    sf.write(raw, np.concatenate([lead, np.zeros(int(sr * 0.45)), sf.read(stretched)[0]]), sr)
    stretched.unlink()


def main(lang, only):
    d = ROOT / f"assets/audio/{lang}/vo"
    d.mkdir(parents=True, exist_ok=True)
    items = [(lid, t) for lid, t in lines(lang).items() if not only or lid in only]
    for lid, text in items:
        raw = d / f"{lid}.raw.wav"
        tts_en(spoken(text), raw)
        to48k(raw, d / f"{lid}.wav")
        raw.unlink()
        print(lid, spoken(text))


if __name__ == "__main__":
    main(sys.argv[1], set(sys.argv[2:]))
