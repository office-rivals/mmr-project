"""Lay the film out on the voice-over and write one language's build.

    python3 tools/retime.py en [--no-subs]     (--no-subs: nothing drawn in; the .srt is still written)

Inputs : tools/beats.json, tools/strings.json, assets/audio/<lang>/words.json (tools/words.py), the VO wavs.
Outputs: index.html                           -- the root composition, built for <lang>. One root only:
                                                two root files make the runtime play both. Default build: en.
         assets/i18n/<lang>.js                -- window.__FILM: strings, captions, scene starts, scene cue times
         assets/audio/<lang>/timing.json      -- VO / SFX / silence placement for tools/sound.py
         ../<name>.<lang>.srt                 -- the narration as subtitles (also burned in, see subtitles())

Sync rule (user): every visual and on-screen line lands together with, or LEAD s before, the word that
describes it -- never after. A line is held >= words/3 + 1 s and nothing new starts while it is read.
"""
import json, re, sys
from vo import ROOT   # FILM_DIR: the film being built


def hold(html):
    return max(len(re.sub(r"<.*?>", "", html).split()) / 3 + 1, 2.0)


def layout(cfg, words, caps):
    lead, gap = cfg["lead"], cfg["gap"]
    rows, nxt = [], lead + 0.2           # nxt = earliest start of the next VO line
    for ln in cfg["lines"]:
        w = words[ln["vo"]]
        vo = nxt + ln.get("pre", 0.0) + ln.get("open", 0.0)   # open: the scene shows that long before the line's first cue
        cue = lambda m: vo + w["cues"][m] - lead
        r = dict(ln, vo_start=vo, vo_end=vo + w["dur"], visual=vo - lead - ln.get("open", 0.0), cues={})
        if ln.get("beat"):
            r["cues"][ln["beat"]] = vo + w["speech"] - lead
        for m in w["cues"]:
            if m != "cap":
                r["cues"][m] = cue(m)
        for name, m in ln.get("cues", {}).items():
            r["cues"][name] = cue(m)
        for name, (base, off) in ln.get("fallback", {}).items():   # a script without that marker still works
            if name not in r["cues"]:
                r["cues"][name] = (r["vo_end"] - lead if base == "end" else r["cues"][base]) + off
        done = r["vo_end"] + gap
        if r["cues"]:
            done = max(done, max(r["cues"].values()) + ln.get("after", 0.6) + lead)
        if ln["vo"] in caps:
            cs = cue("cap") if "cap" in w["cues"] else vo + w["speech"] - lead
            r["cap"] = [cs, caps[ln["vo"]]]
            done = max(done, cs + hold(caps[ln["vo"]]) + lead)
        rows.append(r)
        nxt = done
    total = round(rows[-1]["vo_end"] + cfg["tail"], 2)
    return rows, total


SUB_MAX = 48      # characters on one subtitle line: always one line at the template's .sub size
# a long sentence without a comma is cut before one of these, never mid-phrase
BREAK_BEFORE = set("that when and but through into with before to on so because while which or".split())


