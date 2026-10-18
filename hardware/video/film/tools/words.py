"""Measure where each {marker} word starts in each VO line (seconds from the start of the line's wav).

    python3 tools/words.py en   ->  assets/audio/<lang>/words.json

Each line is transcribed locally (Parakeet TDT 0.6B v3 via `npx hyperframes transcribe -e parakeet`), the ASR words are aligned to the script's words, and a marker takes the start time of the
word right after it. Every script word's start is kept too ("words"), for the subtitles. A word the ASR heard differently ("thirty-two" vs "32") is interpolated from its neighbours.
"""
import difflib, json, re, subprocess, sys, tempfile, wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vo import lines, ROOT  # noqa: E402

norm = lambda w: re.sub(r"[^0-9a-zé]", "", w.lower())


def dur(p):
    with wave.open(str(p)) as w:
        return w.getnframes() / w.getframerate()


def asr(wav):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["npx", "hyperframes", "transcribe", str(wav), "-d", d, "-e", "parakeet", "--json"],
                       check=True, capture_output=True, cwd=ROOT)
        data = json.loads((Path(d) / "transcript.json").read_text())
    words = data if isinstance(data, list) else data.get("words", data)
    return [(norm(w["text"]), float(w["start"])) for w in words if norm(w["text"])]


def onsets(marked, heard, length):
    """({marker: seconds}, share of words heard, [[script word, seconds]]) for one line."""
    toks, raw, marks = [], [], {}
    for tok in marked.split():
        for m in re.findall(r"\{(\w+)\}", tok):
            marks[m] = len(toks)
        bare = norm(re.sub(r"\{\w+\}", "", tok))
        if bare:
            toks.append(bare)
            raw.append(re.sub(r"\{\w+\}", "", tok))
    at = {}
    sm = difflib.SequenceMatcher(a=toks, b=[w for w, _ in heard], autojunk=False)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            at[a + k] = heard[b + k][1]

    def when(i):
        if i in at:
            return at[i]
        lo = max((k for k in at if k < i), default=None)
        hi = min((k for k in at if k > i), default=None)
        t_lo = at[lo] if lo is not None else 0.0
        t_hi = at[hi] if hi is not None else length
        i_lo = lo if lo is not None else -1
        i_hi = hi if hi is not None else len(toks)
        return t_lo + (t_hi - t_lo) * (i - i_lo) / (i_hi - i_lo)

    return ({m: round(when(i), 3) for m, i in marks.items()}, len(at) / max(1, len(toks)),
            [[w, round(when(i), 3)] for i, w in enumerate(raw)])


def main(lang):
    out = {}
    for lid, marked in lines(lang).items():
        wav = ROOT / f"assets/audio/{lang}/vo/{lid}.wav"
        length = dur(wav)
        heard = asr(wav)
        cues, matched, said = onsets(marked, heard, length)
        start = heard[0][1] if heard else 0.0
        out[lid] = {"dur": round(length, 3), "speech": round(start, 3), "cues": cues, "matched": round(matched, 2), "words": said}
        print(f"{lid}: {length:5.2f}s speech@{start:.2f} matched {matched:.0%} {cues}")
    (ROOT / f"assets/audio/{lang}/words.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
