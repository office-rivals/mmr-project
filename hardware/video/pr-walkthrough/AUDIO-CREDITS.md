# Audio and picture credits

| Track / picture | How it's made | Licence |
|---|---|---|
| Narration `assets/audio/en/vo/*.wav`, `vo.wav` | Text-to-speech from `SCRIPT.md` via `video/film/tools/vo.py en` (`FILM_DIR` = this folder): Kokoro-82M through `npx hyperframes tts`, voice `bm_george`, run locally | Kokoro-82M weights: Apache-2.0. The generated speech is our output. |
| `assets/audio/en/music.wav` | The goal-counter film's pizzicato bed (Karplus-Strong in `video/film/tools/sound.py`), ducked under the voice | Same licence as this repository |
| Code panels (`assets/code.js`) | Read verbatim from the working tree by `tools/excerpts.py` (anchored on a line of code, re-run on every build) | The repository's own code |
| Screens `assets/shots/*` | admin-ui's render harness (mock data = the seed, Example Org) and `observability/screenshots/` (twin data) | The repository's own output |
| Sled stills `assets/sled/*` | `video/film/tools/sled_renders.py` from `hardware/mechanical/sled.py` | The repository's own output |

Timing only: word onsets from Parakeet TDT 0.6B v3 (NVIDIA, CC-BY-4.0) via `video/film/tools/words.py`.
Rebuild (from `video/film`): `sh tools/build.sh pr` -> `video/pr-walkthrough.mp4`, `-cc.mp4`, `.en.srt`.
