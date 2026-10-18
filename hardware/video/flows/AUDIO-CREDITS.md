# Audio and picture credits (the UI flow films)

| Track / picture | How it's made | Licence |
|---|---|---|
| The phone / admin footage (`player/assets/player.mp4`, `admin/assets/admin.mp4`) | admin-ui's render harness: real Chrome, Playwright, mock data = the API seed (Example Org, /acme, Table 1–3, first names only) | The repository's own output |
| The goal chirp, press tick and undo in the player film | The goal counter's own buzzer sounds (`video/sounds/buzzer/*.wav`: ux's BUZZER table through the firmware's player and a CMT-1209 model) | Same licence as this repository |
| Taps, clicks, the NFC bip, the music bed | Sine tones, filtered noise and the Karplus-Strong bed in `video/film/tools/sound.py` | Same licence as this repository |
| The goal-counter inset | `video/film/assets/sled/front.png` (from `hardware/mechanical/sled.py`) | The repository's own output |

Cue times come from admin-ui's step JSON (`assets/footage/*-flow.json`) in `tools/build.py`.
Rebuild (from `video/film`): `sh tools/build.sh player` / `sh tools/build.sh admin` -> `video/player-flow.mp4`, `video/admin-flow.mp4`.
