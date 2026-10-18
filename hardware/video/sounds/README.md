# Scoreboard sounds v2: listening previews

The premium earcon family from `ux/SOUNDS-V2.md` (a proposal: the buzzer in `SCOREBOARD-UI.md` stays the build
spec until the user approves). Two versions of each sound, as WAV and MP3:

- `master/`: as designed, full range. The WAVs are ux's reference renders, sample for sample, levels included.
- `speaker/`: roughly what a 30–40 mm mini speaker will make of them: band-limited ~300 Hz–8 kHz, a cone
  resonance near 550 Hz, slight presence. A generic model, not the chosen part yet.
- `buzzer/`: the fallback build (option B): ux's BUZZER table as the board plays it. It uses the firmware's
  note table and `snd::Player` logic at 1 ms steps, duty = asin(level) / π on the 13-bit LEDC at the default
  volume (Medium), a band-limited square wave, one tone at a time, and a model of the CMT-1209-390T
  transducer (resonant at 2048 Hz, steep roll-off either side; a generic model, not its datasheet curve).
  The set is scaled once so Goal peaks at −3 dBFS. `tools/buzzer.py`. Since the firmware cleanup (2026-10-18)
  it renders the goal counter's four (goal, undo, scan, not joined) from `firmware/lib/core/sound.h`; won, joined
  and saved belong to the parked scoreboard and stay as rendered from its firmware on 2026-10-17.
- `tour.wav` / `tour.mp3` (in each): all seven in the order below, 1 s apart.

| # | Sound | When it plays |
|---|---|---|
| 00 | Goal | a new goal reaches the board |
| 01 | Won | the goal that ends the game (instead of Goal) |
| 02 | Undo | the server confirms this board's own Undo |
| 03 | Scan | a badge touches the target |
| 04 | Joined | the server says the player is in |
| 05 | Not joined | any other scan result |
| 06 | Saved | the auto-submit lands during the "Saving to MMR" countdown (optional) |

## Preview video (44 s)

`sounds-v2-preview.mp4` (full range), `sounds-v2-preview-speaker.mp4` (mini speaker) and
`sounds-v2-preview-buzzer.mp4` (the buzzer fallback; its cards show the buzzer's own notes): each sound alone, named
with its purpose and its waveform, then one game over ux's screens (four players tap in, an unknown badge,
Fair teams, a goal, an Undo, the win, and Saved, with the 10 s countdown shown at 2× speed). Only ux's sounds
play, at ux's levels; key presses just click on the real board, so they're silent here. Project: `preview/`.

Rebuild everything: `cd ux && uv run sounds.py`, then from `video/film`: `sh tools/build.sh sounds`
(or only the files: `python3 tools/render.py` and `python3 tools/buzzer.py` here).
