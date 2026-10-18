---
format: 1920x1080
duration: 132s
message: "Drop it in the goal drawer and every goal is counted — battery-powered, months on AA"
arc: Lazy status quo → How it works → Hardware → Printed insert → Online → Battery → The app suggests the score
audience: the team and colleagues who play on the tables
tone: a bit funny — "because we're lazy, and because we can" (user, via lead); tech scenes accurate with a wink
mode: collaborative
---

Design: light "workshop paper" canvas #f2efe8, ink #1b1d22, one accent #e8431f (the IR beam / goal hits).
Type: Archivo Black (statements) + IBM Plex Mono (specs, labels, jokes in the footer).
Persistent background in index.html: drifting blueprint grid, accent glow, brand line. Accent wipe on each cut.
No voice-over (user confirmed). Renders: assets/ ← mechanical/out/video/ (v2).

**v3 (less text):** the beat-by-beat plan (animation → the one line) is `BEATS.md`; it supersedes the frame
notes that were here. Scenes: s1 0–17.3, s2 17.3–33.7, s3 33.7–46.7, s4 46.7–59.1, s5 59.1–77.8, s6 77.8–86.5,
s7 86.5–101.1. Captions live in one track in `index.html` (one line at a time). All frames `status: animated`.

**v4 (voice-over):** the timing source is now `tools/beats.json` (one row per beat: motion, VO line, optional caption,
SFX cues) + `SCRIPT.md` (narration). `python3 tools/vo.py && python3 tools/retime.py && python3 tools/sound.py`
regenerates the narration, rewrites every scene's beat anchors, the captions and the index timing from the real VO
lengths, and rebuilds the three audio tracks. `BEATS.md` describes v3 (silent) and is kept for history only.