def phrases(toks):
    """Cut one VO line's [[word, t]] into subtitle phrases: whole sentences when they fit, else at commas/colons,
    else before a conjunction/preposition, else in the middle. Never joins sentences: a punchline isn't shown
    before it's said."""
    text = lambda ws: " ".join(w for w, _ in ws)
    sents, cur = [], []
    for i, w in enumerate(toks):
        cur.append(w)
        nxt = toks[i + 1][0] if i + 1 < len(toks) else "A"
        if re.search(r"[.?!…]$", w[0]) and nxt[0].isupper():   # "pr. mål" is no sentence end
            sents.append(cur); cur = []
    sents += [cur] if cur else []

    def fit(ws):
        if len(text(ws)) <= SUB_MAX:
            return [ws]
        cuts = ([i + 1 for i, w in enumerate(ws[:-1]) if re.search(r"[,:;]$", w[0])]
                or [i for i in range(2, len(ws) - 1) if ws[i][0].lower() in BREAK_BEFORE] or [len(ws) // 2])
        i = min(cuts, key=lambda c: abs(len(text(ws[:c])) - len(text(ws[c:]))))
        return fit(ws[:i]) + fit(ws[i:])

    out = [ph for sent in sents for ph in fit(sent)]
    return [(text(ph), ph[0][1]) for ph in out]


def say_as(toks, table):
    """Collapse spelled-for-the-voice runs back to how they're written ("E S P thirty-two" -> "ESP32")."""
    toks = [list(t) for t in toks]
    for spoken, shown in table.items():
        k = spoken.split()
        i = 0
        while i <= len(toks) - len(k):
            run = [w for w, _ in toks[i:i + len(k)]]
            tail = re.sub(r"^.*?([^\w]*)$", r"\1", run[-1])
            if run[:-1] == k[:-1] and run[-1][:len(run[-1]) - len(tail) or None] == k[-1]:
                toks[i:i + len(k)] = [[shown + tail, toks[i][1]]]
            i += 1
    return toks


def subtitles(rows, words, capl, table, lead):
    """[[in, out, text, burn]]: each phrase lands LEAD s before its first word and holds until the next one
    (at least 1.2 s, at most 0.4 s past the line). burn=False where an on-screen line already says the same."""
    subs = []
    for r in rows:
        w = words[r["vo"]]
        for i, (text, t) in enumerate(phrases(say_as(w["words"], table))):
            subs.append([r["vo_start"] + t - lead, r["vo_end"], text])
            if i:
                subs[-2][1] = subs[-1][0]
    words_of = lambda h: [x for x in (re.sub(r"[^\w']", "", x).lower() for x in re.sub(r"<.*?>", "", h).split()) if x]
    out = []
    for i, (a, end, text) in enumerate(subs):
        nxt = subs[i + 1][0] if i + 1 < len(subs) else end + 1.0
        b = min(nxt, max(end + 0.4, a + 1.2)) if end + 0.4 < nxt else nxt
        said = words_of(text)
        dup = any(c0 < b and c1 > a and any(words_of(h)[k:k + len(said)] == said for k in range(len(words_of(h))))
                  for c0, c1, h in capl)
        out.append([round(a, 3), round(b, 3), text, not dup])
    return out


def srt(subs):
    ts = lambda t: f"{int(t // 3600):02}:{int(t % 3600 // 60):02}:{int(t % 60):02},{round(t % 1 * 1000) % 1000:03}"
    return "\n".join(f"{i}\n{ts(a)} --> {ts(b)}\n{text}\n" for i, (a, b, text, _) in enumerate(subs, 1))


def main(lang, burn=True):
    cfg = json.loads((ROOT / "tools/beats.json").read_text())
    SCENES, film_name = cfg.get("scenes", [f"s{i}" for i in range(1, 8)]), cfg.get("name", "goal-counter")
    S = json.loads((ROOT / "tools/strings.json").read_text())[lang]
    words = json.loads((ROOT / f"assets/audio/{lang}/words.json").read_text())
    rows, total = layout(cfg, words, S["captions"])

    starts = {}
    for r in rows:
        starts.setdefault(r["scene"], 0.0 if r["scene"] == "s1" else round(r["visual"], 2))
    ends = {s: (starts[SCENES[i + 1]] if i + 1 < len(SCENES) else total) for i, s in enumerate(SCENES)}
    cues = {s: {} for s in SCENES}
    for r in rows:
        for k, t in r["cues"].items():
            cues[r["scene"]][k] = round(t - starts[r["scene"]], 3)

    # captions run until the next line's visuals start (one line at a time)
    capl = []
    for i, r in enumerate(rows):
        if "cap" in r:
            later = [x["visual"] for x in rows[i + 1:]]
            end = later[0] if later else total
            capl.append([round(r["cap"][0], 3), round(end, 3), r["cap"][1]])

    subs = subtitles(rows, words, capl, S.get("say_as", {}), cfg["lead"])
    (ROOT.parent / f"{film_name}.{lang}.srt").write_text(srt(subs))
    film = {"lang": lang, "total": total, "t": S["t"], "caps": capl, "subs": [s[:3] for s in subs if s[3] and burn],
            "scenes": {s: [starts[s], round(ends[s] - starts[s], 2)] for s in SCENES}, "cues": cues}
    (ROOT / "assets/i18n").mkdir(parents=True, exist_ok=True)
    (ROOT / f"assets/i18n/{lang}.js").write_text(
        "// Generated by tools/retime.py -- do not edit; change tools/strings.json, tools/beats.json or the script.\n"
        f"window.__FILM = {json.dumps(film, ensure_ascii=False, indent=1)};\n")

    html = (ROOT / "tools/index.template.html").read_text()
    html = html.replace("__LANG__", lang).replace("__TOTAL__", str(total)).replace("__CHROME__", S["chrome"])
    for s in SCENES:
        html = html.replace(f"__{s}_START__", str(starts[s])).replace(f"__{s}_DUR__", str(round(ends[s] - starts[s], 2)))
    html = html.replace("<!doctype html>", "<!doctype html>\n<!-- Generated by tools/retime.py from tools/index.template.html -- do not edit. -->", 1)
    (ROOT / "index.html").write_text(html)

    timing = {"total": total, "vo": [], "sfx": [], "silence": []}
    for i, r in enumerate(rows):
        timing["vo"].append({"id": r["vo"], "start": round(r["vo_start"], 3), "end": round(r["vo_end"], 3)})
        for name, at, off, *d in r.get("sfx", []):
            t0 = r["cues"][at] + off
            dur = d[0] if d and isinstance(d[0], (int, float)) else (r["cues"][d[0]] - t0 if d else None)
            timing["sfx"].append({"cue": name, "t": round(t0, 3), "dur": dur})
        if r.get("silence"):
            timing["silence"].append([round(rows[i - 1]["vo_end"], 3), round(r["vo_start"], 3)])
    (ROOT / f"assets/audio/{lang}/timing.json").write_text(json.dumps(timing, indent=1))

    for s in SCENES:
        print(f"{s}: {starts[s]:7.2f} -> {ends[s]:7.2f}  cues {cues[s]}")
    print(f"{lang}: total {total} s, {len(capl)} captions, {len(film['subs'])} subtitles burned in ({len(subs)} in the .srt)")


if __name__ == "__main__":
    main(sys.argv[1], "--no-subs" not in sys.argv)
